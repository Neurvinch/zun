import { ethers } from 'ethers';
import axios from 'axios';

// 1inch API endpoints
const ONEINCH_API_BASE = 'https://api.1inch.dev';
const ONEINCH_SWAP_API = `${ONEINCH_API_BASE}/swap/v6.0`;
const ONEINCH_PRICE_API = `${ONEINCH_API_BASE}/price/v1.1`;
const ONEINCH_TOKENS_API = `${ONEINCH_API_BASE}/token/v1.2`;

// 1inch Router contract addresses
const ONEINCH_ROUTER_ADDRESSES = {
    1: '0x111111125421cA6dc452d289314280a0f8842A65', // Ethereum
    56: '0x111111125421cA6dc452d289314280a0f8842A65', // BSC
    137: '0x111111125421cA6dc452d289314280a0f8842A65', // Polygon
    42161: '0x111111125421cA6dc452d289314280a0f8842A65', // Arbitrum
    10: '0x111111125421cA6dc452d289314280a0f8842A65', // Optimism
    43114: '0x111111125421cA6dc452d289314280a0f8842A65', // Avalanche
    250: '0x111111125421cA6dc452d289314280a0f8842A65', // Fantom
    42220: '0x111111125421cA6dc452d289314280a0f8842A65', // Celo
    11155111: '0x111111125421cA6dc452d289314280a0f8842A65', // Sepolia
    44787: '0x111111125421cA6dc452d289314280a0f8842A65' // Celo Alfajores
};

class OneInchService {
    constructor() {
        this.apiKey = import.meta.env.VITE_ONEINCH_API_KEY;
        this.cache = new Map();
        this.priceCache = new Map();
        this.tokenCache = new Map();
        this.isInitialized = false;
        
        // Rate limiting
        this.lastRequestTime = 0;
        this.requestDelay = 100; // 100ms between requests
        
        // Default headers
        this.headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
        
        if (this.apiKey) {
            this.headers['Authorization'] = `Bearer ${this.apiKey}`;
        }
    }

    /**
     * Initialize 1inch service
     * @param {Number} chainId - Chain ID
     */
    async initialize(chainId) {
        try {
            // Check if 1inch supports this chain
            if (!ONEINCH_ROUTER_ADDRESSES[chainId]) {
                console.warn(`1inch not supported on chain ${chainId}`);
                return false;
            }

            // Load supported tokens for this chain
            await this.loadSupportedTokens(chainId);
            
            this.isInitialized = true;
            console.log(`1inch service initialized for chain ${chainId}`);
            return true;
            
        } catch (error) {
            console.error('1inch service initialization failed:', error);
            return false;
        }
    }

    /**
     * Rate limiting helper
     */
    async rateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.requestDelay) {
            await new Promise(resolve => 
                setTimeout(resolve, this.requestDelay - timeSinceLastRequest)
            );
        }
        
        this.lastRequestTime = Date.now();
    }

    /**
     * Load supported tokens for a chain
     * @param {Number} chainId - Chain ID
     */
    async loadSupportedTokens(chainId) {
        try {
            await this.rateLimit();
            
            const cacheKey = `tokens_${chainId}`;
            const cached = this.tokenCache.get(cacheKey);
            
            if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour cache
                return cached.data;
            }

            const response = await axios.get(`${ONEINCH_TOKENS_API}/${chainId}`, {
                headers: this.headers,
                timeout: 10000
            });

            const tokens = response.data.tokens || {};
            
            this.tokenCache.set(cacheKey, {
                data: tokens,
                timestamp: Date.now()
            });

            console.log(`Loaded ${Object.keys(tokens).length} tokens for chain ${chainId}`);
            return tokens;
            
        } catch (error) {
            console.error('Failed to load supported tokens:', error);
            return {};
        }
    }

    /**
     * Get token information
     * @param {String} tokenAddress - Token contract address
     * @param {Number} chainId - Chain ID
     * @returns {Object} - Token information
     */
    async getTokenInfo(tokenAddress, chainId) {
        try {
            const tokens = await this.loadSupportedTokens(chainId);
            const token = tokens[tokenAddress.toLowerCase()];
            
            if (!token) {
                // Fallback for unknown tokens
                return {
                    address: tokenAddress,
                    symbol: 'UNKNOWN',
                    name: 'Unknown Token',
                    decimals: 18,
                    logoURI: null
                };
            }

            return {
                address: token.address,
                symbol: token.symbol,
                name: token.name,
                decimals: token.decimals,
                logoURI: token.logoURI
            };
            
        } catch (error) {
            console.error('Token info fetch failed:', error);
            return null;
        }
    }

    /**
     * Get quote for token swap
     * @param {Object} params - Quote parameters
     * @returns {Object} - Quote data
     */
    async getQuote(params) {
        try {
            const {
                chainId,
                src,
                dst,
                amount,
                includeTokensInfo = true,
                includeProtocols = true,
                includeGas = true
            } = params;

            await this.rateLimit();

            const cacheKey = `quote_${chainId}_${src}_${dst}_${amount}`;
            const cached = this.cache.get(cacheKey);
            
            if (cached && Date.now() - cached.timestamp < 30000) { // 30 second cache
                return cached.data;
            }

            const queryParams = new URLSearchParams({
                src: src.toLowerCase(),
                dst: dst.toLowerCase(),
                amount: amount.toString(),
                includeTokensInfo: includeTokensInfo.toString(),
                includeProtocols: includeProtocols.toString(),
                includeGas: includeGas.toString()
            });

            const response = await axios.get(
                `${ONEINCH_SWAP_API}/${chainId}/quote?${queryParams}`,
                {
                    headers: this.headers,
                    timeout: 15000
                }
            );

            const quote = response.data;
            
            // Cache the result
            this.cache.set(cacheKey, {
                data: quote,
                timestamp: Date.now()
            });

            return quote;
            
        } catch (error) {
            console.error('Quote fetch failed:', error);
            throw new Error(`Quote fetch failed: ${error.response?.data?.description || error.message}`);
        }
    }

    /**
     * Get swap transaction data
     * @param {Object} params - Swap parameters
     * @returns {Object} - Swap transaction data
     */
    async getSwap(params) {
        try {
            const {
                chainId,
                src,
                dst,
                amount,
                from,
                slippage = 1, // 1% default slippage
                disableEstimate = false,
                allowPartialFill = false,
                includeTokensInfo = true,
                includeProtocols = true,
                includeGas = true,
                complexityLevel = 2,
                parts = 50,
                mainRouteParts = 50,
                gasLimit = 750000,
                connectorTokens = ''
            } = params;

            await this.rateLimit();

            const queryParams = new URLSearchParams({
                src: src.toLowerCase(),
                dst: dst.toLowerCase(),
                amount: amount.toString(),
                from: from.toLowerCase(),
                slippage: slippage.toString(),
                disableEstimate: disableEstimate.toString(),
                allowPartialFill: allowPartialFill.toString(),
                includeTokensInfo: includeTokensInfo.toString(),
                includeProtocols: includeProtocols.toString(),
                includeGas: includeGas.toString(),
                complexityLevel: complexityLevel.toString(),
                parts: parts.toString(),
                mainRouteParts: mainRouteParts.toString(),
                gasLimit: gasLimit.toString()
            });

            if (connectorTokens) {
                queryParams.append('connectorTokens', connectorTokens);
            }

            const response = await axios.get(
                `${ONEINCH_SWAP_API}/${chainId}/swap?${queryParams}`,
                {
                    headers: this.headers,
                    timeout: 20000
                }
            );

            return response.data;
            
        } catch (error) {
            console.error('Swap data fetch failed:', error);
            throw new Error(`Swap data fetch failed: ${error.response?.data?.description || error.message}`);
        }
    }

    /**
     * Get token prices
     * @param {Array} tokenAddresses - Array of token addresses
     * @param {Number} chainId - Chain ID
     * @param {String} currency - Currency for prices (default: USD)
     * @returns {Object} - Token prices
     */
    async getTokenPrices(tokenAddresses, chainId, currency = 'USD') {
        try {
            await this.rateLimit();

            const cacheKey = `prices_${chainId}_${tokenAddresses.join(',')}_${currency}`;
            const cached = this.priceCache.get(cacheKey);
            
            if (cached && Date.now() - cached.timestamp < 60000) { // 1 minute cache
                return cached.data;
            }

            const addresses = tokenAddresses.map(addr => addr.toLowerCase()).join(',');
            
            const response = await axios.get(
                `${ONEINCH_PRICE_API}/${chainId}/${addresses}?currency=${currency}`,
                {
                    headers: this.headers,
                    timeout: 10000
                }
            );

            const prices = response.data;
            
            this.priceCache.set(cacheKey, {
                data: prices,
                timestamp: Date.now()
            });

            return prices;
            
        } catch (error) {
            console.error('Price fetch failed:', error);
            return {};
        }
    }

    /**
     * Calculate price impact
     * @param {Object} quote - Quote data from 1inch
     * @param {String} inputAmount - Input amount
     * @param {String} outputAmount - Output amount
     * @returns {Number} - Price impact percentage
     */
    calculatePriceImpact(quote, inputAmount, outputAmount) {
        try {
            if (!quote || !inputAmount || !outputAmount) {
                return 0;
            }

            const expectedOutput = quote.dstAmount;
            const actualOutput = outputAmount;
            
            const impact = ((expectedOutput - actualOutput) / expectedOutput) * 100;
            return Math.max(0, impact);
            
        } catch (error) {
            console.error('Price impact calculation failed:', error);
            return 0;
        }
    }

    /**
     * Get optimal route information
     * @param {Object} quote - Quote data from 1inch
     * @returns {Object} - Route information
     */
    getRouteInfo(quote) {
        try {
            if (!quote || !quote.protocols) {
                return {
                    protocols: [],
                    complexity: 'unknown',
                    gasEstimate: '0'
                };
            }

            const protocols = [];
            
            // Extract protocol information
            quote.protocols.forEach(route => {
                route.forEach(hop => {
                    hop.forEach(protocol => {
                        if (!protocols.find(p => p.name === protocol.name)) {
                            protocols.push({
                                name: protocol.name,
                                part: protocol.part,
                                fromTokenAddress: protocol.fromTokenAddress,
                                toTokenAddress: protocol.toTokenAddress
                            });
                        }
                    });
                });
            });

            return {
                protocols: protocols,
                complexity: protocols.length > 3 ? 'high' : protocols.length > 1 ? 'medium' : 'low',
                gasEstimate: quote.estimatedGas || '0',
                routeString: protocols.map(p => p.name).join(' → ')
            };
            
        } catch (error) {
            console.error('Route info extraction failed:', error);
            return {
                protocols: [],
                complexity: 'unknown',
                gasEstimate: '0'
            };
        }
    }

    /**
     * Check if swap is profitable after gas costs
     * @param {Object} quote - Quote data
     * @param {String} gasPrice - Current gas price in wei
     * @param {String} ethPrice - ETH price in USD
     * @returns {Object} - Profitability analysis
     */
    analyzeProfitability(quote, gasPrice, ethPrice) {
        try {
            if (!quote || !gasPrice || !ethPrice) {
                return {
                    profitable: false,
                    gasCostUSD: '0',
                    netGainUSD: '0'
                };
            }

            const gasLimit = BigInt(quote.estimatedGas || '300000');
            const gasPriceBN = BigInt(gasPrice);
            const gasCostWei = gasLimit * gasPriceBN;
            const gasCostEth = Number(ethers.formatEther(gasCostWei));
            const gasCostUSD = gasCostEth * Number(ethPrice);

            // This would need actual USD values of input/output tokens
            // For now, return basic gas cost analysis
            return {
                profitable: gasCostUSD < 50, // Assume profitable if gas < $50
                gasCostUSD: gasCostUSD.toFixed(2),
                gasCostEth: gasCostEth.toFixed(6),
                estimatedGas: gasLimit.toString()
            };
            
        } catch (error) {
            console.error('Profitability analysis failed:', error);
            return {
                profitable: false,
                gasCostUSD: '0',
                netGainUSD: '0'
            };
        }
    }

    /**
     * Get router contract address for chain
     * @param {Number} chainId - Chain ID
     * @returns {String} - Router contract address
     */
    getRouterAddress(chainId) {
        return ONEINCH_ROUTER_ADDRESSES[chainId] || null;
    }

    /**
     * Validate swap parameters
     * @param {Object} params - Swap parameters
     * @returns {Object} - Validation result
     */
    validateSwapParams(params) {
        const errors = [];
        
        if (!params.src || !ethers.isAddress(params.src)) {
            errors.push('Invalid source token address');
        }
        
        if (!params.dst || !ethers.isAddress(params.dst)) {
            errors.push('Invalid destination token address');
        }
        
        if (!params.amount || BigInt(params.amount) <= 0) {
            errors.push('Invalid swap amount');
        }
        
        if (!params.from || !ethers.isAddress(params.from)) {
            errors.push('Invalid from address');
        }
        
        if (params.slippage && (params.slippage < 0.1 || params.slippage > 50)) {
            errors.push('Slippage must be between 0.1% and 50%');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Get service status
     * @returns {Object} - Service status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            hasApiKey: !!this.apiKey,
            supportedChains: Object.keys(ONEINCH_ROUTER_ADDRESSES).map(Number),
            cacheSize: this.cache.size,
            priceCacheSize: this.priceCache.size,
            tokenCacheSize: this.tokenCache.size,
            lastRequestTime: this.lastRequestTime
        };
    }

    /**
     * Clear all caches
     */
    clearCache() {
        this.cache.clear();
        this.priceCache.clear();
        this.tokenCache.clear();
        console.log('1inch service cache cleared');
    }

    /**
     * Get aggregated swap data for ZKVault integration
     * @param {Object} params - Swap parameters
     * @returns {Object} - Aggregated swap data
     */
    async getZKVaultSwapData(params) {
        try {
            // Get quote first
            const quote = await this.getQuote(params);
            
            // Get actual swap data
            const swap = await this.getSwap(params);
            
            // Get route information
            const routeInfo = this.getRouteInfo(quote);
            
            // Calculate price impact
            const priceImpact = this.calculatePriceImpact(
                quote,
                params.amount,
                quote.dstAmount
            );

            return {
                quote: quote,
                swap: swap,
                routeInfo: routeInfo,
                priceImpact: priceImpact,
                router: this.getRouterAddress(params.chainId),
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error('ZKVault swap data aggregation failed:', error);
            throw error;
        }
    }
}

export default new OneInchService();
