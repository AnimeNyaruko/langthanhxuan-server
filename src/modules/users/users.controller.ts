import { Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../auth/current-user.decorator';
import {
	SignupWizardDto,
	type SignupWizardPayload,
	UpdateProfileDto,
	type UpdateProfilePayload,
} from './users.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	/**
	 * Complete signup wizard (persists step1 + step2 + step3 data).
	 */
	@Post('signup')
	async completeSignup(
		@CurrentUser() user: AuthenticatedUser,
		@Body(new ZodValidationPipe(SignupWizardDto)) payload: SignupWizardPayload,
	) {
		return this.usersService.completeSignup(user.id, user.email, payload);
	}

	/**
	 * Get the logged-in user's own profile.
	 */
	@Get('profile')
	async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
		return this.usersService.getProfile(user.id);
	}

	/**
	 * Partial profile update.
	 */
	@Patch('profile')
	async updateProfile(
		@CurrentUser() user: AuthenticatedUser,
		@Body(new ZodValidationPipe(UpdateProfileDto)) payload: UpdateProfilePayload,
	) {
		return this.usersService.updateProfile(user.id, payload);
	}

	/**
	 * Display all user information.
	 */
	@Get('info')
	async listAllUserInfo() {
		return this.usersService.listAllUserInfo();
	}

	/**
	 * Admin-only: list all registered profiles.
	 */
	@Get('admin/all')
	@Roles('admin')
	async listAllUsers(@Query('limit') limit?: string, @Query('offset') offset?: string) {
		const parsedLimit = Math.min(100, Math.max(1, Number(limit) || 50));
		const parsedOffset = Math.max(0, Number(offset) || 0);
		return this.usersService.listAll(parsedLimit, parsedOffset);
	}
}
