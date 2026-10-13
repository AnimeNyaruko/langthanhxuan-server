import { Injectable, Logger } from '@nestjs/common';
import { type SupabaseClient, createClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
	private readonly logger = new Logger(SupabaseService.name);
	private client: SupabaseClient;
	private adminClient: SupabaseClient | null = null;

	constructor() {
		const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
		const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
		const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

		if (!url || !anonKey) {
			this.logger.warn(
				'NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set. Running in unconfigured mode.',
			);
		}

		this.client = createClient(
			url || 'https://placeholder.supabase.co',
			anonKey || 'placeholder',
			{
				auth: { persistSession: false },
			},
		);

		if (serviceRoleKey) {
			this.adminClient = createClient(
				url || 'https://placeholder.supabase.co',
				serviceRoleKey,
				{
					auth: { persistSession: false, autoRefreshToken: false },
				},
			);
		}
	}

	/**
	 * Standard client (respects RLS policies).
	 */
	getClient(): SupabaseClient {
		return this.client;
	}

	/**
	 * Admin client with service_role key (bypasses RLS).
	 * Use only for background jobs, admin tasks, or initial user provisioning.
	 */
	getAdminClient(): SupabaseClient {
		if (!this.adminClient) {
			this.logger.warn(
				'SUPABASE_SERVICE_ROLE_KEY not configured, falling back to anon client',
			);
			return this.client;
		}
		return this.adminClient;
	}

	/**
	 * Create an authenticated client on behalf of a specific user token (enforces their RLS).
	 */
	getClientForToken(jwt: string): SupabaseClient {
		const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
		const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

		return createClient(url, anonKey, {
			global: {
				headers: {
					Authorization: `Bearer ${jwt}`,
				},
			},
			auth: { persistSession: false },
		});
	}
}
