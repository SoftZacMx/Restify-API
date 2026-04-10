import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Encripta un string con AES-256-GCM.
 * Retorna: iv:tag:ciphertext (hex encoded).
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Desencripta un string encriptado con encrypt().
 */
export function decrypt(encrypted: string): string {
  const key = getEncryptionKey();
  const [ivHex, tagHex, ciphertext] = encrypted.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

function getEncryptionKey(): Buffer {
  const key = process.env.PAYMENT_CONFIG_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error(
      'PAYMENT_CONFIG_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). ' +
      "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(key, 'hex');
}
