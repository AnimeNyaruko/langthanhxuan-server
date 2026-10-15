import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.service';

@Injectable()
export class LeaderboardService {
	private readonly logger = new Logger(LeaderboardService.name);

	constructor(private readonly supabase: SupabaseService) {}

	/**
	 * Returns the top 5 users with the highest points.
	 */
	async getTopUsers() {
		const client = this.supabase.getAdminClient();
		const { data, error } = await client
			.from('user')
			.select('user_id, full_name, points, skills, image_url')
			.order('points', { ascending: false })
			.limit(10);

		if (error) {
			this.logger.error(`Failed to fetch leaderboard: ${error.message}`);
			throw new InternalServerErrorException('Could not fetch leaderboard');
		}

		return data || [];
	}
}
