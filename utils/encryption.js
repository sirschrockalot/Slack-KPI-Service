const crypto = require('crypto');

/**
 * Encryption utility for API keys at rest
 *
 * Security Model:
 * - Encrypted API keys stored in Heroku Config Vars
 * - Master encryption key stored in GitHub Secrets
 * - Master key injected during deployment (not stored in Heroku)
 * - Provides defense in depth (requires breach of both Heroku AND GitHub)
 */

// Algorithm configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // AES-GCM uses 16 byte IV
const AUTH_TAG_LENGTH = 16; // GCM authentication tag
const SALT_LENGTH = 64; // Salt for key derivation

/**
 * Derive encryption key from master key using PBKDF2
 * This adds additional security by using key stretching
 */
function deriveKey(masterKey, salt) {
  return crypto.pbkdf2Sync(
    masterKey,
    salt,
    100000, // iterations (makes brute force harder)
    32, // key length (256 bits for AES-256)
    'sha256'
  );
}

/**
 * Encrypt a value using AES-256-GCM
 *
 * @param {string} plaintext - The value to encrypt
 * @param {string} masterKey - The master encryption key (from GitHub Secrets)
 * @returns {string} Encrypted value in format: salt:iv:authTag:ciphertext (all hex encoded)
 */
function encrypt(plaintext, masterKey) {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty value');
  }

  if (!masterKey || masterKey.length < 32) {
    throw new Error('Master key must be at least 32 characters long');
  }

  // Generate random salt for key derivation
  const salt = crypto.randomBytes(SALT_LENGTH);

  // Derive encryption key from master key
  const key = deriveKey(masterKey, salt);

  // Generate random IV (initialization vector)
  const iv = crypto.randomBytes(IV_LENGTH);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt the plaintext
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');

  // Get authentication tag (ensures integrity)
  const authTag = cipher.getAuthTag();

  // Return in format: salt:iv:authTag:ciphertext
  return [
    salt.toString('hex'),
    iv.toString('hex'),
    authTag.toString('hex'),
    ciphertext
  ].join(':');
}

/**
 * Decrypt a value using AES-256-GCM
 *
 * @param {string} encryptedValue - The encrypted value (salt:iv:authTag:ciphertext)
 * @param {string} masterKey - The master encryption key (from GitHub Secrets)
 * @returns {string} Decrypted plaintext
 */
function decrypt(encryptedValue, masterKey) {
  if (!encryptedValue) {
    throw new Error('Cannot decrypt empty value');
  }

  if (!masterKey || masterKey.length < 32) {
    throw new Error('Master key must be at least 32 characters long');
  }

  // Parse encrypted value
  const parts = encryptedValue.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted value format. Expected: salt:iv:authTag:ciphertext');
  }

  const [saltHex, ivHex, authTagHex, ciphertext] = parts;

  // Convert from hex
  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  // Derive the same encryption key
  const key = deriveKey(masterKey, salt);

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  // Set auth tag for verification
  decipher.setAuthTag(authTag);

  // Decrypt
  let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');

  return plaintext;
}

/**
 * Generate a random master encryption key
 * Use this to generate the initial master key
 *
 * @returns {string} Base64 encoded random key (44 characters)
 */
function generateMasterKey() {
  return crypto.randomBytes(32).toString('base64');
}

/**
 * Validate that encryption/decryption works correctly
 * Used for testing
 */
function testEncryption() {
  const masterKey = generateMasterKey();
  const testData = 'test-api-key-12345';

  console.log('Testing encryption utility...');
  console.log('Master Key:', masterKey);
  console.log('Original:', testData);

  const encrypted = encrypt(testData, masterKey);
  console.log('Encrypted:', encrypted);

  const decrypted = decrypt(encrypted, masterKey);
  console.log('Decrypted:', decrypted);

  if (testData === decrypted) {
    console.log('✅ Encryption test PASSED');
    return true;
  } else {
    console.log('❌ Encryption test FAILED');
    return false;
  }
}

module.exports = {
  encrypt,
  decrypt,
  generateMasterKey,
  testEncryption
};

// Allow running as CLI for testing
if (require.main === module) {
  testEncryption();
}
