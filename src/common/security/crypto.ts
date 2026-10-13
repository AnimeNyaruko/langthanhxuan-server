import {
	createCipheriv,
	createDecipheriv,
	randomBytes,
	scryptSync,
	timingSafeEqual,
} from 'node:crypto';

/**
 * Native Node.js crypto helpers (AES-256-GCM + scrypt).
 * Zero external dependencies, constant-time comparisons where applicable.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

function getEncryptionKey(): Buffer {
	const secret = process.env.FIELD_ENCRYPTION_KEY;
	if (!secret) {
		throw new Error('FIELD_ENCRYPTION_KEY must be set (min 32 chars)');
	}
	// Deterministically derive a 32-byte key from the secret
	return scryptSync(secret, 'ltx-salt-field-enc', 32);
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output format: `iv.authTag.ciphertext` (all hex).
 */
export function encryptField(plainText: string): string {
	if (!plainText) return plainText;
	const key = getEncryptionKey();
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv);

	const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
	const authTag = cipher.getAuthTag();

	return `${iv.toString('hex')}.${authTag.toString('hex')}.${encrypted.toString('hex')}`;
}

/**
 * Decrypts an `iv.authTag.ciphertext` hex string.
 * Returns original string or throws on tampering.
 */
export function decryptField(encryptedPayload: string): string {
	if (!encryptedPayload || !encryptedPayload.includes('.')) {
		return encryptedPayload;
	}
	const [ivHex, authTagHex, cipherHex] = encryptedPayload.split('.');
	if (!ivHex || !authTagHex || !cipherHex) {
		return encryptedPayload;
	}

	const key = getEncryptionKey();
	const iv = Buffer.from(ivHex, 'hex');
	const authTag = Buffer.from(authTagHex, 'hex');
	const decipher = createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);

	const decrypted = Buffer.concat([
		decipher.update(Buffer.from(cipherHex, 'hex')),
		decipher.final(),
	]);
	return decrypted.toString('utf8');
}

/**
 * Hash a secret (like OTP or password) with scrypt + random salt.
 * Format: `salt:hash` (hex).
 */
export function hashSecret(secret: string): string {
	const salt = randomBytes(SALT_LENGTH).toString('hex');
	const derived = scryptSync(secret, salt, KEY_LENGTH);
	return `${salt}:${derived.toString('hex')}`;
}

/**
 * Verify secret against `salt:hash` in constant time.
 */
export function verifySecret(secret: string, storedHash: string): boolean {
	const [salt, originalHash] = storedHash.split(':');
	if (!salt || !originalHash) return false;

	const derived = scryptSync(secret, salt, KEY_LENGTH);
	const derivedBuf = Buffer.from(derived.toString('hex'), 'hex');
	const originalBuf = Buffer.from(originalHash, 'hex');

	if (derivedBuf.length !== originalBuf.length) return false;
	return timingSafeEqual(derivedBuf, originalBuf);
}
