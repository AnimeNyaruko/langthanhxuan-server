import {
	Injectable,
	InternalServerErrorException,
	NotFoundException,
	Logger,
} from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.service';
import { decryptField } from '../../common/security/crypto';
import type { SignupWizardPayload, UpdateProfilePayload } from './users.dto';

export interface UserProfileRecord {
	profile_id: string;
	user_id: string;
	email: string | null;
	fullname: string;
	dob: string | null;
	location: string;
	skills: string[];
	custom_skill: string | null;
	hours: number;
	methods: string[];
	meeting_image_url: string | null;
	meeting_status: string;
	reference_info: string | null;
	phone_encrypted: string | null;
	role: string;
	created_at: string;
	updated_at: string;
}

@Injectable()
export class UsersService {
	private readonly logger = new Logger(UsersService.name);

	constructor(private readonly supabase: SupabaseService) {}

	/**
	 * Completes the multi-step signup and upserts the profile row in Supabase.
	 */
	async completeSignup(
		userId: string,
		email: string | undefined,
		image: string | undefined,
		data: SignupWizardPayload,
	) {
		const dob = `${data.dobYear}-${data.dobMonth.padStart(2, '0')}-${data.dobDay.padStart(2, '0')}`;
		const client = this.supabase.getAdminClient();

		// The profiles.user_id foreign key requires this row to exist first.
		const userResult = await client.from('user').upsert(
			{
				user_id: userId,
				full_name: data.fullname,
				date_of_birth: dob,
				email: email || null,
				location: data.location,
				time_given: data.hours || 0,
				image_url: image || null,
			},
			{ onConflict: 'user_id' },
		);

		if (userResult.error) {
			this.logger.error(
				`Failed to create user record for ${userId}: ${userResult.error.message}`,
			);
			throw new InternalServerErrorException('Could not persist user record');
		}

		const record = {
			user_id: userId,
			email: email || null,
			fullname: data.fullname,
			dob,
			location: data.location,
			skills: data.skills,
			custom_skill: data.customSkill || null,
			hours: data.hours || 0,
			methods: data.method || [],
			meeting_image_url: data.meeting_image_url || null,
			meeting_status: data.meetingStatus || 'notMet',
			reference_info: data.referenceInfo || null,
			updated_at: new Date().toISOString(),
		};

		const profileResult = await client
			.from('profiles')
			.upsert(record, { onConflict: 'user_id' })
			.select()
			.single();

		if (profileResult.error) {
			this.logger.error(
				`Failed to save signup for user ${userId}: ${profileResult.error.message}`,
			);
			throw new InternalServerErrorException('Could not persist signup profile');
		}

		return this.sanitizeProfile(profileResult.data);
	}

	/**
	 * Retrieves the user's own profile and decrypts sensitive fields.
	 */
	async getProfile(userId: string) {
		const client = this.supabase.getAdminClient();
		const { data, error } = await client
			.from('profiles')
			.select('*')
			.eq('user_id', userId)
			.single();

		if (error || !data) {
			throw new NotFoundException('User profile not found');
		}

		return this.sanitizeProfile(data);
	}

	/**
	 * Partial profile update.
	 */
	async updateProfile(userId: string, update: UpdateProfilePayload) {
		const client = this.supabase.getAdminClient();
		const patch: Record<string, unknown> = {
			updated_at: new Date().toISOString(),
		};

		if (update.fullname !== undefined) patch.fullname = update.fullname;
		if (update.location !== undefined) patch.location = update.location;
		if (update.skills !== undefined) patch.skills = update.skills;
		if (update.customSkill !== undefined) patch.custom_skill = update.customSkill;
		if (update.hours !== undefined) patch.hours = update.hours;
		if (update.method !== undefined) patch.methods = update.method;
		if (update.meeting_image_url !== undefined)
			patch.meeting_image_url = update.meeting_image_url;
		if (update.meetingStatus !== undefined) patch.meeting_status = update.meetingStatus;
		if (update.referenceInfo !== undefined) patch.reference_info = update.referenceInfo;

		if (update.dobYear && update.dobMonth && update.dobDay) {
			patch.dob = `${update.dobYear}-${update.dobMonth.padStart(2, '0')}-${update.dobDay.padStart(2, '0')}`;
		}

		const { data, error } = await client
			.from('profiles')
			.update(patch)
			.eq('user_id', userId)
			.select()
			.single();

		if (error) {
			throw new InternalServerErrorException('Could not update profile');
		}

		return this.sanitizeProfile(data);
	}

	/**
	 * Admin-only: list all user profiles.
	 */
	async listAll(limit = 50, offset = 0) {
		const client = this.supabase.getAdminClient();
		const { data, error } = await client
			.from('profiles')
			.select('*')
			.range(offset, offset + limit - 1)
			.order('created_at', { ascending: false });

		if (error) {
			throw new InternalServerErrorException('Could not list profiles');
		}

		return (data || []).map((p) => this.sanitizeProfile(p));
	}

	/**
	 * Display all user information from the user table.
	 */
	async listAllUserInfo() {
		const client = this.supabase.getAdminClient();
		const { data, error } = await client
			.from('user')
			.select(
				'user_id, full_name, date_of_birth, email, phone_number, join_date, location, time_given, points, verification_level, authorization',
			)
			.order('join_date', { ascending: false });

		if (error) {
			this.logger.error(`Failed to list user info: ${error.message}`);
			throw new InternalServerErrorException('Could not list user information');
		}

		return data || [];
	}

	private sanitizeProfile(record: UserProfileRecord) {
		const decryptedPhone = record.phone_encrypted ? decryptField(record.phone_encrypted) : null;

		return {
			profile_id: record.profile_id,
			user_id: record.user_id,
			email: record.email,
			fullname: record.fullname,
			dob: record.dob,
			location: record.location,
			skills: record.skills,
			customSkill: record.custom_skill,
			hours: record.hours,
			methods: record.methods,
			meeting_image_url: record.meeting_image_url,
			meetingStatus: record.meeting_status,
			referenceInfo: record.reference_info,
			phone: decryptedPhone,
			role: record.role || 'user',
			createdAt: record.created_at,
			updatedAt: record.updated_at,
		};
	}
}
