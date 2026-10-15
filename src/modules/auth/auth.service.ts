import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.service';
import { encryptField, hashSecret, verifySecret } from '../../common/security/crypto';
import { randomInt } from 'node:crypto';

interface OtpEntry {
	hashedCode: string;
	expiresAt: number;
	attempts: number;
}

@Injectable()
export class AuthService {
	private readonly logger = new Logger(AuthService.name);
	// ponytail: In-memory OTP store with 5m TTL. Upgrade to Supabase table/Redis if multi-instance.
	private readonly otpStore = new Map<string, OtpEntry>();

	constructor(private readonly supabase: SupabaseService) {}

	/**
	 * Generates a cryptographically strong 6-digit numeric OTP,
	 * stores hashed version in memory, and logs (or dispatches via SMS).
	 */
	async sendPhoneOtp(phone: string): Promise<{ success: boolean; message: string }> {
		const cleanPhone = phone.replace(/[\s().-]/g, '');
		const vnPhoneRegex = /^(?:(?:\+84|84)[35789]\d{8}|0[35789]\d{8})$/;

		if (!vnPhoneRegex.test(cleanPhone)) {
			throw new BadRequestException('Invalid Vietnamese phone number format');
		}

		// Rate-limit: block if previous OTP exists and is < 60s old
		const existing = this.otpStore.get(cleanPhone);
		const now = Date.now();
		if (existing && existing.expiresAt - now > 4 * 60 * 1000) {
			throw new BadRequestException('Please wait 60s before requesting another OTP');
		}

		// Generate 6-digit code
		const code = randomInt(100000, 999999).toString();
		const hashedCode = hashSecret(code);

		this.otpStore.set(cleanPhone, {
			hashedCode,
			expiresAt: now + 5 * 60 * 1000, // 5 min TTL
			attempts: 0,
		});

		// In production: dispatch via SMS provider (e.g. Twilio, eSMS, VietGuys, SpeedSMS)
		if (process.env.NODE_ENV !== 'production') {
			this.logger.log(`[DEV ONLY] OTP for ${cleanPhone}: ${code}`);
		}

		return {
			success: true,
			message: 'OTP dispatched successfully',
		};
	}

	/**
	 * Verifies the 6-digit OTP in constant time, prevents brute-forcing with 3-attempt limit.
	 */
	async verifyPhoneOtp(
		phone: string,
		code: string,
		userId?: string,
	): Promise<{ verified: boolean; phone: string }> {
		const cleanPhone = phone.replace(/[\s().-]/g, '');
		const entry = this.otpStore.get(cleanPhone);
		const now = Date.now();

		if (!entry || entry.expiresAt < now) {
			this.otpStore.delete(cleanPhone);
			throw new BadRequestException('OTP expired or not found. Please request a new code.');
		}

		if (entry.attempts >= 3) {
			this.otpStore.delete(cleanPhone);
			throw new BadRequestException(
				'Too many incorrect attempts. Please request a new code.',
			);
		}

		entry.attempts += 1;

		const isValid = verifySecret(code, entry.hashedCode);
		if (!isValid) {
			throw new BadRequestException('Invalid confirmation code');
		}

		// Success: consume OTP
		this.otpStore.delete(cleanPhone);

		// If a user ID is supplied (authenticated), update their encrypted phone in Supabase
		if (userId) {
			const encryptedPhone = encryptField(cleanPhone);
			const client = this.supabase.getAdminClient();
			await client
				.from('profiles')
				.update({
					phone_encrypted: encryptedPhone,
					phone_verified: true,
					updated_at: new Date().toISOString(),
				})
				.eq('user_id', userId);
		}

		return { verified: true, phone: cleanPhone };
	}
}
