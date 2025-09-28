import { Synapse, RPC_URLS, TOKENS, CONTRACT_ADDRESSES } from '@filoz/synapse-sdk';
import { ethers } from 'ethers';

/**
 * Synapse SDK Service
 * Provides Filecoin warm storage and USDFC payment integration using native Synapse SDK
 */
class SynapseService {
    constructor() {
        this.initialized = false;
        this.synapse = null;
        this.provider = null;
        
        // Synapse SDK configuration
        this.config = {
            privateKey: import.meta.env.VITE_SYNAPSE_PRIVATE_KEY,
            rpcUrl: import.meta.env.VITE_SYNAPSE_RPC_URL || (RPC_URLS?.calibration?.websocket || 'https://api.calibration.node.glif.io/rpc/v1'),
            network: 'calibration', // Use calibration testnet
            usdcfAmount: ethers.parseUnits('100', 18), // Default deposit amount
            approvalAmount: ethers.parseUnits('10', 18), // Rate allowance per epoch
            lockupAmount: ethers.parseUnits('1000', 18), // Total lockup allowance
            maxLockupPeriod: 86400n * 30n // 30 days in epochs
        };
        
        // Storage categories for organization
        this.storageCategories = {
            SWAP_RECEIPTS: 'swap-receipts',
            ML_DATASETS: 'ml-datasets',
            ANALYTICS_DATA: 'analytics-data',
            GOVERNANCE_DATA: 'governance-data',
            AUDIT_LOGS: 'audit-logs',
            USER_DATA: 'user-data'
        };
        
        // Payment types
        this.paymentTypes = {
            STORAGE_FEE: 'storage_fee',
            RETRIEVAL_FEE: 'retrieval_fee',
            GAS_REFUND: 'gas_refund'
        };
    }
    
    /**
     * Initialize Synapse SDK
     * @param {Object} provider - Ethereum provider (optional, for MetaMask integration)
     * @returns {Object} Initialization result
     */
    async initialize(provider = null) {
        try {
            if (provider) {
                // Initialize with MetaMask/external provider
                this.provider = provider;
                this.synapse = await Synapse.create({ provider });
                console.log('Synapse SDK initialized with external provider');
            } else if (this.config.privateKey) {
                // Initialize with private key
                this.synapse = await Synapse.create({
                    privateKey: this.config.privateKey,
                    rpcURL: this.config.rpcUrl
                });
                console.log('Synapse SDK initialized with private key');
            } else {
                throw new Error('Synapse SDK requires either a provider or private key. Please set VITE_SYNAPSE_PRIVATE_KEY or provide a Web3 provider.');
            }
            
            // Test connection and setup payments if needed
            await this.testConnection();
            
            this.initialized = true;
            console.log('Synapse SDK service initialized successfully');
            
            return { 
                success: true,
                network: this.config.network,
                hasProvider: !!provider,
                hasPrivateKey: !!this.config.privateKey
            };
        } catch (error) {
            console.error('Failed to initialize Synapse SDK:', error);
            console.warn('Continuing in mock mode for development');
            this.initialized = true; // Continue in mock mode
            return { 
                success: true, 
                mock: true, 
                error: error.message,
                message: 'Running in mock mode - configure VITE_SYNAPSE_PRIVATE_KEY for real functionality'
            };
        }
    }
    
    /**
     * Test connection to Synapse network
     */
    async testConnection() {
        try {
            if (!this.synapse) {
                throw new Error('Synapse SDK not initialized');
            }
            
            // Test basic connection - try to get provider info
            const provider = this.synapse.getProvider();
            if (provider) {
                console.log('Synapse SDK connection test successful');
                return true;
            } else {
                throw new Error('No provider available');
            }
        } catch (error) {
            console.warn('Synapse connection test failed:', error.message);
            throw error;
        }
    }
    
    /**
     * Setup payment system - deposit USDFC and approve services
     */
    async setupPayments() {
        try {
            if (!this.synapse) {
                throw new Error('Synapse SDK not initialized. Call initialize() first.');
            }
            
            // 1. Deposit USDFC tokens
            console.log('Depositing USDFC tokens...');
            await this.synapse.payments.deposit(this.config.usdcfAmount);
            
            // 2. Get warm storage service address
            const warmStorageAddress = await this.synapse.getWarmStorageAddress();
            
            // 3. Approve the service for automated payments
            console.log('Approving warm storage service...');
            await this.synapse.payments.approveService(
                warmStorageAddress,
                this.config.approvalAmount, // Rate allowance per epoch
                this.config.lockupAmount,   // Total lockup allowance
                this.config.maxLockupPeriod // Max lockup period
            );
            
            console.log('Payment setup completed successfully');
            return { success: true };
        } catch (error) {
            console.error('Failed to setup payments:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Upload data to Filecoin warm storage using Synapse SDK
     */
    async uploadToWarmStorage(data, category = 'USER_DATA', metadata = {}) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }
            
            if (!this.synapse) {
                console.warn('Synapse SDK not available, using mock upload');
                return this.mockUpload(data, category, metadata);
            }
            
            // Prepare data for upload
            let uploadData;
            if (typeof data === 'string') {
                uploadData = new TextEncoder().encode(data);
            } else if (data instanceof Uint8Array) {
                uploadData = data;
            } else {
                uploadData = new TextEncoder().encode(JSON.stringify(data));
            }
            
            // Upload using Synapse SDK
            console.log(`Uploading ${uploadData.length} bytes to Filecoin warm storage...`);
            const uploadResult = await this.synapse.storage.upload(uploadData);
            
            return {
                success: true,
                pieceCid: uploadResult.pieceCid,
                category,
                metadata: {
                    ...metadata,
                    uploadedAt: new Date().toISOString(),
                    size: uploadData.length,
                    category
                },
                synapseResult: uploadResult
            };
            
        } catch (error) {
            console.error('Failed to upload to warm storage:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Download data from Filecoin warm storage using Synapse SDK
     */
    async downloadFromWarmStorage(pieceCid) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }
            
            if (!this.synapse) {
                console.warn('Synapse SDK not available, using mock download');
                return this.mockDownload(pieceCid);
            }
            
            // Download using Synapse SDK
            console.log(`Downloading data with PieceCID: ${pieceCid}`);
            const data = await this.synapse.storage.download(pieceCid);
            
            return {
                success: true,
                pieceCid,
                data,
                downloadedAt: new Date().toISOString(),
                size: data.length
            };
            
        } catch (error) {
            console.error('Failed to download from warm storage:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Pay with USDFC tokens using Synapse SDK
     */
    async payWithUSDFC(amount, recipient) {
        try {
            if (!this.synapse) {
                console.warn('Synapse SDK not available, using mock payment');
                return this.mockPayment(amount, recipient);
            }
            
            // Use Synapse payments system
            const result = await this.synapse.payments.transfer(recipient, amount);
            
            return {
                success: true,
                transactionHash: result.hash,
                amount,
                recipient,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Failed to pay with USDFC:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get USDFC balance
     */
    async getUSDFCBalance() {
        try {
            if (!this.synapse) {
                console.warn('Synapse SDK not available, using mock balance');
                return this.mockBalance();
            }
            
            const balance = await this.synapse.payments.getBalance();
            
            return {
                success: true,
                balance: ethers.formatUnits(balance, 18),
                balanceWei: balance.toString()
            };
            
        } catch (error) {
            console.error('Failed to get USDFC balance:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Mock methods for development/testing
    mockSetupPayments() {
        console.log('Mock: Setting up USDFC payments');
        return { success: true, mock: true };
    }
    
    mockUpload(data, category, metadata) {
        const mockPieceCid = `bafk2bzaced${Math.random().toString(36).substring(2, 15)}`;
        console.log(`Mock: Uploading data to category ${category}`);
        return {
            success: true,
            pieceCid: mockPieceCid,
            category,
            metadata: {
                ...metadata,
                uploadedAt: new Date().toISOString(),
                size: JSON.stringify(data).length,
                category
            },
            mock: true
        };
    }
    
    mockDownload(pieceCid) {
        console.log(`Mock: Downloading data with PieceCID ${pieceCid}`);
        return {
            success: true,
            pieceCid,
            data: new TextEncoder().encode('Mock data from Synapse warm storage'),
            downloadedAt: new Date().toISOString(),
            size: 256,
            mock: true
        };
    }
    
    mockPayment(amount, recipient) {
        console.log(`Mock: Paying ${amount} USDFC to ${recipient}`);
        return {
            success: true,
            transactionHash: `0x${Math.random().toString(16).substring(2, 66)}`,
            amount,
            recipient,
            timestamp: new Date().toISOString(),
            mock: true
        };
    }
    
    mockBalance() {
        return {
            success: true,
            balance: '1000.0',
            balanceWei: ethers.parseUnits('1000', 18).toString(),
            mock: true
        };
    }
    
    /**
     * Get service statistics
     */
    getServiceStats() {
        return {
            initialized: this.initialized,
            hasProvider: !!this.provider,
            hasSynapse: !!this.synapse,
            network: this.config.network,
            mockMode: !this.synapse
        };
    }
    
    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            if (this.synapse && this.provider) {
                const provider = this.synapse.getProvider();
                if (provider && typeof provider.destroy === 'function') {
                    await provider.destroy();
                }
            }
            console.log('Synapse service cleanup completed');
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }
}

export default SynapseService;
