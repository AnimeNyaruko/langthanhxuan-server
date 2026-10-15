import { Controller, Get } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';

@Controller('leaderboard')
export class LeaderboardController {
	constructor(private readonly leaderboardService: LeaderboardService) {}

	/** Top 10 users by points — public endpoint. */
	@Get('top')
	async getTop() {
		return this.leaderboardService.getTopUsers();
	}
}
