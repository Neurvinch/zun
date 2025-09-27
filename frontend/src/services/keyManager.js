import CryptoJS from 'crypto-js';
import { keccak256, toBytes } from 'viem';

class KeyManager {
    constructor() {
        this.sessionKeys = new Map();
        this.keyDerivationSalt = 'ZKVault_v1_KeyDerivation';
    }

    /**
     * Derive a deterministic private key from wallet signature
     * @param {String} walletSignature - Signature from user's wallet
     * @param {String} purpose - Purpose of the key (e.g., 'zk_proof', 'encryption')
     * @returns {String} - Derived private key
     */
    derivePrivateKey(walletSignature, purpose = 'zk_proof') {
        try {
            // Create a deterministic key using PBKDF2
            const keyMaterial = walletSignature + this.keyDerivationSalt + purpose;
            const derivedKey = CryptoJS.PBKDF2(keyMaterial, this.keyDerivationSalt, {
                keySize: 256/32,
                iterations: 10000,
                hasher: CryptoJS.algo.SHA256
            });

            return derivedKey.toString(CryptoJS.enc.Hex);
        } catch (error) {
            console.error('Key derivation failed:', error);
            throw new Error('Failed to derive private key');
        }
    }

    /**
     * Generate a secure random nonce
     * @param {Number} length - Length in bytes (default: 32)
     * @returns {String} - Random nonce in hex format
     */
    generateNonce(length = 32) {
        const randomBytes = CryptoJS.lib.WordArray.random(length);
        return randomBytes.toString(CryptoJS.enc.Hex);
    }

    /**
     * Generate a commitment hash for swap details
     * @param {Object} swapDetails - Swap details to commit to
     * @returns {String} - Commitment hash
     */
    generateCommitment(swapDetails) {
        const {
            tokenAddress,
            amount,
            userAddress,
            timestamp,
            nonce
        } = swapDetails;

        const commitmentData = JSON.stringify({
            tokenAddress: tokenAddress.toLowerCase(),
            amount: amount.toString(),
            userAddress: userAddress.toLowerCase(),
            timestamp,
            nonce
        });

        return CryptoJS.SHA256(commitmentData).toString(CryptoJS.enc.Hex);
    }

    /**
     * Create a nullifier to prevent double-spending
     * @param {String} privateKey - User's ZK private key
     * @param {String} nonce - Unique nonce for this transaction
     * @param {String} tokenAddress - Token contract address
     * @returns {String} - Nullifier hash
     */
    generateNullifier(privateKey, nonce, tokenAddress) {
        const nullifierData = privateKey + nonce + tokenAddress.toLowerCase();
        return CryptoJS.SHA256(nullifierData).toString(CryptoJS.enc.Hex);
    }

    /**
     * Encrypt sensitive data for storage
     * @param {Object} data - Data to encrypt
     * @param {String} password - Encryption password
     * @returns {String} - Encrypted data
     */
    encryptData(data, password) {
        try {
            const jsonString = JSON.stringify(data);
            const encrypted = CryptoJS.AES.encrypt(jsonString, password).toString();
            return encrypted;
        } catch (error) {
            console.error('Encryption failed:', error);
            throw new Error('Failed to encrypt data');
        }
    }

    /**
     * Decrypt sensitive data
     * @param {String} encryptedData - Encrypted data string
     * @param {String} password - Decryption password
     * @returns {Object} - Decrypted data
     */
    decryptData(encryptedData, password) {
        try {
            const decrypted = CryptoJS.AES.decrypt(encryptedData, password);
            const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
            return JSON.parse(jsonString);
        } catch (error) {
            console.error('Decryption failed:', error);
            throw new Error('Failed to decrypt data');
        }
    }

    /**
     * Store key in session memory (not persistent)
     * @param {String} keyId - Unique identifier for the key
     * @param {String} key - The key to store
     */
    storeSessionKey(keyId, key) {
        this.sessionKeys.set(keyId, {
            key,
            timestamp: Date.now()
        });
    }

    /**
     * Retrieve key from session memory
     * @param {String} keyId - Unique identifier for the key
     * @returns {String|null} - The stored key or null if not found
     */
    getSessionKey(keyId) {
        const keyData = this.sessionKeys.get(keyId);
        if (!keyData) return null;

        // Check if key is expired (24 hours)
        const isExpired = Date.now() - keyData.timestamp > 24 * 60 * 60 * 1000;
        if (isExpired) {
            this.sessionKeys.delete(keyId);
            return null;
        }

        return keyData.key;
    }

    /**
     * Clear all session keys
     */
    clearSessionKeys() {
        this.sessionKeys.clear();
    }

    /**
     * Generate a merkle tree leaf for user eligibility
     * @param {String} userAddress - User's wallet address
     * @param {String} eligibilityData - Additional eligibility data
     * @returns {String} - Merkle leaf hash
     */
    generateMerkleLeaf(userAddress, eligibilityData = '') {
        const leafData = userAddress.toLowerCase() + eligibilityData;
        return CryptoJS.SHA256(leafData).toString(CryptoJS.enc.Hex);
    }

    /**
     * Validate key format and strength
     * @param {String} key - Key to validate
     * @returns {Boolean} - True if key is valid
     */
    validateKey(key) {
        if (!key || typeof key !== 'string') return false;
        
        // Check if key is hex format and has minimum length
        const hexRegex = /^[0-9a-fA-F]+$/;
        return hexRegex.test(key) && key.length >= 64;
    }

    /**
     * Generate a secure seed for deterministic key generation
     * @param {String} userAddress - User's wallet address
     * @param {String} chainId - Blockchain chain ID
     * @returns {String} - Secure seed
     */
    generateSeed(userAddress, chainId) {
        const seedData = userAddress.toLowerCase() + chainId.toString() + this.keyDerivationSalt;
        return CryptoJS.SHA256(seedData).toString(CryptoJS.enc.Hex);
    }

    /**
     * Create a time-locked key that expires after a certain duration
     * @param {String} baseKey - Base key to time-lock
     * @param {Number} durationMs - Duration in milliseconds
     * @returns {Object} - Time-locked key object
     */
    createTimeLockedKey(baseKey, durationMs = 3600000) { // Default 1 hour
        const expirationTime = Date.now() + durationMs;
        const timeLockedData = {
            key: baseKey,
            expirationTime,
            isTimeLocked: true
        };

        return timeLockedData;
    }

    /**
     * Check if a time-locked key is still valid
     * @param {Object} timeLockedKey - Time-locked key object
     * @returns {Boolean} - True if key is still valid
     */
    isTimeLockedKeyValid(timeLockedKey) {
        if (!timeLockedKey.isTimeLocked) return true;
        return Date.now() < timeLockedKey.expirationTime;
    }

    /**
     * Generate a recovery phrase for key backup
     * @param {String} privateKey - Private key to backup
     * @returns {String} - Recovery phrase
     */
    generateRecoveryPhrase(privateKey) {
        // Simple implementation - in production, use BIP39 or similar
        const words = [
            'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot',
            'golf', 'hotel', 'india', 'juliet', 'kilo', 'lima'
        ];

        const keyHash = CryptoJS.SHA256(privateKey).toString(CryptoJS.enc.Hex);
        const phrase = [];

        for (let i = 0; i < 12; i++) {
            const index = parseInt(keyHash.substr(i * 2, 2), 16) % words.length;
            phrase.push(words[index]);
        }

        return phrase.join(' ');
    }

    /**
     * Recover private key from recovery phrase
     * @param {String} recoveryPhrase - Recovery phrase
     * @param {String} userAddress - User's wallet address for validation
     * @returns {String} - Recovered private key
     */
    recoverFromPhrase(recoveryPhrase, userAddress) {
        // This is a simplified implementation
        // In production, implement proper BIP39 recovery
        const phraseHash = CryptoJS.SHA256(recoveryPhrase + userAddress.toLowerCase());
        return phraseHash.toString(CryptoJS.enc.Hex);
    }
}

export default new KeyManager();
