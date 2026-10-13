import {
	Injectable,
	InternalServerErrorException,
	NotFoundException,
	Logger,
} from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.service';
import { decryptField, encryptField } from '../../common/security/crypto';
import type { SignupWizardPayload, UpdateProfilePayload } from './users.dto';

export interface UserProfileRecord {
	id: string;
	email: string | null;
	fullname: string;
	dob: string | null;
	location: string;
	skills: string[];
	custom_skill: string | null;
	hours: number;
	methods: string[];
	image_url: string | null;
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
	async completeSignup(userId: string, email: string | undefined, data: SignupWizardPayload) {
		const dob = `${data.dobYear}-${data.dobMonth.padStart(2, '0')}-${data.dobDay.padStart(2, '0')}`;
		const client = this.supabase.getAdminClient();

		const record = {
			id: userId,
			email: email || null,
			fullname: data.fullname,
			dob,
			location: data.location,
			skills: data.skills,
			custom_skill: data.customSkill || null,
			hours: data.hours || 0,
			methods: data.method || [],
			image_url: data.imageUrl || null,
			meeting_status: data.meetingStatus || 'notMet',
			reference_info: data.referenceInfo || null,
			updated_at: new Date().toISOString(),
		};

		const { data: result, error } = await client
			.from('profiles')
			.upsert(record, { onConflict: 'id' })
			.select()
			.single();

		if (error) {
			this.logger.error(`Failed to save signup for user ${userId}: ${error.message}`);
			throw new InternalServerErrorException('Could not persist signup profile');
		}

		return this.sanitizeProfile(result);
	}

	/**
	 * Retrieves the user's own profile and decrypts sensitive fields.
	 */
	async getProfile(userId: string) {
		const client = this.supabase.getAdminClient();
		const { data, error } = await client.from('profiles').select('*').eq('id', userId).single();

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
		if (update.imageUrl !== undefined) patch.image_url = update.imageUrl;
		if (update.meetingStatus !== undefined) patch.meeting_status = update.meetingStatus;
		if (update.referenceInfo !== undefined) patch.reference_info = update.referenceInfo;

		if (update.dobYear && update.dobMonth && update.dobDay) {
			patch.dob = `${update.dobYear}-${update.dobMonth.padStart(2, '0')}-${update.dobDay.padStart(2, '0')}`;
		}

		const { data, error } = await client
			.from('profiles')
			.update(patch)
			.eq('id', userId)
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
				'user_id, full_name, date_of_birth, email, phone_number, join_date, location, time_given, points, verification_stage, authorization',
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
			id: record.id,
			email: record.email,
			fullname: record.fullname,
			dob: record.dob,
			location: record.location,
			skills: record.skills,
			customSkill: record.custom_skill,
			hours: record.hours,
			methods: record.methods,
			imageUrl: record.image_url,
			meetingStatus: record.meeting_status,
			referenceInfo: record.reference_info,
			phone: decryptedPhone,
			role: record.role || 'user',
			createdAt: record.created_at,
			updatedAt: record.updated_at,
		};
	}
}
