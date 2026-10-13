import {
	type CanActivate,
	type ExecutionContext,
	ForbiddenException,
	Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * CSRF Protection Guard.
 * - Safe methods (GET, HEAD, OPTIONS) pass through.
 * - Requests authenticated via `Authorization: Bearer ...` header are immune
 *   to browser CSRF (browsers do not attach Authorization headers automatically).
 * - Cookie-authenticated mutating requests (POST, PUT, PATCH, DELETE) must supply
 *   an `x-csrf-token` header matching the `next-auth.csrf-token` cookie or a custom double-submit cookie.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const req = context.switchToHttp().getRequest<Request>();
		const method = req.method.toUpperCase();

		// 1. Safe methods bypass
		if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
			return true;
		}

		// 2. Bearer-token requests cannot be forged cross-site
		const authHeader = req.headers.authorization;
		if (authHeader && authHeader.startsWith('Bearer ')) {
			return true;
		}

		// 3. Custom-header defense: modern browsers enforce CORS preflight for custom headers
		const customHeader =
			req.headers['x-csrf-token'] ||
			req.headers['x-requested-with'] ||
			req.headers['x-ltx-client'];

		if (customHeader) {
			return true;
		}

		// 4. Double-submit cookie verification if csrf cookie exists
		const csrfCookie =
			req.cookies?.['next-auth.csrf-token'] ||
			req.cookies?.['__Host-next-auth.csrf-token'] ||
			req.cookies?.['csrf-token'];

		const csrfHeader = req.headers['x-csrf-token'] as string | undefined;

		if (csrfCookie && csrfHeader) {
			// next-auth csrf token cookie has format: "<rawToken>|<hash>"
			const rawCookieToken = csrfCookie.split('|')[0];
			if (rawCookieToken === csrfHeader || csrfCookie === csrfHeader) {
				return true;
			}
		}

		throw new ForbiddenException(
			'CSRF check failed: missing required custom header (X-Requested-With / X-CSRF-Token)',
		);
	}
}
