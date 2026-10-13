import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  encryptField,
  decryptField,
  hashSecret,
  verifySecret,
} from "./crypto";

process.env.FIELD_ENCRYPTION_KEY = "test_secret_key_that_is_long_enough_for_scrypt_32_bytes";

test("AES-256-GCM encryption & decryption roundtrip", () => {
  const sample = "+84901234567";
  const encrypted = encryptField(sample);

  assert.notStrictEqual(encrypted, sample);
  assert.strictEqual(encrypted.split(".").length, 3, "format must be iv.tag.cipher");

  const decrypted = decryptField(encrypted);
  assert.strictEqual(decrypted, sample, "decrypted value must equal original plaintext");
});

test("scrypt password/OTP hashing and constant-time verification", () => {
  const otp = "839201";
  const hashed = hashSecret(otp);

  assert.notStrictEqual(hashed, otp);
  assert.ok(hashed.includes(":"), "format must be salt:hash");

  assert.strictEqual(verifySecret(otp, hashed), true);
  assert.strictEqual(verifySecret("000000", hashed), false);
  assert.strictEqual(verifySecret("83920", hashed), false);
});
