import { ethers } from 'ethers';
import { create as createIPFS } from 'kubo-rpc-client';
import { Web3Storage } from 'web3.storage';
import { lighthouse } from '@lighthouse-web3/sdk';
import CryptoJS from 'crypto-js';

class FilecoinStorageService {
    constructor() {
        this.ipfsClient = null;
        this.web3Storage = null;
        this.lighthouseApiKey = import.meta.env.VITE_LIGHTHOUSE_API_KEY;
        this.web3StorageToken = import.meta.env.VITE_WEB3_STORAGE_TOKEN;
        this.isInitialized = false;
        
        // Storage providers configuration
        this.providers = {
            ipfs: {
                enabled: true,
                gateway: import.meta.env.VITE_IPFS_GATEWAY_URL || 'https://ipfs.io/ipfs/',
                api: import.meta.env.VITE_IPFS_API_URL || 'http://127.0.0.1:5001'
            },
            web3Storage: {
                enabled: !!this.web3StorageToken,
                maxFileSize: 32 * 1024 * 1024 * 1024 // 32GB
            },
            lighthouse: {
                enabled: !!this.lighthouseApiKey,
                maxFileSize: 100 * 1024 * 1024 // 100MB for free tier
            }
        };
        
        // Encryption settings
        this.encryptionConfig = {
            algorithm: 'AES-256-GCM',
            keyDerivation: 'PBKDF2',
            iterations: 100000
        };
        
        // Storage metadata
        this.storageIndex = new Map(); // CID -> metadata
        this.userStorage = new Map(); // userAddress -> storage records
    }

    /**
     * Initialize Filecoin storage service
     */
    async initialize() {
        try {
            // Initialize IPFS client
            if (this.providers.ipfs.enabled) {
                try {
                    this.ipfsClient = createIPFS({
                        url: this.providers.ipfs.api,
                        timeout: 10000
                    });
                    
                    // Test IPFS connection
                    await this.ipfsClient.version();
                    console.log('IPFS client initialized successfully');
                } catch (error) {
                    console.warn('IPFS client initialization failed, using gateway only:', error.message);
                    this.ipfsClient = null;
                }
            }

            // Initialize Web3.Storage
            if (this.providers.web3Storage.enabled) {
                try {
                    this.web3Storage = new Web3Storage({ token: this.web3StorageToken });
                    console.log('Web3.Storage client initialized successfully');
                } catch (error) {
                    console.warn('Web3.Storage initialization failed:', error.message);
                    this.web3Storage = null;
                }
            }

            this.isInitialized = true;
            console.log('Filecoin storage service initialized');
            return true;
            
        } catch (error) {
            console.error('Filecoin storage service initialization failed:', error);
            return false;
        }
    }

    /**
     * Encrypt data before storage
     * @param {Object} data - Data to encrypt
     * @param {String} password - Encryption password
     * @returns {Object} - Encrypted data with metadata
     */
    encryptData(data, password) {
        try {
            const dataString = JSON.stringify(data);
            const salt = CryptoJS.lib.WordArray.random(256/8);
            const iv = CryptoJS.lib.WordArray.random(128/8);
            
            // Derive key using PBKDF2
            const key = CryptoJS.PBKDF2(password, salt, {
                keySize: 256/32,
                iterations: this.encryptionConfig.iterations
            });
            
            // Encrypt data
            const encrypted = CryptoJS.AES.encrypt(dataString, key, {
                iv: iv,
                mode: CryptoJS.mode.GCM
            });
            
            return {
                encryptedData: encrypted.toString(),
                salt: salt.toString(),
                iv: iv.toString(),
                algorithm: this.encryptionConfig.algorithm,
                iterations: this.encryptionConfig.iterations,
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error('Data encryption failed:', error);
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }

    /**
     * Decrypt stored data
     * @param {Object} encryptedPackage - Encrypted data package
     * @param {String} password - Decryption password
     * @returns {Object} - Decrypted data
     */
    decryptData(encryptedPackage, password) {
        try {
            const { encryptedData, salt, iv, iterations } = encryptedPackage;
            
            // Derive key using same parameters
            const key = CryptoJS.PBKDF2(password, CryptoJS.enc.Hex.parse(salt), {
                keySize: 256/32,
                iterations: iterations || this.encryptionConfig.iterations
            });
            
            // Decrypt data
            const decrypted = CryptoJS.AES.decrypt(encryptedData, key, {
                iv: CryptoJS.enc.Hex.parse(iv),
                mode: CryptoJS.mode.GCM
            });
            
            const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
            return JSON.parse(decryptedString);
            
        } catch (error) {
            console.error('Data decryption failed:', error);
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }

    /**
     * Store transaction receipt on Filecoin/IPFS
     * @param {Object} receipt - Transaction receipt
     * @param {String} userAddress - User's wallet address
     * @param {String} encryptionKey - Encryption key
     * @returns {Object} - Storage result
     */
    async storeTransactionReceipt(receipt, userAddress, encryptionKey) {
        try {
            if (!this.isInitialized) {
                throw new Error('Storage service not initialized');
            }

            // Prepare receipt data
            const receiptData = {
                type: 'transaction_receipt',
                receipt: receipt,
                userAddress: userAddress.toLowerCase(),
                timestamp: Date.now(),
                version: '1.0',
                zkVaultMetadata: {
                    network: receipt.chainId || 'unknown',
                    blockNumber: receipt.blockNumber,
                    transactionHash: receipt.transactionHash,
                    gasUsed: receipt.gasUsed?.toString(),
                    status: receipt.status
                }
            };

            // Encrypt the receipt
            const encryptedPackage = this.encryptData(receiptData, encryptionKey);
            
            // Store using multiple providers for redundancy
            const storageResults = await this.storeWithMultipleProviders(
                encryptedPackage,
                `receipt_${receipt.transactionHash}_${Date.now()}.json`
            );

            // Update storage index
            const storageRecord = {
                type: 'transaction_receipt',
                cids: storageResults.map(r => r.cid),
                userAddress: userAddress.toLowerCase(),
                transactionHash: receipt.transactionHash,
                encrypted: true,
                timestamp: Date.now(),
                providers: storageResults.map(r => r.provider),
                size: JSON.stringify(encryptedPackage).length
            };

            this.updateStorageIndex(userAddress, storageRecord);

            return {
                success: true,
                storageRecord: storageRecord,
                cids: storageResults.map(r => r.cid),
                providers: storageResults.map(r => r.provider)
            };
            
        } catch (error) {
            console.error('Transaction receipt storage failed:', error);
            throw new Error(`Receipt storage failed: ${error.message}`);
        }
    }

    /**
     * Store ZK proof data
     * @param {Object} proofData - ZK proof data
     * @param {String} userAddress - User's wallet address
     * @param {String} encryptionKey - Encryption key
     * @returns {Object} - Storage result
     */
    async storeZKProof(proofData, userAddress, encryptionKey) {
        try {
            if (!this.isInitialized) {
                throw new Error('Storage service not initialized');
            }

            // Prepare proof data
            const zkProofPackage = {
                type: 'zk_proof',
                proof: proofData.proof,
                publicSignals: proofData.publicSignals,
                circuit: proofData.circuit || 'swapEligibility',
                userAddress: userAddress.toLowerCase(),
                timestamp: Date.now(),
                version: '1.0',
                metadata: {
                    proofType: proofData.proofType || 'swap_eligibility',
                    inputHash: proofData.inputHash,
                    commitment: proofData.commitment,
                    nullifier: proofData.nullifier
                }
            };

            // Encrypt the proof
            const encryptedPackage = this.encryptData(zkProofPackage, encryptionKey);
            
            // Store using multiple providers
            const storageResults = await this.storeWithMultipleProviders(
                encryptedPackage,
                `zkproof_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.json`
            );

            // Update storage index
            const storageRecord = {
                type: 'zk_proof',
                cids: storageResults.map(r => r.cid),
                userAddress: userAddress.toLowerCase(),
                proofType: proofData.proofType || 'swap_eligibility',
                encrypted: true,
                timestamp: Date.now(),
                providers: storageResults.map(r => r.provider),
                size: JSON.stringify(encryptedPackage).length
            };

            this.updateStorageIndex(userAddress, storageRecord);

            return {
                success: true,
                storageRecord: storageRecord,
                cids: storageResults.map(r => r.cid),
                providers: storageResults.map(r => r.provider)
            };
            
        } catch (error) {
            console.error('ZK proof storage failed:', error);
            throw new Error(`ZK proof storage failed: ${error.message}`);
        }
    }

    /**
     * Store swap metadata
     * @param {Object} swapData - Swap metadata
     * @param {String} userAddress - User's wallet address
     * @param {String} encryptionKey - Encryption key
     * @returns {Object} - Storage result
     */
    async storeSwapMetadata(swapData, userAddress, encryptionKey) {
        try {
            if (!this.isInitialized) {
                throw new Error('Storage service not initialized');
            }

            // Prepare swap metadata
            const swapMetadata = {
                type: 'swap_metadata',
                swapData: swapData,
                userAddress: userAddress.toLowerCase(),
                timestamp: Date.now(),
                version: '1.0',
                metadata: {
                    fromToken: swapData.fromToken,
                    toToken: swapData.toToken,
                    fromAmount: swapData.fromAmount,
                    toAmount: swapData.toAmount,
                    slippage: swapData.slippage,
                    route: swapData.route,
                    priceImpact: swapData.priceImpact
                }
            };

            // Encrypt the metadata
            const encryptedPackage = this.encryptData(swapMetadata, encryptionKey);
            
            // Store using multiple providers
            const storageResults = await this.storeWithMultipleProviders(
                encryptedPackage,
                `swap_metadata_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.json`
            );

            // Update storage index
            const storageRecord = {
                type: 'swap_metadata',
                cids: storageResults.map(r => r.cid),
                userAddress: userAddress.toLowerCase(),
                encrypted: true,
                timestamp: Date.now(),
                providers: storageResults.map(r => r.provider),
                size: JSON.stringify(encryptedPackage).length
            };

            this.updateStorageIndex(userAddress, storageRecord);

            return {
                success: true,
                storageRecord: storageRecord,
                cids: storageResults.map(r => r.cid),
                providers: storageResults.map(r => r.provider)
            };
            
        } catch (error) {
            console.error('Swap metadata storage failed:', error);
            throw new Error(`Swap metadata storage failed: ${error.message}`);
        }
    }

    /**
     * Store data using multiple providers for redundancy
     * @param {Object} data - Data to store
     * @param {String} filename - Filename
     * @returns {Array} - Storage results from all providers
     */
    async storeWithMultipleProviders(data, filename) {
        const results = [];
        const dataBlob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        
        // Try IPFS first
        if (this.ipfsClient) {
            try {
                const ipfsResult = await this.storeToIPFS(dataBlob, filename);
                results.push({
                    provider: 'ipfs',
                    cid: ipfsResult.cid,
                    success: true
                });
            } catch (error) {
                console.warn('IPFS storage failed:', error.message);
                results.push({
                    provider: 'ipfs',
                    success: false,
                    error: error.message
                });
            }
        }

        // Try Web3.Storage (Filecoin)
        if (this.web3Storage) {
            try {
                const web3Result = await this.storeToWeb3Storage(dataBlob, filename);
                results.push({
                    provider: 'web3storage',
                    cid: web3Result.cid,
                    success: true
                });
            } catch (error) {
                console.warn('Web3.Storage failed:', error.message);
                results.push({
                    provider: 'web3storage',
                    success: false,
                    error: error.message
                });
            }
        }

        // Try Lighthouse (Filecoin)
        if (this.providers.lighthouse.enabled) {
            try {
                const lighthouseResult = await this.storeToLighthouse(dataBlob, filename);
                results.push({
                    provider: 'lighthouse',
                    cid: lighthouseResult.cid,
                    success: true
                });
            } catch (error) {
                console.warn('Lighthouse storage failed:', error.message);
                results.push({
                    provider: 'lighthouse',
                    success: false,
                    error: error.message
                });
            }
        }

        // Ensure at least one provider succeeded
        const successfulResults = results.filter(r => r.success);
        if (successfulResults.length === 0) {
            throw new Error('All storage providers failed');
        }

        return successfulResults;
    }

    /**
     * Store data to IPFS
     * @param {Blob} dataBlob - Data blob
     * @param {String} filename - Filename
     * @returns {Object} - IPFS result
     */
    async storeToIPFS(dataBlob, filename) {
        try {
            const file = new File([dataBlob], filename, { type: 'application/json' });
            const result = await this.ipfsClient.add(file, {
                pin: true,
                wrapWithDirectory: false
            });
            
            return {
                cid: result.cid.toString(),
                path: result.path,
                size: result.size
            };
            
        } catch (error) {
            console.error('IPFS storage failed:', error);
            throw error;
        }
    }

    /**
     * Store data to Web3.Storage (Filecoin)
     * @param {Blob} dataBlob - Data blob
     * @param {String} filename - Filename
     * @returns {Object} - Web3.Storage result
     */
    async storeToWeb3Storage(dataBlob, filename) {
        try {
            const file = new File([dataBlob], filename, { type: 'application/json' });
            const cid = await this.web3Storage.put([file], {
                name: filename,
                maxRetries: 3
            });
            
            return {
                cid: cid.toString(),
                filename: filename
            };
            
        } catch (error) {
            console.error('Web3.Storage failed:', error);
            throw error;
        }
    }

    /**
     * Store data to Lighthouse (Filecoin)
     * @param {Blob} dataBlob - Data blob
     * @param {String} filename - Filename
     * @returns {Object} - Lighthouse result
     */
    async storeToLighthouse(dataBlob, filename) {
        try {
            const file = new File([dataBlob], filename, { type: 'application/json' });
            
            // Use native Lighthouse SDK upload method
            const uploadResponse = await lighthouse.upload(file, this.lighthouseApiKey);
            
            return {
                cid: uploadResponse.data.Hash,
                filename: filename,
                size: uploadResponse.data.Size
            };
            
        } catch (error) {
            console.error('Lighthouse storage failed:', error);
            throw error;
        }
    }

    /**
     * Retrieve data from storage
     * @param {String} cid - Content identifier
     * @param {String} encryptionKey - Decryption key
     * @returns {Object} - Retrieved and decrypted data
     */
    async retrieveData(cid, encryptionKey) {
        try {
            // Try multiple gateways for retrieval
            const gateways = [
                `${this.providers.ipfs.gateway}${cid}`,
                `https://gateway.pinata.cloud/ipfs/${cid}`,
                `https://cloudflare-ipfs.com/ipfs/${cid}`,
                `https://dweb.link/ipfs/${cid}`
            ];

            let encryptedData = null;
            
            for (const gateway of gateways) {
                try {
                    const response = await fetch(gateway, { timeout: 10000 });
                    if (response.ok) {
                        encryptedData = await response.json();
                        break;
                    }
                } catch (error) {
                    console.warn(`Gateway ${gateway} failed:`, error.message);
                    continue;
                }
            }

            if (!encryptedData) {
                throw new Error('Failed to retrieve data from all gateways');
            }

            // Decrypt the data
            const decryptedData = this.decryptData(encryptedData, encryptionKey);
            
            return {
                success: true,
                data: decryptedData,
                cid: cid,
                retrievedAt: Date.now()
            };
            
        } catch (error) {
            console.error('Data retrieval failed:', error);
            throw new Error(`Data retrieval failed: ${error.message}`);
        }
    }

    /**
     * Update storage index for user
     * @param {String} userAddress - User's wallet address
     * @param {Object} storageRecord - Storage record
     */
    updateStorageIndex(userAddress, storageRecord) {
        const userKey = userAddress.toLowerCase();
        
        if (!this.userStorage.has(userKey)) {
            this.userStorage.set(userKey, []);
        }
        
        this.userStorage.get(userKey).push(storageRecord);
        
        // Also update global index
        storageRecord.cids.forEach(cid => {
            this.storageIndex.set(cid, {
                userAddress: userKey,
                type: storageRecord.type,
                timestamp: storageRecord.timestamp,
                encrypted: storageRecord.encrypted
            });
        });
    }

    /**
     * Get user's storage records
     * @param {String} userAddress - User's wallet address
     * @returns {Array} - User's storage records
     */
    getUserStorageRecords(userAddress) {
        const userKey = userAddress.toLowerCase();
        return this.userStorage.get(userKey) || [];
    }

    /**
     * Get storage statistics
     * @param {String} userAddress - User's wallet address (optional)
     * @returns {Object} - Storage statistics
     */
    getStorageStats(userAddress = null) {
        if (userAddress) {
            const records = this.getUserStorageRecords(userAddress);
            const totalSize = records.reduce((sum, record) => sum + (record.size || 0), 0);
            
            return {
                totalRecords: records.length,
                totalSize: totalSize,
                byType: records.reduce((acc, record) => {
                    acc[record.type] = (acc[record.type] || 0) + 1;
                    return acc;
                }, {}),
                oldestRecord: Math.min(...records.map(r => r.timestamp)),
                newestRecord: Math.max(...records.map(r => r.timestamp))
            };
        } else {
            return {
                totalUsers: this.userStorage.size,
                totalRecords: this.storageIndex.size,
                providers: Object.keys(this.providers).filter(p => this.providers[p].enabled)
            };
        }
    }

    /**
     * Get service status
     * @returns {Object} - Service status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            providers: {
                ipfs: {
                    enabled: this.providers.ipfs.enabled,
                    connected: !!this.ipfsClient
                },
                web3Storage: {
                    enabled: this.providers.web3Storage.enabled,
                    connected: !!this.web3Storage
                },
                lighthouse: {
                    enabled: this.providers.lighthouse.enabled,
                    hasApiKey: !!this.lighthouseApiKey
                }
            },
            storageIndex: this.storageIndex.size,
            userStorage: this.userStorage.size,
            encryptionEnabled: true
        };
    }

    /**
     * Clear storage cache
     */
    clearCache() {
        this.storageIndex.clear();
        this.userStorage.clear();
        console.log('Storage cache cleared');
    }
}

export default new FilecoinStorageService();
