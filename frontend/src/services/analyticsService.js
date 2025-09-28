/**
 * Analytics Service
 * Handles user analytics, swap metrics, and performance tracking
 */
class AnalyticsService {
    constructor() {
        this.initialized = false;
        this.swapMetrics = new Map();
        this.userMetrics = new Map();
        this.systemMetrics = {
            totalSwaps: 0,
            totalVolume: '0',
            totalUsers: 0,
            averageSwapSize: '0',
            successRate: 0
        };
        
        // Performance tracking
        this.performanceMetrics = {
            avgSwapTime: 0,
            avgGasUsed: 0,
            zkProofTime: 0,
            storageTime: 0
        };
    }
    
    /**
     * Initialize analytics service
     */
    async initialize() {
        try {
            console.log('Initializing Analytics service...');
            
            // Initialize with mock data
            this.initializeMockData();
            
            this.initialized = true;
            console.log('Analytics service initialized successfully');
            
            return { success: true };
        } catch (error) {
            console.error('Failed to initialize Analytics service:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Initialize mock analytics data
     */
    initializeMockData() {
        // Mock swap metrics
        const mockSwaps = [
            {
                id: '1',
                userAddress: '0x742d35Cc6634C0532925a3b8D4C9db96590c4',
                fromToken: 'ETH',
                toToken: 'USDC',
                fromAmount: '1.5',
                toAmount: '2850.75',
                timestamp: Date.now() - 3600000,
                gasUsed: '150000',
                swapTime: 12000,
                zkProofTime: 8000,
                success: true
            },
            {
                id: '2',
                userAddress: '0x8ba1f109551bD432803012645Hac136c0532925a3b8D4C9db96590c4',
                fromToken: 'USDC',
                toToken: 'WBTC',
                fromAmount: '5000',
                toAmount: '0.125',
                timestamp: Date.now() - 7200000,
                gasUsed: '180000',
                swapTime: 15000,
                zkProofTime: 9500,
                success: true
            }
        ];
        
        mockSwaps.forEach(swap => {
            this.swapMetrics.set(swap.id, swap);
            this.updateSystemMetrics(swap);
            this.updateUserMetrics(swap);
        });
    }
    
    /**
     * Track a new swap
     */
    async trackSwap(swapData) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }
            
            const swapId = Date.now().toString();
            const swapMetric = {
                id: swapId,
                userAddress: swapData.userAddress,
                fromToken: swapData.fromToken,
                toToken: swapData.toToken,
                fromAmount: swapData.fromAmount,
                toAmount: swapData.toAmount,
                timestamp: Date.now(),
                gasUsed: swapData.gasUsed || '0',
                swapTime: swapData.swapTime || 0,
                zkProofTime: swapData.zkProofTime || 0,
                storageTime: swapData.storageTime || 0,
                success: swapData.success || true,
                slippage: swapData.slippage || '0',
                priceImpact: swapData.priceImpact || '0'
            };
            
            this.swapMetrics.set(swapId, swapMetric);
            this.updateSystemMetrics(swapMetric);
            this.updateUserMetrics(swapMetric);
            
            return {
                success: true,
                swapId,
                metrics: swapMetric
            };
            
        } catch (error) {
            console.error('Swap tracking failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Update system-wide metrics
     */
    updateSystemMetrics(swapData) {
        this.systemMetrics.totalSwaps += 1;
        
        const volume = parseFloat(this.systemMetrics.totalVolume) + parseFloat(swapData.fromAmount);
        this.systemMetrics.totalVolume = volume.toFixed(6);
        
        this.systemMetrics.averageSwapSize = (volume / this.systemMetrics.totalSwaps).toFixed(6);
        
        // Update performance metrics
        const totalSwaps = this.systemMetrics.totalSwaps;
        this.performanceMetrics.avgSwapTime = 
            ((this.performanceMetrics.avgSwapTime * (totalSwaps - 1)) + swapData.swapTime) / totalSwaps;
        
        this.performanceMetrics.avgGasUsed = 
            ((this.performanceMetrics.avgGasUsed * (totalSwaps - 1)) + parseInt(swapData.gasUsed || '0')) / totalSwaps;
        
        this.performanceMetrics.zkProofTime = 
            ((this.performanceMetrics.zkProofTime * (totalSwaps - 1)) + swapData.zkProofTime) / totalSwaps;
        
        // Calculate success rate
        const successfulSwaps = Array.from(this.swapMetrics.values()).filter(s => s.success).length;
        this.systemMetrics.successRate = ((successfulSwaps / totalSwaps) * 100).toFixed(2);
    }
    
    /**
     * Update user-specific metrics
     */
    updateUserMetrics(swapData) {
        const userAddress = swapData.userAddress.toLowerCase();
        let userMetric = this.userMetrics.get(userAddress) || {
            totalSwaps: 0,
            totalVolume: '0',
            averageSwapSize: '0',
            successRate: 0,
            favoriteTokens: new Map(),
            lastSwapTime: 0
        };
        
        userMetric.totalSwaps += 1;
        const volume = parseFloat(userMetric.totalVolume) + parseFloat(swapData.fromAmount);
        userMetric.totalVolume = volume.toFixed(6);
        userMetric.averageSwapSize = (volume / userMetric.totalSwaps).toFixed(6);
        userMetric.lastSwapTime = swapData.timestamp;
        
        // Track favorite tokens
        const fromToken = swapData.fromToken;
        const toToken = swapData.toToken;
        userMetric.favoriteTokens.set(fromToken, (userMetric.favoriteTokens.get(fromToken) || 0) + 1);
        userMetric.favoriteTokens.set(toToken, (userMetric.favoriteTokens.get(toToken) || 0) + 1);
        
        // Calculate user success rate
        const userSwaps = Array.from(this.swapMetrics.values())
            .filter(s => s.userAddress.toLowerCase() === userAddress);
        const successfulUserSwaps = userSwaps.filter(s => s.success).length;
        userMetric.successRate = ((successfulUserSwaps / userSwaps.length) * 100).toFixed(2);
        
        this.userMetrics.set(userAddress, userMetric);
        
        // Update total users count
        this.systemMetrics.totalUsers = this.userMetrics.size;
    }
    
    /**
     * Get system analytics
     */
    getSystemAnalytics() {
        return {
            success: true,
            metrics: {
                ...this.systemMetrics,
                performance: this.performanceMetrics,
                timestamp: Date.now()
            }
        };
    }
    
    /**
     * Get user analytics
     */
    getUserAnalytics(userAddress) {
        const userMetric = this.userMetrics.get(userAddress.toLowerCase()) || {
            totalSwaps: 0,
            totalVolume: '0',
            averageSwapSize: '0',
            successRate: 0,
            favoriteTokens: new Map(),
            lastSwapTime: 0
        };
        
        // Convert Map to object for JSON serialization
        const favoriteTokens = Object.fromEntries(userMetric.favoriteTokens);
        
        return {
            success: true,
            metrics: {
                ...userMetric,
                favoriteTokens,
                timestamp: Date.now()
            }
        };
    }
    
    /**
     * Get swap history with analytics
     */
    getSwapHistory(userAddress = null, limit = 50) {
        let swaps = Array.from(this.swapMetrics.values());
        
        if (userAddress) {
            swaps = swaps.filter(s => s.userAddress.toLowerCase() === userAddress.toLowerCase());
        }
        
        swaps = swaps
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
        
        return {
            success: true,
            swaps,
            total: swaps.length
        };
    }
    
    /**
     * Get token analytics
     */
    getTokenAnalytics() {
        const tokenStats = new Map();
        
        Array.from(this.swapMetrics.values()).forEach(swap => {
            // From token stats
            if (!tokenStats.has(swap.fromToken)) {
                tokenStats.set(swap.fromToken, {
                    symbol: swap.fromToken,
                    totalVolume: 0,
                    swapCount: 0,
                    avgSwapSize: 0
                });
            }
            
            const fromStats = tokenStats.get(swap.fromToken);
            fromStats.totalVolume += parseFloat(swap.fromAmount);
            fromStats.swapCount += 1;
            fromStats.avgSwapSize = fromStats.totalVolume / fromStats.swapCount;
            
            // To token stats
            if (!tokenStats.has(swap.toToken)) {
                tokenStats.set(swap.toToken, {
                    symbol: swap.toToken,
                    totalVolume: 0,
                    swapCount: 0,
                    avgSwapSize: 0
                });
            }
            
            const toStats = tokenStats.get(swap.toToken);
            toStats.totalVolume += parseFloat(swap.toAmount);
            toStats.swapCount += 1;
            toStats.avgSwapSize = toStats.totalVolume / toStats.swapCount;
        });
        
        const tokens = Array.from(tokenStats.values())
            .sort((a, b) => b.totalVolume - a.totalVolume);
        
        return {
            success: true,
            tokens
        };
    }
    
    /**
     * Get time-series data for charts
     */
    getTimeSeriesData(period = '24h') {
        const now = Date.now();
        const periodMs = {
            '1h': 3600000,
            '24h': 86400000,
            '7d': 604800000,
            '30d': 2592000000
        };
        
        const startTime = now - (periodMs[period] || periodMs['24h']);
        const swaps = Array.from(this.swapMetrics.values())
            .filter(s => s.timestamp >= startTime)
            .sort((a, b) => a.timestamp - b.timestamp);
        
        // Group by time intervals
        const intervals = 20; // Number of data points
        const intervalSize = (now - startTime) / intervals;
        const timeSeriesData = [];
        
        for (let i = 0; i < intervals; i++) {
            const intervalStart = startTime + (i * intervalSize);
            const intervalEnd = intervalStart + intervalSize;
            
            const intervalSwaps = swaps.filter(s => 
                s.timestamp >= intervalStart && s.timestamp < intervalEnd
            );
            
            const volume = intervalSwaps.reduce((sum, s) => sum + parseFloat(s.fromAmount), 0);
            const count = intervalSwaps.length;
            
            timeSeriesData.push({
                timestamp: intervalStart,
                volume: volume.toFixed(6),
                swapCount: count,
                avgGasUsed: count > 0 ? 
                    intervalSwaps.reduce((sum, s) => sum + parseInt(s.gasUsed || '0'), 0) / count : 0
            });
        }
        
        return {
            success: true,
            data: timeSeriesData,
            period
        };
    }
    
    /**
     * Get performance insights
     */
    getPerformanceInsights() {
        const insights = [];
        
        // Gas usage insights
        if (this.performanceMetrics.avgGasUsed > 200000) {
            insights.push({
                type: 'warning',
                category: 'gas',
                message: 'Average gas usage is high. Consider optimizing swap routes.',
                value: this.performanceMetrics.avgGasUsed
            });
        }
        
        // Swap time insights
        if (this.performanceMetrics.avgSwapTime > 30000) {
            insights.push({
                type: 'info',
                category: 'performance',
                message: 'Average swap time could be improved.',
                value: this.performanceMetrics.avgSwapTime
            });
        }
        
        // Success rate insights
        if (parseFloat(this.systemMetrics.successRate) < 95) {
            insights.push({
                type: 'warning',
                category: 'reliability',
                message: 'Swap success rate is below optimal threshold.',
                value: this.systemMetrics.successRate
            });
        }
        
        return {
            success: true,
            insights
        };
    }
}

export default new AnalyticsService();
