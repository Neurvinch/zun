import axios from 'axios';
import { ethers } from 'ethers';

/**
 * Live Data Integration Service
 * Connects to real-world APIs with cryptographic proof validation
 */
class LiveDataService {
    constructor() {
        this.initialized = false;
        this.apiKeys = {
            coinGecko: null, // CoinGecko is free for basic usage
            newsApi: import.meta.env.VITE_NEWS_API_KEY,
            alphavantage: import.meta.env.VITE_ALPHAVANTAGE_API_KEY,
            polygon: import.meta.env.VITE_POLYGON_API_KEY
        };
        
        this.endpoints = {
            coinGecko: 'https://api.coingecko.com/api/v3',
            newsApi: 'https://newsapi.org/v2',
            alphavantage: 'https://www.alphavantage.co/query',
            polygon: 'https://api.polygon.io/v2',
            ethGasStation: 'https://ethgasstation.info/api',
            defiPulse: 'https://data-api.defipulse.com/api/v1'
        };
        
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.proofStore = new Map();
    }
    
    /**
     * Initialize the live data service
     */
    async initialize() {
        try {
            // Test connectivity to available APIs
            await this.testApiConnectivity();
            
            this.initialized = true;
            console.log('Live data service initialized successfully');
            
            return { success: true };
        } catch (error) {
            console.error('Failed to initialize live data service:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Test connectivity to various APIs
     */
    async testApiConnectivity() {
        const tests = [];
        
        // Test CoinGecko (no API key required)
        tests.push(
            axios.get(`${this.endpoints.coinGecko}/ping`, { timeout: 5000 })
                .then(() => ({ api: 'CoinGecko', status: 'connected' }))
                .catch(() => ({ api: 'CoinGecko', status: 'failed' }))
        );
        
        // Test Ethereum Gas Station
        tests.push(
            axios.get(`${this.endpoints.ethGasStation}/ethgasAPI.json`, { timeout: 5000 })
                .then(() => ({ api: 'ETH Gas Station', status: 'connected' }))
                .catch(() => ({ api: 'ETH Gas Station', status: 'failed' }))
        );
        
        const results = await Promise.all(tests);
        console.log('API connectivity test results:', results);
        
        return results;
    }
    
    /**
     * Get live cryptocurrency prices with proof
     * @param {Array} tokens - Array of token IDs
     * @param {string} currency - Currency (default: usd)
     * @returns {Object} Price data with cryptographic proof
     */
    async getLivePriceData(tokens = ['bitcoin', 'ethereum'], currency = 'usd') {
        try {
            if (!this.initialized) {
                throw new Error('Live data service not initialized');
            }
            
            const cacheKey = `prices_${tokens.join(',')}_${currency}`;
            
            // Check cache first
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return { success: true, ...cached.data, fromCache: true };
                }
            }
            
            // Fetch live data from CoinGecko
            const response = await axios.get(`${this.endpoints.coinGecko}/simple/price`, {
                params: {
                    ids: tokens.join(','),
                    vs_currencies: currency,
                    include_market_cap: true,
                    include_24hr_vol: true,
                    include_24hr_change: true,
                    include_last_updated_at: true
                },
                timeout: 10000
            });
            
            // Generate cryptographic proof
            const proof = await this.generateDataProof(response.data, 'coingecko_prices');
            
            // Validate data integrity
            const validation = this.validatePriceData(response.data);
            
            const result = {
                source: 'CoinGecko API',
                timestamp: Date.now(),
                data: response.data,
                proof,
                validation,
                metadata: {
                    tokens,
                    currency,
                    apiEndpoint: `${this.endpoints.coinGecko}/simple/price`,
                    requestTime: new Date().toISOString()
                }
            };
            
            // Cache the result
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });
            
            return { success: true, ...result };
            
        } catch (error) {
            console.error('Failed to get live price data:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get live gas prices from Ethereum network
     * @returns {Object} Gas price data with proof
     */
    async getLiveGasPrices() {
        try {
            if (!this.initialized) {
                throw new Error('Live data service not initialized');
            }
            
            const cacheKey = 'gas_prices';
            
            // Check cache first
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < 30000) { // 30 second cache for gas prices
                    return { success: true, ...cached.data, fromCache: true };
                }
            }
            
            // Fetch from ETH Gas Station
            const response = await axios.get(`${this.endpoints.ethGasStation}/ethgasAPI.json`, {
                timeout: 10000
            });
            
            // Generate proof
            const proof = await this.generateDataProof(response.data, 'eth_gas_prices');
            
            // Validate data
            const validation = this.validateGasData(response.data);
            
            const result = {
                source: 'ETH Gas Station',
                timestamp: Date.now(),
                data: {
                    fast: response.data.fast / 10, // Convert to Gwei
                    standard: response.data.standard / 10,
                    safeLow: response.data.safeLow / 10,
                    fastest: response.data.fastest / 10,
                    blockTime: response.data.block_time,
                    blockNumber: response.data.blockNum
                },
                proof,
                validation,
                metadata: {
                    apiEndpoint: `${this.endpoints.ethGasStation}/ethgasAPI.json`,
                    requestTime: new Date().toISOString()
                }
            };
            
            // Cache the result
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });
            
            return { success: true, ...result };
            
        } catch (error) {
            console.error('Failed to get live gas prices:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get live DeFi TVL data
     * @param {string} protocol - Protocol name (optional)
     * @returns {Object} DeFi data with proof
     */
    async getLiveDeFiData(protocol = null) {
        try {
            if (!this.initialized) {
                throw new Error('Live data service not initialized');
            }
            
            // For demo, we'll use CoinGecko's DeFi data endpoint
            const endpoint = protocol ? 
                `${this.endpoints.coinGecko}/coins/${protocol}` :
                `${this.endpoints.coinGecko}/global/decentralized_finance_defi`;
            
            const response = await axios.get(endpoint, { timeout: 10000 });
            
            // Generate proof
            const proof = await this.generateDataProof(response.data, 'defi_data');
            
            // Validate data
            const validation = this.validateDeFiData(response.data);
            
            const result = {
                source: 'CoinGecko DeFi API',
                timestamp: Date.now(),
                data: response.data,
                proof,
                validation,
                metadata: {
                    protocol,
                    apiEndpoint: endpoint,
                    requestTime: new Date().toISOString()
                }
            };
            
            return { success: true, ...result };
            
        } catch (error) {
            console.error('Failed to get live DeFi data:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get live news sentiment data
     * @param {string} query - Search query
     * @param {number} pageSize - Number of articles
     * @returns {Object} News data with sentiment analysis and proof
     */
    async getLiveNewsData(query = 'cryptocurrency', pageSize = 20) {
        try {
            if (!this.initialized) {
                throw new Error('Live data service not initialized');
            }
            
            if (!this.apiKeys.newsApi) {
                throw new Error('News API key not configured. Please set VITE_NEWS_API_KEY environment variable.');
            }
            
            const cacheKey = `news_${query}_${pageSize}`;
            
            // Check cache first
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return { success: true, ...cached.data, fromCache: true };
                }
            }
            
            // Fetch from News API
            const response = await axios.get(`${this.endpoints.newsApi}/everything`, {
                params: {
                    q: query,
                    pageSize,
                    sortBy: 'publishedAt',
                    language: 'en'
                },
                headers: {
                    'X-API-Key': this.apiKeys.newsApi
                },
                timeout: 10000
            });
            
            // Analyze sentiment
            const sentimentAnalysis = this.analyzeSentiment(response.data.articles);
            
            // Generate proof
            const proof = await this.generateDataProof(response.data, 'news_data');
            
            // Validate data
            const validation = this.validateNewsData(response.data);
            
            const result = {
                source: 'News API',
                timestamp: Date.now(),
                data: {
                    articles: response.data.articles,
                    totalResults: response.data.totalResults,
                    sentiment: sentimentAnalysis
                },
                proof,
                validation,
                metadata: {
                    query,
                    pageSize,
                    apiEndpoint: `${this.endpoints.newsApi}/everything`,
                    requestTime: new Date().toISOString()
                }
            };
            
            // Cache the result
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });
            
            return { success: true, ...result };
            
        } catch (error) {
            console.error('Failed to get live news data:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Generate cryptographic proof for data authenticity
     * @param {Object} data - Data to generate proof for
     * @param {string} dataType - Type of data
     * @returns {Object} Cryptographic proof
     */
    async generateDataProof(data, dataType) {
        try {
            const timestamp = Date.now();
            const dataString = JSON.stringify(data);
            
            // Create data hash
            const dataHash = ethers.utils.keccak256(
                ethers.utils.toUtf8Bytes(dataString)
            );
            
            // Create timestamp hash
            const timestampHash = ethers.utils.keccak256(
                ethers.utils.toUtf8Bytes(timestamp.toString())
            );
            
            // Create combined proof hash
            const proofHash = ethers.utils.keccak256(
                ethers.utils.concat([
                    ethers.utils.arrayify(dataHash),
                    ethers.utils.arrayify(timestampHash)
                ])
            );
            
            // Create merkle-like structure for integrity
            const merkleRoot = ethers.utils.keccak256(
                ethers.utils.concat([
                    ethers.utils.arrayify(proofHash),
                    ethers.utils.toUtf8Bytes(dataType)
                ])
            );
            
            const proof = {
                dataHash,
                timestampHash,
                proofHash,
                merkleRoot,
                timestamp,
                dataType,
                dataSize: dataString.length,
                algorithm: 'keccak256',
                version: '1.0'
            };
            
            // Store proof for later verification
            this.proofStore.set(proofHash, {
                proof,
                originalData: data,
                createdAt: timestamp
            });
            
            return proof;
            
        } catch (error) {
            console.error('Failed to generate data proof:', error);
            return {
                error: error.message,
                timestamp: Date.now(),
                dataType,
                verified: false
            };
        }
    }
    
    /**
     * Verify data proof
     * @param {Object} proof - Proof to verify
     * @param {Object} data - Original data to verify against
     * @returns {Object} Verification result
     */
    async verifyDataProof(proof, data) {
        try {
            const dataString = JSON.stringify(data);
            
            // Recreate data hash
            const expectedDataHash = ethers.utils.keccak256(
                ethers.utils.toUtf8Bytes(dataString)
            );
            
            // Recreate timestamp hash
            const expectedTimestampHash = ethers.utils.keccak256(
                ethers.utils.toUtf8Bytes(proof.timestamp.toString())
            );
            
            // Recreate proof hash
            const expectedProofHash = ethers.utils.keccak256(
                ethers.utils.concat([
                    ethers.utils.arrayify(expectedDataHash),
                    ethers.utils.arrayify(expectedTimestampHash)
                ])
            );
            
            // Verify hashes match
            const dataHashValid = proof.dataHash === expectedDataHash;
            const timestampHashValid = proof.timestampHash === expectedTimestampHash;
            const proofHashValid = proof.proofHash === expectedProofHash;
            
            const isValid = dataHashValid && timestampHashValid && proofHashValid;
            
            return {
                success: true,
                valid: isValid,
                checks: {
                    dataHash: dataHashValid,
                    timestampHash: timestampHashValid,
                    proofHash: proofHashValid
                },
                verifiedAt: Date.now()
            };
            
        } catch (error) {
            console.error('Failed to verify data proof:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Validate price data integrity
     * @param {Object} data - Price data to validate
     * @returns {Object} Validation result
     */
    validatePriceData(data) {
        const checks = {
            hasData: Object.keys(data).length > 0,
            validPrices: true,
            validTimestamps: true,
            reasonablePrices: true
        };
        
        for (const [token, tokenData] of Object.entries(data)) {
            if (typeof tokenData !== 'object') {
                checks.hasData = false;
                continue;
            }
            
            // Check for required price fields
            if (!tokenData.usd || typeof tokenData.usd !== 'number') {
                checks.validPrices = false;
            }
            
            // Check for reasonable price ranges (basic sanity check)
            if (tokenData.usd && (tokenData.usd <= 0 || tokenData.usd > 1000000)) {
                checks.reasonablePrices = false;
            }
            
            // Check timestamps
            if (tokenData.last_updated_at && tokenData.last_updated_at < Date.now() / 1000 - 3600) {
                checks.validTimestamps = false; // Data older than 1 hour
            }
        }
        
        const isValid = Object.values(checks).every(check => check === true);
        
        return {
            valid: isValid,
            checks,
            validatedAt: Date.now()
        };
    }
    
    /**
     * Validate gas data integrity
     * @param {Object} data - Gas data to validate
     * @returns {Object} Validation result
     */
    validateGasData(data) {
        const checks = {
            hasRequiredFields: !!(data.fast && data.standard && data.safeLow),
            reasonableValues: true,
            validBlockNumber: !!(data.blockNum && data.blockNum > 0)
        };
        
        // Check for reasonable gas price ranges (1-1000 Gwei)
        const gasPrices = [data.fast, data.standard, data.safeLow].map(p => p / 10);
        checks.reasonableValues = gasPrices.every(price => price >= 1 && price <= 1000);
        
        const isValid = Object.values(checks).every(check => check === true);
        
        return {
            valid: isValid,
            checks,
            validatedAt: Date.now()
        };
    }
    
    /**
     * Validate DeFi data integrity
     * @param {Object} data - DeFi data to validate
     * @returns {Object} Validation result
     */
    validateDeFiData(data) {
        const checks = {
            hasData: !!data,
            validStructure: true,
            reasonableValues: true
        };
        
        // Basic structure validation
        if (data && typeof data === 'object') {
            // Check for common DeFi data fields
            if (data.defi_market_cap !== undefined) {
                checks.reasonableValues = data.defi_market_cap > 0;
            }
        } else {
            checks.validStructure = false;
        }
        
        const isValid = Object.values(checks).every(check => check === true);
        
        return {
            valid: isValid,
            checks,
            validatedAt: Date.now()
        };
    }
    
    /**
     * Validate news data integrity
     * @param {Object} data - News data to validate
     * @returns {Object} Validation result
     */
    validateNewsData(data) {
        const checks = {
            hasArticles: !!(data.articles && Array.isArray(data.articles)),
            validArticleCount: data.articles ? data.articles.length > 0 : false,
            validArticleStructure: true
        };
        
        if (data.articles && Array.isArray(data.articles)) {
            // Check first few articles for valid structure
            const sampleArticles = data.articles.slice(0, 3);
            checks.validArticleStructure = sampleArticles.every(article => 
                article.title && article.publishedAt && article.source
            );
        }
        
        const isValid = Object.values(checks).every(check => check === true);
        
        return {
            valid: isValid,
            checks,
            validatedAt: Date.now()
        };
    }
    
    /**
     * Analyze sentiment of news articles
     * @param {Array} articles - Array of news articles
     * @returns {Object} Sentiment analysis
     */
    analyzeSentiment(articles) {
        if (!articles || !Array.isArray(articles)) {
            return { sentiment: 'neutral', confidence: 0, analysis: 'No articles to analyze' };
        }
        
        // Simple keyword-based sentiment analysis
        const positiveWords = ['rise', 'gain', 'bull', 'positive', 'growth', 'increase', 'surge', 'rally'];
        const negativeWords = ['fall', 'drop', 'bear', 'negative', 'decline', 'decrease', 'crash', 'dump'];
        
        let positiveScore = 0;
        let negativeScore = 0;
        let totalWords = 0;
        
        articles.forEach(article => {
            const text = `${article.title} ${article.description || ''}`.toLowerCase();
            const words = text.split(/\s+/);
            totalWords += words.length;
            
            words.forEach(word => {
                if (positiveWords.some(pw => word.includes(pw))) {
                    positiveScore++;
                }
                if (negativeWords.some(nw => word.includes(nw))) {
                    negativeScore++;
                }
            });
        });
        
        const totalSentimentWords = positiveScore + negativeScore;
        const sentimentRatio = totalSentimentWords > 0 ? positiveScore / totalSentimentWords : 0.5;
        
        let sentiment = 'neutral';
        if (sentimentRatio > 0.6) sentiment = 'bullish';
        else if (sentimentRatio < 0.4) sentiment = 'bearish';
        
        return {
            sentiment,
            confidence: Math.min(totalSentimentWords / articles.length, 1),
            scores: {
                positive: positiveScore,
                negative: negativeScore,
                neutral: articles.length - Math.min(positiveScore + negativeScore, articles.length)
            },
            ratio: sentimentRatio,
            totalArticles: articles.length,
            analyzedAt: Date.now()
        };
    }
    
    
    /**
     * Get all cached data
     * @returns {Object} All cached data
     */
    getAllCachedData() {
        const cachedData = {};
        
        for (const [key, value] of this.cache.entries()) {
            cachedData[key] = {
                ...value.data,
                cacheAge: Date.now() - value.timestamp,
                isExpired: Date.now() - value.timestamp > this.cacheTimeout
            };
        }
        
        return cachedData;
    }
    
    /**
     * Clear all cached data
     */
    clearCache() {
        this.cache.clear();
        console.log('Live data cache cleared');
    }
    
    /**
     * Get service statistics
     * @returns {Object} Service statistics
     */
    getServiceStats() {
        return {
            initialized: this.initialized,
            cacheSize: this.cache.size,
            proofStoreSize: this.proofStore.size,
            cacheTimeout: this.cacheTimeout,
            availableApis: Object.keys(this.endpoints),
            configuredApiKeys: Object.entries(this.apiKeys)
                .filter(([key, value]) => !!value)
                .map(([key]) => key)
        };
    }
}

export default LiveDataService;
