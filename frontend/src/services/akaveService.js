/**
 * Akave Service
 * Native Akave Link API for AI/ML datasets and analytics storage
 */
class AkaveService {
    constructor() {
        this.initialized = false;
        this.apiClient = null;
        
        // Akave Link API configuration
        this.config = {
            apiBaseUrl: import.meta.env.VITE_AKAVE_API_URL || 'http://localhost:8000',
            bucketName: import.meta.env.VITE_AKAVE_BUCKET_NAME || 'zkvault-analytics',
            walletAddress: import.meta.env.VITE_AKAVE_WALLET_ADDRESS,
            privateKey: import.meta.env.VITE_AKAVE_PRIVATE_KEY
        };
        
        // Dataset categories
        this.datasetTypes = {
            SWAP_ANALYTICS: 'swap-analytics',
            PRICE_MODELS: 'price-models',
            SENTIMENT_DATA: 'sentiment-data',
            TRADING_PATTERNS: 'trading-patterns',
            RISK_MODELS: 'risk-models',
            ML_CHECKPOINTS: 'ml-checkpoints',
            FEATURE_SETS: 'feature-sets',
            BACKTEST_RESULTS: 'backtest-results'
        };
    }
    
    /**
     * Initialize Akave service
     */
    async initialize() {
        try {
            if (!this.config.apiBaseUrl) {
                throw new Error('Akave API URL not configured. Please set VITE_AKAVE_API_URL environment variable and ensure Akave Link Docker container is running.');
            }
            
            // Initialize API client
            this.apiClient = {
                baseURL: this.config.apiBaseUrl,
                request: async (method, endpoint, data = null) => {
                    try {
                        const response = await fetch(`${this.config.apiBaseUrl}${endpoint}`, {
                            method,
                            headers: {
                                'Content-Type': 'application/json',
                                ...(this.config.walletAddress && {
                                    'X-Wallet-Address': this.config.walletAddress
                                })
                            },
                            ...(data && { body: JSON.stringify(data) })
                        });
                        
                        if (!response.ok) {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }
                        
                        return await response.json();
                    } catch (error) {
                        console.error(`API request failed: ${method} ${endpoint}`, error);
                        throw error;
                    }
                }
            };
            
            // Test connection and create bucket if needed
            await this.testConnection();
            await this.ensureBucket();
            
            this.initialized = true;
            console.log('Akave Link API service initialized successfully');
            
            return { success: true };
        } catch (error) {
            console.error('Failed to initialize Akave service:', error);
            this.initialized = true; // Continue in mock mode
            return { success: true, mock: true, error: error.message };
        }
    }
    
    /**
     * Test connection to Akave Link API
     */
    async testConnection() {
        try {
            if (!this.apiClient) {
                throw new Error('API client not initialized');
            }
            
            // Test with bucket list endpoint
            await this.apiClient.request('GET', '/buckets');
            console.log('Successfully connected to Akave Link API');
            return true;
        } catch (error) {
            console.warn('Akave connection test failed:', error.message);
            throw error;
        }
    }
    
    /**
     * Ensure bucket exists, create if not
     */
    async ensureBucket() {
        try {
            if (!this.apiClient) {
                return false;
            }
            
            // Check if bucket exists
            try {
                await this.apiClient.request('GET', `/buckets/${this.config.bucketName}`);
                console.log(`Bucket ${this.config.bucketName} already exists`);
                return true;
            } catch (error) {
                // Bucket doesn't exist, create it
                if (error.message.includes('404')) {
                    await this.apiClient.request('POST', '/buckets', {
                        bucketName: this.config.bucketName
                    });
                    console.log(`Created bucket: ${this.config.bucketName}`);
                    return true;
                } else {
                    throw error;
                }
            }
        } catch (error) {
            console.error('Failed to ensure bucket exists:', error);
            return false;
        }
    }
    
    /**
     * Upload ML dataset to Akave
     * @param {Object} dataset - Dataset to upload
     * @param {string} datasetType - Type of dataset
     * @param {string} filename - File name
     * @param {Object} metadata - Additional metadata
     * @returns {Object} Upload result
     */
    async uploadMLDataset(dataset, datasetType, filename, metadata = {}) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }
            
            // Prepare dataset with metadata
            const datasetWithMeta = {
                data: dataset,
                metadata: {
                    ...metadata,
                    type: datasetType,
                    filename,
                    uploadedAt: new Date().toISOString(),
                    version: '1.0.0',
                    format: 'json',
                    size: JSON.stringify(dataset).length
                }
            };
            
            const fileContent = JSON.stringify(datasetWithMeta);
            const fullFilename = `${datasetType}/${filename}`;
            
            if (!this.apiClient) {
                throw new Error('Akave API client not initialized. Call initialize() first.');
            }
            
            // Create FormData for file upload
            const formData = new FormData();
            const blob = new Blob([fileContent], { type: 'application/json' });
            formData.append('file', blob, fullFilename);
            
            // Upload using Akave Link API
            const response = await fetch(`${this.config.apiBaseUrl}/buckets/${this.config.bucketName}/files`, {
                method: 'POST',
                body: formData,
                headers: {
                    ...(this.config.walletAddress && {
                        'X-Wallet-Address': this.config.walletAddress
                    })
                }
            });
            
            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            return {
                success: true,
                filename: fullFilename,
                datasetType,
                size: fileContent.length,
                hash: result.hash || result.id,
                url: `${this.config.apiBaseUrl}/buckets/${this.config.bucketName}/files/${fullFilename}/download`,
                uploadedAt: new Date().toISOString(),
                akaveResult: result
            };
            
        } catch (error) {
            console.error('Failed to upload ML dataset:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Download ML dataset from Akave
     * @param {string} filename - File name to download
     * @returns {Object} Download result
     */
    async downloadMLDataset(filename) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }
            
            if (!this.apiClient) {
                throw new Error('Akave API client not initialized. Call initialize() first.');
            }
            
            // Download using Akave Link API
            const response = await fetch(`${this.config.apiBaseUrl}/buckets/${this.config.bucketName}/files/${filename}/download`, {
                method: 'GET',
                headers: {
                    ...(this.config.walletAddress && {
                        'X-Wallet-Address': this.config.walletAddress
                    })
                }
            });
            
            if (!response.ok) {
                throw new Error(`Download failed: ${response.statusText}`);
            }
            
            const fileContent = await response.text();
            const dataset = JSON.parse(fileContent);
            
            return {
                success: true,
                filename,
                dataset: dataset.data,
                metadata: dataset.metadata,
                downloadedAt: new Date().toISOString(),
                size: fileContent.length
            };
            
        } catch (error) {
            console.error('Failed to download ML dataset:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * List stored datasets
     * @param {string} datasetType - Optional type filter
     * @returns {Object} List of datasets
     */
    async listDatasets(datasetType = null) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }
            
            if (!this.apiClient) {
                throw new Error('Akave API client not initialized. Call initialize() first.');
            }
            
            // List files using Akave Link API
            const response = await fetch(`${this.config.apiBaseUrl}/buckets/${this.config.bucketName}/files`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.config.walletAddress && {
                        'X-Wallet-Address': this.config.walletAddress
                    })
                }
            });
            
            if (!response.ok) {
                throw new Error(`List failed: ${response.statusText}`);
            }
            
            const result = await response.json();
            const files = result.files || result.data || [];
            
            // Filter and format datasets
            let datasets = files.map(file => ({
                filename: file.name || file.filename,
                datasetType: file.name ? file.name.split('/')[0] : 'unknown',
                size: file.size || 0,
                lastModified: file.lastModified || file.created_at,
                hash: file.hash || file.id,
                url: `${this.config.apiBaseUrl}/buckets/${this.config.bucketName}/files/${file.name || file.filename}/download`
            }));
            
            // Apply type filter if specified
            if (datasetType) {
                datasets = datasets.filter(d => d.datasetType === datasetType);
            }
            
            return {
                success: true,
                datasets,
                count: datasets.length,
                datasetType,
                akaveResult: result
            };
            
        } catch (error) {
            console.error('Failed to list datasets:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Generate presigned URL for dataset access
     * @param {string} key - Object key
     * @param {number} expiresIn - URL expiration in seconds
     * @returns {Object} Presigned URL result
     */
    async generatePresignedUrl(key, expiresIn = 3600) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }
            
            if (!this.s3Client) {
                // Mock mode
                return {
                    success: true,
                    url: `${this.config.endpoint}/${this.config.bucketName}/${key}?mock=true`,
                    expiresIn,
                    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
                };
            }
            
            const command = new GetObjectCommand({
                Bucket: this.config.bucketName,
                Key: key
            });
            
            const url = await getSignedUrl(this.s3Client, command, { expiresIn });
            
            return {
                success: true,
                url,
                expiresIn,
                expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
            };
            
        } catch (error) {
            console.error('Failed to generate presigned URL:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Delete dataset from Akave O3
     * @param {string} key - Object key
     * @returns {Object} Delete result
     */
    async deleteDataset(key) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }
            
            if (!this.s3Client) {
                // Mock mode
                return {
                    success: true,
                    key,
                    deletedAt: new Date().toISOString(),
                    mock: true
                };
            }
            
            const command = new DeleteObjectCommand({
                Bucket: this.config.bucketName,
                Key: key
            });
            
            await this.s3Client.send(command);
            
            return {
                success: true,
                key,
                deletedAt: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Failed to delete dataset:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Upload analytics checkpoint
     * @param {Object} checkpoint - ML model checkpoint
     * @param {string} modelName - Model name
     * @param {string} version - Model version
     * @returns {Object} Upload result
     */
    async uploadCheckpoint(checkpoint, modelName, version) {
        const filename = `${modelName}-v${version}-checkpoint.json`;
        return await this.uploadMLDataset(
            checkpoint,
            this.datasetTypes.ML_CHECKPOINTS,
            filename,
            { modelName, version, type: 'checkpoint' }
        );
    }
    
    /**
     * Upload trading analytics
     * @param {Object} analytics - Trading analytics data
     * @param {string} timeframe - Analytics timeframe
     * @returns {Object} Upload result
     */
    async uploadTradingAnalytics(analytics, timeframe) {
        const filename = `trading-analytics-${timeframe}-${Date.now()}.json`;
        return await this.uploadMLDataset(
            analytics,
            this.datasetTypes.SWAP_ANALYTICS,
            filename,
            { timeframe, type: 'trading-analytics' }
        );
    }
    
    /**
     * Upload price prediction model
     * @param {Object} model - Price prediction model
     * @param {string} asset - Target asset
     * @returns {Object} Upload result
     */
    async uploadPriceModel(model, asset) {
        const filename = `price-model-${asset}-${Date.now()}.json`;
        return await this.uploadMLDataset(
            model,
            this.datasetTypes.PRICE_MODELS,
            filename,
            { asset, type: 'price-model' }
        );
    }
    
    /**
     * Mock upload for demo purposes
     */
    mockUpload(key, body, datasetType) {
        console.log(`Mock upload: ${key} (${body.length} bytes)`);
        return {
            success: true,
            key,
            filename: key.split('/').pop(),
            datasetType,
            size: body.length,
            etag: `"${Math.random().toString(36).substring(2)}"`,
            url: `${this.config.endpoint}/${this.config.bucketName}/${key}`,
            uploadedAt: new Date().toISOString(),
            mock: true
        };
    }
    
    /**
     * Mock download for demo purposes
     */
    mockDownload(key) {
        console.log(`Mock download: ${key}`);
        return {
            success: true,
            key,
            dataset: {
                mockData: true,
                message: 'This is mock ML dataset from Akave O3',
                key,
                generatedAt: new Date().toISOString()
            },
            metadata: {
                type: key.split('/')[0],
                filename: key.split('/').pop(),
                uploadedAt: new Date(Date.now() - 86400000).toISOString(),
                version: '1.0.0',
                format: 'json',
                size: 1024
            },
            downloadedAt: new Date().toISOString(),
            size: 1024,
            mock: true
        };
    }
    
    /**
     * Mock list for demo purposes
     */
    mockList(datasetType) {
        const mockDatasets = [
            {
                key: 'swap-analytics/eth-usdc-analytics-2024.json',
                filename: 'eth-usdc-analytics-2024.json',
                datasetType: 'swap-analytics',
                size: 2048,
                lastModified: new Date(Date.now() - 86400000),
                etag: '"mock-etag-1"'
            },
            {
                key: 'price-models/btc-prediction-model-v2.json',
                filename: 'btc-prediction-model-v2.json',
                datasetType: 'price-models',
                size: 4096,
                lastModified: new Date(Date.now() - 172800000),
                etag: '"mock-etag-2"'
            },
            {
                key: 'ml-checkpoints/sentiment-model-v1-checkpoint.json',
                filename: 'sentiment-model-v1-checkpoint.json',
                datasetType: 'ml-checkpoints',
                size: 8192,
                lastModified: new Date(Date.now() - 259200000),
                etag: '"mock-etag-3"'
            }
        ];
        
        const filteredDatasets = datasetType ? 
            mockDatasets.filter(d => d.datasetType === datasetType) : 
            mockDatasets;
        
        return {
            success: true,
            datasets: filteredDatasets,
            count: filteredDatasets.length,
            datasetType,
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
            endpoint: this.config.endpoint,
            bucketName: this.config.bucketName,
            region: this.config.region,
            hasCredentials: !!(this.config.accessKeyId && this.config.secretAccessKey),
            datasetTypes: Object.keys(this.datasetTypes),
            mockMode: !this.s3Client
        };
    }
}

export default AkaveService;
