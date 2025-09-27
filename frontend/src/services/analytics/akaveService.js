import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Akave O3 Analytics Service
 * Provides S3-compatible storage for AI/ML datasets and analytics
 */
class AkaveService {
    constructor() {
        this.s3Client = null;
        this.bucketName = import.meta.env.VITE_AKAVE_BUCKET_NAME || 'zkvault-analytics';
        this.region = import.meta.env.VITE_AKAVE_REGION || 'us-east-1';
        this.endpoint = import.meta.env.VITE_AKAVE_ENDPOINT || 'https://gateway.akave.ai';
        this.initialized = false;
        
        // Analytics categories
        this.categories = {
            TRADING_SIGNALS: 'trading-signals',
            MARKET_DATA: 'market-data',
            ML_MODELS: 'ml-models',
            RISK_ANALYTICS: 'risk-analytics',
            PERFORMANCE_METRICS: 'performance-metrics',
            USER_BEHAVIOR: 'user-behavior',
            COMPLIANCE_REPORTS: 'compliance-reports'
        };
    }
    
    /**
     * Initialize Akave service with credentials
     * @param {string} accessKeyId - Akave access key
     * @param {string} secretAccessKey - Akave secret key
     */
    async initialize(accessKeyId, secretAccessKey) {
        try {
            this.s3Client = new S3Client({
                region: this.region,
                endpoint: this.endpoint,
                credentials: {
                    accessKeyId,
                    secretAccessKey
                },
                forcePathStyle: true
            });
            
            // Test connection
            await this.listDatasets('', 1);
            
            this.initialized = true;
            console.log('Akave service initialized successfully');
            
            return { success: true };
        } catch (error) {
            console.error('Failed to initialize Akave service:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Upload dataset to Akave storage
     * @param {Object} dataset - Dataset object to upload
     * @param {string} category - Dataset category
     * @param {string} filename - Filename for the dataset
     * @param {Object} metadata - Additional metadata
     * @returns {Object} Upload result
     */
    async uploadDataset(dataset, category, filename, metadata = {}) {
        try {
            if (!this.initialized) {
                throw new Error('Akave service not initialized');
            }
            
            // Prepare dataset with metadata
            const datasetWithMetadata = {
                data: dataset,
                metadata: {
                    ...metadata,
                    uploadedAt: new Date().toISOString(),
                    category,
                    version: '1.0.0',
                    format: 'json',
                    size: JSON.stringify(dataset).length
                }
            };
            
            // Create S3 key with category prefix
            const key = `${this.categories[category] || category}/${filename}`;
            
            // Convert to Uint8Array for browser-safe upload
            const encoder = new TextEncoder();
            const buffer = encoder.encode(JSON.stringify(datasetWithMetadata, null, 2));
            
            // Upload to Akave
            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: buffer,
                ContentType: 'application/json',
                Metadata: {
                    category,
                    uploadedBy: metadata.uploadedBy || 'anonymous',
                    version: metadata.version || '1.0.0'
                }
            });
            
            const result = await this.s3Client.send(command);
            
            return {
                success: true,
                key,
                etag: result.ETag,
                location: `${this.endpoint}/${this.bucketName}/${key}`,
                size: buffer.length
            };
            
        } catch (error) {
            console.error('Failed to upload dataset:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Download dataset from Akave storage
     * @param {string} key - Dataset key
     * @returns {Object} Dataset and metadata
     */
    async downloadDataset(key) {
        try {
            if (!this.initialized) {
                throw new Error('Akave service not initialized');
            }
            
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });
            
            const result = await this.s3Client.send(command);
            
            // Convert stream to string
            // Convert stream/body to text in a browser-safe way
            // result.Body can be a ReadableStream (browser) or Buffer/Uint8Array (node-like env)
            let text;
            const body = result.Body;
            if (body instanceof ReadableStream) {
                const arrayBuffer = await new Response(body).arrayBuffer();
                text = new TextDecoder().decode(arrayBuffer);
            } else if (body && typeof body.text === 'function') {
                // Some SDK responses may provide a text() helper
                text = await body.text();
            } else if (body instanceof Uint8Array || Array.isArray(body)) {
                const uint8 = body instanceof Uint8Array ? body : new Uint8Array(body);
                text = new TextDecoder().decode(uint8);
            } else {
                // Fallback: attempt to construct Response
                const arrayBuffer = await new Response(body).arrayBuffer();
                text = new TextDecoder().decode(arrayBuffer);
            }
            const datasetWithMetadata = JSON.parse(text);
            
            return {
                success: true,
                dataset: datasetWithMetadata.data,
                metadata: datasetWithMetadata.metadata,
                lastModified: result.LastModified,
                contentLength: result.ContentLength
            };
            
        } catch (error) {
            console.error('Failed to download dataset:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * List datasets in a category
     * @param {string} category - Category to list
     * @param {number} maxKeys - Maximum number of keys to return
     * @returns {Object} List of datasets
     */
    async listDatasets(category = '', maxKeys = 100) {
        try {
            if (!this.initialized) {
                throw new Error('Akave service not initialized');
            }
            
            const prefix = category ? `${this.categories[category] || category}/` : '';
            
            const command = new ListObjectsV2Command({
                Bucket: this.bucketName,
                Prefix: prefix,
                MaxKeys: maxKeys
            });
            
            const result = await this.s3Client.send(command);
            
            const datasets = (result.Contents || []).map(item => ({
                key: item.Key,
                size: item.Size,
                lastModified: item.LastModified,
                etag: item.ETag,
                category: this.extractCategoryFromKey(item.Key),
                filename: this.extractFilenameFromKey(item.Key)
            }));
            
            return {
                success: true,
                datasets,
                totalCount: result.KeyCount || 0,
                isTruncated: result.IsTruncated || false
            };
            
        } catch (error) {
            console.error('Failed to list datasets:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Delete dataset from Akave storage
     * @param {string} key - Dataset key to delete
     * @returns {Object} Deletion result
     */
    async deleteDataset(key) {
        try {
            if (!this.initialized) {
                throw new Error('Akave service not initialized');
            }
            
            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });
            
            await this.s3Client.send(command);
            
            return { success: true };
            
        } catch (error) {
            console.error('Failed to delete dataset:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Generate presigned URL for direct upload
     * @param {string} key - Object key
     * @param {number} expiresIn - URL expiration in seconds
     * @returns {Object} Presigned URL
     */
    async generateUploadUrl(key, expiresIn = 3600) {
        try {
            if (!this.initialized) {
                throw new Error('Akave service not initialized');
            }
            
            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });
            
            const url = await getSignedUrl(this.s3Client, command, { expiresIn });
            
            return { success: true, url };
            
        } catch (error) {
            console.error('Failed to generate upload URL:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Generate presigned URL for direct download
     * @param {string} key - Object key
     * @param {number} expiresIn - URL expiration in seconds
     * @returns {Object} Presigned URL
     */
    async generateDownloadUrl(key, expiresIn = 3600) {
        try {
            if (!this.initialized) {
                throw new Error('Akave service not initialized');
            }
            
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });
            
            const url = await getSignedUrl(this.s3Client, command, { expiresIn });
            
            return { success: true, url };
            
        } catch (error) {
            console.error('Failed to generate download URL:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Upload ML model to Akave
     * @param {Object} model - ML model data
     * @param {string} modelName - Name of the model
     * @param {Object} modelMetadata - Model metadata
     * @returns {Object} Upload result
     */
    async uploadMLModel(model, modelName, modelMetadata = {}) {
        try {
            const filename = `${modelName}-${Date.now()}.json`;
            const metadata = {
                ...modelMetadata,
                type: 'ml-model',
                framework: modelMetadata.framework || 'unknown',
                accuracy: modelMetadata.accuracy || 0,
                trainingData: modelMetadata.trainingData || 'unknown'
            };
            
            return await this.uploadDataset(model, 'ML_MODELS', filename, metadata);
            
        } catch (error) {
            console.error('Failed to upload ML model:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Store trading signals analytics
     * @param {Array} signals - Trading signals data
     * @param {string} timeframe - Timeframe for the signals
     * @param {Object} metadata - Additional metadata
     * @returns {Object} Storage result
     */
    async storeTradingSignals(signals, timeframe, metadata = {}) {
        try {
            const filename = `signals-${timeframe}-${Date.now()}.json`;
            const signalsMetadata = {
                ...metadata,
                timeframe,
                signalCount: signals.length,
                generatedAt: new Date().toISOString(),
                type: 'trading-signals'
            };
            
            return await this.uploadDataset(signals, 'TRADING_SIGNALS', filename, signalsMetadata);
            
        } catch (error) {
            console.error('Failed to store trading signals:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Store performance metrics
     * @param {Object} metrics - Performance metrics data
     * @param {string} period - Time period for metrics
     * @param {Object} metadata - Additional metadata
     * @returns {Object} Storage result
     */
    async storePerformanceMetrics(metrics, period, metadata = {}) {
        try {
            const filename = `metrics-${period}-${Date.now()}.json`;
            const metricsMetadata = {
                ...metadata,
                period,
                metricsType: 'performance',
                calculatedAt: new Date().toISOString(),
                type: 'performance-metrics'
            };
            
            return await this.uploadDataset(metrics, 'PERFORMANCE_METRICS', filename, metricsMetadata);
            
        } catch (error) {
            console.error('Failed to store performance metrics:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Analyze dataset and generate insights
     * @param {string} datasetKey - Key of the dataset to analyze
     * @returns {Object} Analysis results
     */
    async analyzeDataset(datasetKey) {
        try {
            const downloadResult = await this.downloadDataset(datasetKey);
            if (!downloadResult.success) {
                throw new Error(downloadResult.error);
            }
            
            const { dataset, metadata } = downloadResult;
            
            // Basic statistical analysis
            const analysis = {
                recordCount: Array.isArray(dataset) ? dataset.length : Object.keys(dataset).length,
                dataType: Array.isArray(dataset) ? 'array' : 'object',
                size: JSON.stringify(dataset).length,
                metadata: metadata,
                insights: []
            };
            
            // Generate insights based on data type
            if (metadata.category === 'trading-signals') {
                analysis.insights = this.analyzeTradingSignals(dataset);
            } else if (metadata.category === 'performance-metrics') {
                analysis.insights = this.analyzePerformanceMetrics(dataset);
            } else if (metadata.category === 'market-data') {
                analysis.insights = this.analyzeMarketData(dataset);
            }
            
            return { success: true, analysis };
            
        } catch (error) {
            console.error('Failed to analyze dataset:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Analyze trading signals data
     * @param {Array} signals - Trading signals data
     * @returns {Array} Analysis insights
     */
    analyzeTradingSignals(signals) {
        const insights = [];
        
        if (Array.isArray(signals) && signals.length > 0) {
            // Calculate signal distribution
            const signalTypes = {};
            signals.forEach(signal => {
                const type = signal.type || 'unknown';
                signalTypes[type] = (signalTypes[type] || 0) + 1;
            });
            
            insights.push({
                type: 'signal_distribution',
                data: signalTypes,
                description: 'Distribution of signal types'
            });
            
            // Calculate accuracy if available
            const accurateSignals = signals.filter(s => s.accuracy && s.accuracy > 0.7);
            if (accurateSignals.length > 0) {
                const avgAccuracy = accurateSignals.reduce((sum, s) => sum + s.accuracy, 0) / accurateSignals.length;
                insights.push({
                    type: 'accuracy_metrics',
                    data: { averageAccuracy: avgAccuracy, highAccuracyCount: accurateSignals.length },
                    description: 'Signal accuracy metrics'
                });
            }
        }
        
        return insights;
    }
    
    /**
     * Analyze performance metrics data
     * @param {Object} metrics - Performance metrics data
     * @returns {Array} Analysis insights
     */
    analyzePerformanceMetrics(metrics) {
        const insights = [];
        
        if (metrics.returns && Array.isArray(metrics.returns)) {
            const returns = metrics.returns;
            const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
            const volatility = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
            
            insights.push({
                type: 'return_analysis',
                data: { averageReturn: avgReturn, volatility: volatility, sharpeRatio: avgReturn / volatility },
                description: 'Return and risk analysis'
            });
        }
        
        return insights;
    }
    
    /**
     * Analyze market data
     * @param {Array} marketData - Market data
     * @returns {Array} Analysis insights
     */
    analyzeMarketData(marketData) {
        const insights = [];
        
        if (Array.isArray(marketData) && marketData.length > 0) {
            const prices = marketData.map(d => d.price).filter(p => p !== undefined);
            if (prices.length > 0) {
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);
                const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
                
                insights.push({
                    type: 'price_analysis',
                    data: { minPrice, maxPrice, avgPrice, priceRange: maxPrice - minPrice },
                    description: 'Price statistics'
                });
            }
        }
        
        return insights;
    }
    
    /**
     * Extract category from S3 key
     * @param {string} key - S3 object key
     * @returns {string} Category
     */
    extractCategoryFromKey(key) {
        const parts = key.split('/');
        return parts[0] || 'unknown';
    }
    
    /**
     * Extract filename from S3 key
     * @param {string} key - S3 object key
     * @returns {string} Filename
     */
    extractFilenameFromKey(key) {
        const parts = key.split('/');
        return parts[parts.length - 1] || key;
    }
    
    /**
     * Get storage statistics
     * @returns {Object} Storage statistics
     */
    async getStorageStats() {
        try {
            const categories = Object.keys(this.categories);
            const stats = {
                totalDatasets: 0,
                totalSize: 0,
                categoryCounts: {},
                recentUploads: []
            };
            
            for (const category of categories) {
                const listResult = await this.listDatasets(category);
                if (listResult.success) {
                    const categoryCount = listResult.datasets.length;
                    const categorySize = listResult.datasets.reduce((sum, d) => sum + d.size, 0);
                    
                    stats.totalDatasets += categoryCount;
                    stats.totalSize += categorySize;
                    stats.categoryCounts[category] = categoryCount;
                    
                    // Add recent uploads
                    const recent = listResult.datasets
                        .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
                        .slice(0, 5);
                    stats.recentUploads.push(...recent);
                }
            }
            
            // Sort recent uploads by date
            stats.recentUploads.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
            stats.recentUploads = stats.recentUploads.slice(0, 10);
            
            return { success: true, stats };
            
        } catch (error) {
            console.error('Failed to get storage stats:', error);
            return { success: false, error: error.message };
        }
    }
}

export default AkaveService;
