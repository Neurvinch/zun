import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
    LineChart, 
    Line, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    Legend,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer
} from 'recharts';
import { 
    Wifi, 
    Shield, 
    TrendingUp, 
    TrendingDown, 
    Activity, 
    Globe,
    Twitter,
    Newspaper,
    DollarSign,
    BarChart3,
    RefreshCw,
    CheckCircle,
    AlertTriangle,
    Clock,
    Zap
} from 'lucide-react';
import ZkTLSService from '../../services/feeds/zkTLSService';
import './DataFeedsDashboard.css';

const DataFeedsDashboard = () => {
    const [zkTLSService] = useState(() => new ZkTLSService());
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    
    // State for different data feeds
    const [priceFeeds, setPriceFeeds] = useState([]);
    const [sentimentData, setSentimentData] = useState(null);
    const [defiData, setDefiData] = useState([]);
    const [newsData, setNewsData] = useState(null);
    const [activeFeeds, setActiveFeeds] = useState([]);
    
    // Auto-refresh state
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds
    
    const tokens = [
        { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
        { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
        { id: 'uniswap', name: 'Uniswap', symbol: 'UNI' },
        { id: 'chainlink', name: 'Chainlink', symbol: 'LINK' },
        { id: 'aave', name: 'Aave', symbol: 'AAVE' }
    ];
    
    const defiProtocols = ['uniswap', 'aave', 'compound', 'makerdao'];
    const sentimentTopics = ['ethereum', 'bitcoin', 'defi', 'nft'];
    const newsTopics = ['cryptocurrency', 'defi', 'nft'];
    
    useEffect(() => {
        initializeFeeds();
    }, []);
    
    useEffect(() => {
        let interval;
        if (autoRefresh) {
            interval = setInterval(() => {
                refreshAllFeeds();
            }, refreshInterval);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [autoRefresh, refreshInterval]);
    
    const initializeFeeds = async () => {
        try {
            setLoading(true);
            
            // Initialize zkTLS service
            const initResult = await zkTLSService.initialize();
            if (!initResult.success) {
                throw new Error(initResult.error);
            }
            
            // Load initial data
            await Promise.all([
                loadPriceFeeds(),
                loadSentimentData(),
                loadDeFiData(),
                loadNewsData(),
                loadActiveFeeds()
            ]);
            
        } catch (error) {
            console.error('Failed to initialize feeds:', error);
        } finally {
            setLoading(false);
        }
    };
    
    const loadPriceFeeds = async () => {
        try {
            const feeds = [];
            
            for (const token of tokens) {
                const result = await zkTLSService.getPriceData(token.id);
                if (result.success) {
                    feeds.push({
                        ...result,
                        name: token.name,
                        symbol: token.symbol
                    });
                }
            }
            
            setPriceFeeds(feeds);
        } catch (error) {
            console.error('Failed to load price feeds:', error);
        }
    };
    
    const loadSentimentData = async () => {
        try {
            const result = await zkTLSService.getSentimentData('ethereum', 100);
            if (result.success) {
                setSentimentData(result);
            }
        } catch (error) {
            console.error('Failed to load sentiment data:', error);
        }
    };
    
    const loadDeFiData = async () => {
        try {
            const feeds = [];
            
            for (const protocol of defiProtocols) {
                const result = await zkTLSService.getDeFiData(protocol);
                if (result.success) {
                    feeds.push({
                        ...result,
                        name: protocol.charAt(0).toUpperCase() + protocol.slice(1)
                    });
                }
            }
            
            setDefiData(feeds);
        } catch (error) {
            console.error('Failed to load DeFi data:', error);
        }
    };
    
    const loadNewsData = async () => {
        try {
            const result = await zkTLSService.getNewsData('cryptocurrency', 50);
            if (result.success) {
                setNewsData(result);
            }
        } catch (error) {
            console.error('Failed to load news data:', error);
        }
    };
    
    const loadActiveFeeds = async () => {
        try {
            const result = await zkTLSService.getActiveFeeds();
            if (result.success) {
                setActiveFeeds(result.feeds);
            }
        } catch (error) {
            console.error('Failed to load active feeds:', error);
        }
    };
    
    const refreshAllFeeds = async () => {
        await Promise.all([
            loadPriceFeeds(),
            loadSentimentData(),
            loadDeFiData(),
            loadNewsData(),
            loadActiveFeeds()
        ]);
    };
    
    const handleRefresh = async () => {
        setLoading(true);
        await refreshAllFeeds();
        setLoading(false);
    };
    
    const getSentimentColor = (sentiment) => {
        switch (sentiment) {
            case 'bullish':
            case 'positive':
                return '#4ade80';
            case 'bearish':
            case 'negative':
                return '#ef4444';
            case 'slightly_bullish':
                return '#84cc16';
            case 'slightly_bearish':
                return '#f97316';
            default:
                return '#6b7280';
        }
    };
    
    const getSentimentIcon = (sentiment) => {
        switch (sentiment) {
            case 'bullish':
            case 'positive':
                return <TrendingUp className="sentiment-icon" />;
            case 'bearish':
            case 'negative':
                return <TrendingDown className="sentiment-icon" />;
            default:
                return <Activity className="sentiment-icon" />;
        }
    };
    
    if (loading && priceFeeds.length === 0) {
        return (
            <div className="feeds-loading">
                <div className="loading-spinner"></div>
                <p>Loading zkTLS Data Feeds...</p>
            </div>
        );
    }
    
    return (
        <div className="feeds-dashboard">
            <motion.div 
                className="feeds-header"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <div className="header-content">
                    <div className="title-section">
                        <Wifi className="header-icon" />
                        <div>
                            <h1>zkTLS Data Feeds</h1>
                            <p>Cryptographically verified off-chain data with zero-knowledge proofs</p>
                        </div>
                    </div>
                    
                    <div className="header-controls">
                        <div className="auto-refresh-control">
                            <label className="refresh-toggle">
                                <input
                                    type="checkbox"
                                    checked={autoRefresh}
                                    onChange={(e) => setAutoRefresh(e.target.checked)}
                                />
                                <span className="toggle-slider"></span>
                                Auto Refresh
                            </label>
                            <select 
                                value={refreshInterval}
                                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                                disabled={!autoRefresh}
                            >
                                <option value={10000}>10s</option>
                                <option value={30000}>30s</option>
                                <option value={60000}>1m</option>
                                <option value={300000}>5m</option>
                            </select>
                        </div>
                        
                        <button 
                            className="refresh-button"
                            onClick={handleRefresh}
                            disabled={loading}
                        >
                            <RefreshCw className={loading ? 'spinning' : ''} size={20} />
                            Refresh
                        </button>
                    </div>
                </div>
            </motion.div>
            
            <div className="feeds-tabs">
                <button 
                    className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    <BarChart3 size={20} />
                    Overview
                </button>
                <button 
                    className={`tab-button ${activeTab === 'prices' ? 'active' : ''}`}
                    onClick={() => setActiveTab('prices')}
                >
                    <DollarSign size={20} />
                    Price Feeds
                </button>
                <button 
                    className={`tab-button ${activeTab === 'sentiment' ? 'active' : ''}`}
                    onClick={() => setActiveTab('sentiment')}
                >
                    <Twitter size={20} />
                    Sentiment
                </button>
                <button 
                    className={`tab-button ${activeTab === 'defi' ? 'active' : ''}`}
                    onClick={() => setActiveTab('defi')}
                >
                    <Zap size={20} />
                    DeFi Data
                </button>
                <button 
                    className={`tab-button ${activeTab === 'news' ? 'active' : ''}`}
                    onClick={() => setActiveTab('news')}
                >
                    <Newspaper size={20} />
                    News
                </button>
            </div>
            
            <div className="feeds-content">
                {activeTab === 'overview' && (
                    <motion.div 
                        className="overview-section"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="overview-stats">
                            <div className="stat-card">
                                <Shield className="stat-icon verified" />
                                <div>
                                    <span className="stat-value">{activeFeeds.length}</span>
                                    <span className="stat-label">Active Feeds</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <Globe className="stat-icon" />
                                <div>
                                    <span className="stat-value">{priceFeeds.length}</span>
                                    <span className="stat-label">Price Feeds</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <Activity className="stat-icon" />
                                <div>
                                    <span className="stat-value">
                                        {activeFeeds.filter(f => f.isActive).length}
                                    </span>
                                    <span className="stat-label">Live Feeds</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="overview-grid">
                            <div className="chart-card">
                                <h3>Price Trends</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <LineChart data={priceFeeds.map(feed => ({
                                        name: feed.symbol,
                                        price: feed.price,
                                        change: feed.change24h
                                    }))}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Line type="monotone" dataKey="price" stroke="#4ade80" name="Price (USD)" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            
                            <div className="chart-card">
                                <h3>DeFi TVL Distribution</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={defiData.map(protocol => ({
                                                name: protocol.name,
                                                value: protocol.tvl / 1000000000 // Convert to billions
                                            }))}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                            outerRadius={80}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {defiData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={['#4ade80', '#3b82f6', '#8b5cf6', '#ef4444'][index % 4]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value) => [`$${value.toFixed(2)}B`, 'TVL']} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        
                        <div className="feed-status-grid">
                            {activeFeeds.map((feed, index) => (
                                <div key={index} className="feed-status-card">
                                    <div className="feed-status-header">
                                        <span className="feed-type">{feed.type.toUpperCase()}</span>
                                        <span className={`status-indicator ${feed.isActive ? 'active' : 'inactive'}`}>
                                            {feed.isActive ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                                        </span>
                                    </div>
                                    <div className="feed-details">
                                        <span className="feed-params">{feed.params}</span>
                                        <span className="feed-time">
                                            <Clock size={14} />
                                            {new Date(feed.lastUpdated).toLocaleTimeString()}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
                
                {activeTab === 'prices' && (
                    <motion.div 
                        className="prices-section"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="prices-grid">
                            {priceFeeds.map((feed, index) => (
                                <div key={index} className="price-card">
                                    <div className="price-header">
                                        <div className="token-info">
                                            <h4>{feed.name}</h4>
                                            <span className="token-symbol">{feed.symbol}</span>
                                        </div>
                                        <div className="proof-status">
                                            <Shield className="proof-icon verified" />
                                            <span>Verified</span>
                                        </div>
                                    </div>
                                    
                                    <div className="price-data">
                                        <div className="price-main">
                                            <span className="price-value">${feed.price?.toFixed(2)}</span>
                                            <span className={`price-change ${feed.change24h >= 0 ? 'positive' : 'negative'}`}>
                                                {feed.change24h >= 0 ? '+' : ''}{feed.change24h?.toFixed(2)}%
                                            </span>
                                        </div>
                                        
                                        <div className="price-details">
                                            <div className="detail-row">
                                                <span>Market Cap:</span>
                                                <span>${(feed.marketCap / 1000000000).toFixed(2)}B</span>
                                            </div>
                                            <div className="detail-row">
                                                <span>Volume 24h:</span>
                                                <span>${(feed.volume24h / 1000000).toFixed(2)}M</span>
                                            </div>
                                            <div className="detail-row">
                                                <span>Last Updated:</span>
                                                <span>{new Date(feed.lastUpdated * 1000).toLocaleTimeString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="proof-details">
                                        <div className="proof-item">
                                            <span>Proof Hash:</span>
                                            <span className="proof-hash">
                                                {feed.proof?.proofHash?.slice(0, 10)}...
                                            </span>
                                        </div>
                                        <div className="proof-item">
                                            <span>Provider:</span>
                                            <span>{feed.proof?.provider}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
                
                {activeTab === 'sentiment' && (
                    <motion.div 
                        className="sentiment-section"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        {sentimentData && (
                            <div className="sentiment-overview">
                                <div className="sentiment-card main">
                                    <div className="sentiment-header">
                                        <Twitter className="sentiment-provider-icon" />
                                        <div>
                                            <h3>Social Sentiment Analysis</h3>
                                            <p>Query: {sentimentData.query}</p>
                                        </div>
                                        <div className="proof-badge">
                                            <Shield className="proof-icon verified" />
                                            Verified
                                        </div>
                                    </div>
                                    
                                    <div className="sentiment-data">
                                        <div className="sentiment-main">
                                            <div className="sentiment-indicator" style={{ color: getSentimentColor(sentimentData.sentiment) }}>
                                                {getSentimentIcon(sentimentData.sentiment)}
                                                <span className="sentiment-label">
                                                    {sentimentData.sentiment.replace('_', ' ').toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="confidence-score">
                                                <span>Confidence: {(sentimentData.confidence * 100).toFixed(1)}%</span>
                                            </div>
                                        </div>
                                        
                                        <div className="sentiment-breakdown">
                                            <div className="breakdown-item positive">
                                                <span>Positive</span>
                                                <span>{(sentimentData.positiveRatio * 100).toFixed(1)}%</span>
                                            </div>
                                            <div className="breakdown-item negative">
                                                <span>Negative</span>
                                                <span>{(sentimentData.negativeRatio * 100).toFixed(1)}%</span>
                                            </div>
                                            <div className="breakdown-item neutral">
                                                <span>Neutral</span>
                                                <span>{(sentimentData.neutralRatio * 100).toFixed(1)}%</span>
                                            </div>
                                        </div>
                                        
                                        <div className="sentiment-stats">
                                            <div className="stat-item">
                                                <span>Total Mentions:</span>
                                                <span>{sentimentData.mentions}</span>
                                            </div>
                                            <div className="stat-item">
                                                <span>Sample Size:</span>
                                                <span>{sentimentData.count}</span>
                                            </div>
                                            <div className="stat-item">
                                                <span>Updated:</span>
                                                <span>{new Date(sentimentData.timestamp).toLocaleTimeString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="sentiment-chart">
                                    <h4>Sentiment Distribution</h4>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <BarChart data={[
                                            { name: 'Positive', value: sentimentData.positiveRatio * 100, fill: '#4ade80' },
                                            { name: 'Negative', value: sentimentData.negativeRatio * 100, fill: '#ef4444' },
                                            { name: 'Neutral', value: sentimentData.neutralRatio * 100, fill: '#6b7280' }
                                        ]}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Tooltip formatter={(value) => [`${value.toFixed(1)}%`, 'Percentage']} />
                                            <Bar dataKey="value" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
                
                {activeTab === 'defi' && (
                    <motion.div 
                        className="defi-section"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="defi-grid">
                            {defiData.map((protocol, index) => (
                                <div key={index} className="defi-card">
                                    <div className="defi-header">
                                        <div className="protocol-info">
                                            <h4>{protocol.name}</h4>
                                            <span className="protocol-type">DeFi Protocol</span>
                                        </div>
                                        <div className="proof-status">
                                            <Shield className="proof-icon verified" />
                                            <span>Verified</span>
                                        </div>
                                    </div>
                                    
                                    <div className="defi-metrics">
                                        <div className="metric-item primary">
                                            <span className="metric-label">Total Value Locked</span>
                                            <span className="metric-value">
                                                ${(protocol.tvl / 1000000000).toFixed(2)}B
                                            </span>
                                        </div>
                                        
                                        <div className="metrics-grid">
                                            <div className="metric-item">
                                                <span className="metric-label">Volume 24h</span>
                                                <span className="metric-value">
                                                    ${(protocol.volume24h / 1000000).toFixed(2)}M
                                                </span>
                                            </div>
                                            <div className="metric-item">
                                                <span className="metric-label">Fees 24h</span>
                                                <span className="metric-value">
                                                    ${(protocol.fees24h / 1000).toFixed(2)}K
                                                </span>
                                            </div>
                                            <div className="metric-item">
                                                <span className="metric-label">Users 24h</span>
                                                <span className="metric-value">
                                                    {protocol.users24h.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="metric-item">
                                                <span className="metric-label">APY</span>
                                                <span className="metric-value">
                                                    {protocol.apy.toFixed(2)}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="proof-details">
                                        <div className="proof-item">
                                            <span>Proof Hash:</span>
                                            <span className="proof-hash">
                                                {protocol.proof?.proofHash?.slice(0, 10)}...
                                            </span>
                                        </div>
                                        <div className="proof-item">
                                            <span>Updated:</span>
                                            <span>{new Date(protocol.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
                
                {activeTab === 'news' && (
                    <motion.div 
                        className="news-section"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        {newsData && (
                            <div className="news-overview">
                                <div className="news-card main">
                                    <div className="news-header">
                                        <Newspaper className="news-provider-icon" />
                                        <div>
                                            <h3>News Sentiment Analysis</h3>
                                            <p>Topic: {newsData.topic}</p>
                                        </div>
                                        <div className="proof-badge">
                                            <Shield className="proof-icon verified" />
                                            Verified
                                        </div>
                                    </div>
                                    
                                    <div className="news-data">
                                        <div className="news-sentiment">
                                            <div className="sentiment-indicator" style={{ color: getSentimentColor(newsData.sentiment) }}>
                                                {getSentimentIcon(newsData.sentiment)}
                                                <span className="sentiment-label">
                                                    {newsData.sentiment.toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="confidence-score">
                                                <span>Confidence: {(newsData.confidence * 100).toFixed(1)}%</span>
                                            </div>
                                        </div>
                                        
                                        <div className="news-stats">
                                            <div className="stat-grid">
                                                <div className="stat-item">
                                                    <span>Total Articles</span>
                                                    <span>{newsData.totalArticles}</span>
                                                </div>
                                                <div className="stat-item positive">
                                                    <span>Positive</span>
                                                    <span>{newsData.positiveCount}</span>
                                                </div>
                                                <div className="stat-item negative">
                                                    <span>Negative</span>
                                                    <span>{newsData.negativeCount}</span>
                                                </div>
                                                <div className="stat-item neutral">
                                                    <span>Neutral</span>
                                                    <span>{newsData.neutralCount}</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="keywords-section">
                                            <h4>Top Keywords</h4>
                                            <div className="keywords-list">
                                                {newsData.topKeywords.map((keyword, index) => (
                                                    <span key={index} className="keyword-tag">
                                                        {keyword}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="news-chart">
                                    <h4>Article Sentiment Distribution</h4>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <PieChart>
                                            <Pie
                                                data={[
                                                    { name: 'Positive', value: newsData.positiveCount, fill: '#4ade80' },
                                                    { name: 'Negative', value: newsData.negativeCount, fill: '#ef4444' },
                                                    { name: 'Neutral', value: newsData.neutralCount, fill: '#6b7280' }
                                                ]}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                                outerRadius={80}
                                                fill="#8884d8"
                                                dataKey="value"
                                            >
                                                {[newsData.positiveCount, newsData.negativeCount, newsData.neutralCount].map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={['#4ade80', '#ef4444', '#6b7280'][index]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default DataFeedsDashboard;
