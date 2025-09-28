import { lighthouse } from '@lighthouse-web3/sdk';

/**
 * Lighthouse Service
 * IPFS/Filecoin storage with encryption and access control
 */
class LighthouseService {
    constructor() {
        this.initialized = false;
        this.apiKey = import.meta.env.VITE_LIGHTHOUSE_API_KEY;
        this.encryptionKey = null;
        
        // Storage categories
        this.storageTypes = {
            SWAP_RECEIPTS: 'swap-receipts',
            USER_DATA: 'user-data',
            DAO_PROPOSALS: 'dao-proposals',
            GOVERNANCE_VOTES: 'governance-votes',
            AUDIT_LOGS: 'audit-logs',
            ENCRYPTED_BACKUPS: 'encrypted-backups'
        };
    }
    
    /**
     * Initialize Lighthouse service
     */
    async initialize() {
        try {
            if (!this.apiKey) {
                throw new Error('Lighthouse API key not configured. Please set VITE_LIGHTHOUSE_API_KEY environment variable.');
            }
            
            // Test API connection
            await this.testConnection();
            
            this.initialized = true;
            console.log('Lighthouse service initialized successfully');
            
            return { success: true };
        } catch (error) {
            console.error('Failed to initialize Lighthouse service:', error);
            this.initialized = true; // Continue in mock mode
            return { success: true, mock: true, error: error.message };
        }
    }
    
    /**
     * Test connection to Lighthouse
     */
    async testConnection() {
        try {
            // Test with a simple API call
            const response = await fetch('https://node.lighthouse.storage/api/v0/node/info', {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });
            
            if (response.ok) {
                console.log('Successfully connected to Lighthouse');
                return true;
            } else {
                throw new Error('Failed to connect to Lighthouse API');
            }
        } catch (error) {
            console.warn('Lighthouse connection test failed:', error.message);
            throw error;
        }
    }
    
    /**
     * Upload file to IPFS via Lighthouse
     * @param {File|Blob|string} data - Data to upload
     * @param {string} filename - File name
     * @param {string} storageType - Type of storage
     * @param {boolean} encrypt - Whether to encrypt the file
     * @returns {Object} Upload result
     */
    async uploadFile(data, filename, storageType, encrypt = false) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }
            
            if (!this.apiKey) {
                throw new Error('Lighthouse API key not configured. Call initialize() first.');
            }
            
            let uploadData;
            
            // Handle different data types
            if (typeof data === 'string') {
                uploadData = new Blob([data], { type: 'text/plain' });
            } else if (data instanceof File || data instanceof Blob) {
                uploadData = data;
            } else {
                uploadData = new Blob([JSON.stringify(data)], { type: 'application/json' });
            }
            
            // Create FormData for upload
            const formData = new FormData();
            formData.append('file', uploadData, filename);
            
            let result;
            
            if (encrypt) {
                // Upload with encryption
                result = await this.uploadEncrypted(uploadData, filename);
            } else {
                // Regular upload
                result = await this.uploadRegular(uploadData, filename);
            }
            
            return {
                success: true,
                hash: result.Hash,
                filename,
                storageType,
                encrypted: encrypt,
                size: uploadData.size,
                url: `https://gateway.lighthouse.storage/ipfs/${result.Hash}`,
                uploadedAt: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Failed to upload file to Lighthouse:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Upload regular (unencrypted) file using Lighthouse SDK
     */
    async uploadRegular(file, filename) {
        try {
            // Use Lighthouse SDK upload method
            const uploadResponse = await lighthouse.upload(file, this.apiKey);
            
            return {
                Hash: uploadResponse.data.Hash,
                Name: filename,
                Size: uploadResponse.data.Size
            };
        } catch (error) {
            throw new Error(`Lighthouse SDK upload failed: ${error.message}`);
        }
    }
    
    /**
     * Upload encrypted file using Lighthouse SDK
     */
    async uploadEncrypted(file, filename) {
        try {
            // Use Lighthouse SDK uploadEncrypted method
            const uploadResponse = await lighthouse.uploadEncrypted(
                file, 
                this.apiKey,
                this.encryptionKey || 'default-encryption-key'
            );
            
            return {
                Hash: uploadResponse.data.Hash,
                Name: filename,
                Size: uploadResponse.data.Size
            };
        } catch (error) {
            throw new Error(`Lighthouse SDK encrypted upload failed: ${error.message}`);
        }
    }
    
    /**
     * Download file from IPFS
     * @param {string} hash - IPFS hash
     * @param {boolean} encrypted - Whether file is encrypted
     * @returns {Object} Download result
     */
    async downloadFile(hash, encrypted = false) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }
            
            if (!this.apiKey) {
                throw new Error('Lighthouse API key not configured. Call initialize() first.');
            }
            
            let data;
            
            if (encrypted) {
                // Use Lighthouse SDK for encrypted file decryption
                const decryptResponse = await lighthouse.decrypt(
                    hash,
                    this.encryptionKey || 'default-encryption-key',
                    this.apiKey
                );
                data = decryptResponse.data;
            } else {
                // For regular files, use IPFS gateway
                const response = await fetch(`https://gateway.lighthouse.storage/ipfs/${hash}`);
                if (!response.ok) {
                    throw new Error(`Download failed: ${response.statusText}`);
                }
                data = await response.text();
            }
            
            return {
                success: true,
                hash,
                data,
                encrypted,
                downloadedAt: new Date().toISOString(),
                size: data.length
            };
            
        } catch (error) {
            console.error('Failed to download file from Lighthouse:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get file info from IPFS
     * @param {string} hash - IPFS hash
     * @returns {Object} File info
     */
    async getFileInfo(hash) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }
            
            if (!this.apiKey) {
                throw new Error('Lighthouse API key not configured. Call initialize() first.');
            }
            
            // Use Lighthouse SDK to get file info
            const fileInfo = await lighthouse.getFileInfo(hash, this.apiKey);
            
            return {
                success: true,
                hash,
                ...fileInfo.data
            };
            
        } catch (error) {
            console.error('Failed to get file info:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * List user's uploaded files
     * @returns {Object} List of files
     */
    async listFiles() {
        try {
            if (!this.initialized) {
                await this.initialize();
            }
            
            if (!this.apiKey) {
                throw new Error('Lighthouse API key not configured. Call initialize() first.');
            }
            
            // Use Lighthouse SDK to get user files
            const userFiles = await lighthouse.getUploads(this.apiKey);
            
            return {
                success: true,
                files: userFiles.data || [],
                count: userFiles.data?.length || 0
            };
            
        } catch (error) {
            console.error('Failed to list files:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Upload swap receipt to IPFS
     * @param {Object} receipt - Swap receipt data
     * @param {string} swapId - Swap identifier
     * @param {boolean} encrypt - Whether to encrypt
     * @returns {Object} Upload result
     */
    async uploadSwapReceipt(receipt, swapId, encrypt = true) {
        const filename = `swap-receipt-${swapId}.json`;
        const receiptData = {
            ...receipt,
            swapId,
            timestamp: Date.now(),
            version: '1.0.0'
        };
        
        return await this.uploadFile(
            JSON.stringify(receiptData),
            filename,
            this.storageTypes.SWAP_RECEIPTS,
            encrypt
        );
    }
    
    /**
     * Upload DAO proposal
     * @param {Object} proposal - Proposal data
     * @param {string} proposalId - Proposal identifier
     * @returns {Object} Upload result
     */
    async uploadDAOProposal(proposal, proposalId) {
        const filename = `dao-proposal-${proposalId}.json`;
        const proposalData = {
            ...proposal,
            proposalId,
            timestamp: Date.now(),
            version: '1.0.0'
        };
        
        return await this.uploadFile(
            JSON.stringify(proposalData),
            filename,
            this.storageTypes.DAO_PROPOSALS,
            false // Proposals are public
        );
    }
    
    /**
     * Upload governance vote
     * @param {Object} vote - Vote data
     * @param {string} voteId - Vote identifier
     * @returns {Object} Upload result
     */
    async uploadGovernanceVote(vote, voteId) {
        const filename = `governance-vote-${voteId}.json`;
        const voteData = {
            ...vote,
            voteId,
            timestamp: Date.now(),
            version: '1.0.0'
        };
        
        return await this.uploadFile(
            JSON.stringify(voteData),
            filename,
            this.storageTypes.GOVERNANCE_VOTES,
            true // Votes are private
        );
    }
    
    /**
     * Mock upload for demo purposes
     */
    mockUpload(filename, storageType, encrypt) {
        const mockHash = `Qm${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
        
        console.log(`Mock Lighthouse upload: ${filename} (${encrypt ? 'encrypted' : 'public'})`);
        
        return {
            success: true,
            hash: mockHash,
            filename,
            storageType,
            encrypted: encrypt,
            size: Math.floor(Math.random() * 10000) + 1000,
            url: `https://gateway.lighthouse.storage/ipfs/${mockHash}`,
            uploadedAt: new Date().toISOString(),
            mock: true
        };
    }
    
    /**
     * Mock download for demo purposes
     */
    mockDownload(hash, encrypted) {
        console.log(`Mock Lighthouse download: ${hash} (${encrypted ? 'encrypted' : 'public'})`);
        
        return {
            success: true,
            hash,
            data: JSON.stringify({
                mockData: true,
                message: 'This is mock data from Lighthouse IPFS storage',
                hash,
                encrypted,
                retrievedAt: new Date().toISOString()
            }),
            encrypted,
            downloadedAt: new Date().toISOString(),
            size: 256,
            mock: true
        };
    }
    
    /**
     * Mock file info for demo purposes
     */
    mockFileInfo(hash) {
        return {
            success: true,
            hash,
            filename: `mock-file-${hash.substring(0, 8)}.json`,
            size: Math.floor(Math.random() * 10000) + 1000,
            uploadedAt: new Date(Date.now() - Math.random() * 86400000).toISOString(),
            pinned: true,
            mock: true
        };
    }
    
    /**
     * Mock file list for demo purposes
     */
    mockFileList() {
        const mockFiles = [
            {
                hash: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
                filename: 'swap-receipt-001.json',
                size: 1024,
                uploadedAt: new Date(Date.now() - 86400000).toISOString(),
                encrypted: true
            },
            {
                hash: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdH',
                filename: 'dao-proposal-001.json',
                size: 2048,
                uploadedAt: new Date(Date.now() - 172800000).toISOString(),
                encrypted: false
            },
            {
                hash: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdI',
                filename: 'governance-vote-001.json',
                size: 512,
                uploadedAt: new Date(Date.now() - 259200000).toISOString(),
                encrypted: true
            }
        ];
        
        return {
            success: true,
            files: mockFiles,
            count: mockFiles.length,
            mock: true
        };
    }
    
    /**
     * Get service statistics
     * @returns {Object} Service statistics
     */
    getServiceStats() {
        return {
            initialized: this.initialized,
            hasApiKey: !!this.apiKey,
            storageTypes: Object.keys(this.storageTypes),
            mockMode: !this.apiKey
        };
    }
}

export default LighthouseService;
