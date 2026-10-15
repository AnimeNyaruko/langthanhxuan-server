import {
	type CanActivate,
	type ExecutionContext,
	Injectable,
	UnauthorizedException,
	ForbiddenException,
	Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { decode as decodeNextAuthJwt } from 'next-auth/jwt';
import { jwtVerify } from 'jose';
import type { Request } from 'express';
import { ROLES_KEY, type Role } from './roles.decorator';
import type { AuthenticatedUser } from './current-user.decorator';
import { SupabaseService } from '../../config/supabase.service';

@Injectable()
export class AuthGuard implements CanActivate {
	private readonly logger = new Logger(AuthGuard.name);

	constructor(
		private reflector: Reflector,
		private readonly supabase: SupabaseService,
	) {}

	// ponytail: live role lookups on every protected request; add a short TTL cache
	// if this becomes a bottleneck.
	private async resolveRoleFromDatabase(sub: string): Promise<Role | null> {
		try {
			const { data, error } = await this.supabase
				.getAdminClient()
				.from('profiles')
				.select('role')
				.eq('user_id', sub)
				.single();

			if (error || !data) {
				return null;
			}

			const role = data.role as Role | undefined;
			if (role && ['user', 'moderator', 'admin'].includes(role)) {
				return role;
			}
			return null;
		} catch {
			this.logger.warn(`Failed to resolve role for user ${sub}`);
			return null;
		}
	}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
		const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		const token = this.extractToken(req);

		if (!token) {
			throw new UnauthorizedException('Missing authentication credentials');
		}

		const user = await this.validateToken(token);
		if (!user) {
			throw new UnauthorizedException('Invalid or expired session');
		}

		req.user = user;

		// Role-based authorization
		if (requiredRoles && requiredRoles.length > 0) {
			const hasRole = requiredRoles.includes(user.role);
			if (!hasRole) {
				throw new ForbiddenException('Insufficient permissions for this resource');
			}
		}

		return true;
	}

	private extractToken(
		req: Request,
	): { raw: string; isBearer: boolean; isSecureCookie: boolean } | null {
		const authHeader = req.headers.authorization;
		if (authHeader && authHeader.startsWith('Bearer ')) {
			return { raw: authHeader.slice(7).trim(), isBearer: true, isSecureCookie: false };
		}

		const secureCookie = req.cookies?.['__Secure-next-auth.session-token'];
		if (secureCookie) {
			return { raw: secureCookie, isBearer: false, isSecureCookie: true };
		}

		const normalCookie = req.cookies?.['next-auth.session-token'];
		if (normalCookie) {
			return { raw: normalCookie, isBearer: false, isSecureCookie: false };
		}

		const supabaseToken = req.cookies?.['sb-access-token'];
		if (supabaseToken) {
			return { raw: supabaseToken, isBearer: false, isSecureCookie: false };
		}

		return null;
	}

	private async validateToken(tokenInfo: {
		raw: string;
		isSecureCookie: boolean;
	}): Promise<AuthenticatedUser | null> {
		const nextAuthSecret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;

		// 1. Try decoding as NextAuth JWE (AES-GCM via HKDF)
		if (nextAuthSecret) {
			try {
				const payload = await decodeNextAuthJwt({
					token: tokenInfo.raw,
					secret: nextAuthSecret,
				});

				if (payload && (payload.sub || payload.email)) {
					const sub = (payload.sub as string) || (payload.email as string);
					let role: Role | null = (payload.role as Role) || null;

					// If the JWT doesn't carry a role, resolve live from the profiles table
					// using the already-verified `sub`. This keeps permissions current
					// without requiring roles to be baked into the signed token.
					role = await this.resolveRoleFromDatabase(sub);

					return {
						id: sub,
						email: payload.email as string | undefined,
						name: payload.name as string | undefined,
						image: payload.picture as string | undefined,
						googleSub: (payload.googleSub as string) || (payload.sub as string),
						role: (role ?? 'user') as Role,
						rawToken: tokenInfo.raw,
					};
				}
			} catch {
				// Fall through to standard JWT validation
			}
		}

		// 2. Try validating against Supabase JWT Secret / JWKS
		const supabaseSecret = process.env.SUPABASE_JWT_SECRET;
		if (supabaseSecret) {
			try {
				const secretKey = new TextEncoder().encode(supabaseSecret);
				const { payload } = await jwtVerify(tokenInfo.raw, secretKey, {
					algorithms: ['HS256'],
				});

				const appMetadata = (payload.app_metadata as Record<string, unknown>) || {};
				const role = (appMetadata.role as Role) || 'user';

				return {
					id: payload.sub as string,
					email: payload.email as string | undefined,
					role,
					rawToken: tokenInfo.raw,
				};
			} catch {
				// invalid Supabase token
			}
		}

		return null;
	}
}
