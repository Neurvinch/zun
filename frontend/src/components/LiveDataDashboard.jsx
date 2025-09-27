import React, { useState, useEffect } from 'react';
import LiveDataService from '../services/liveDataService';
import './LiveDataDashboard.css';

const LiveDataDashboard = () => {
    const [liveDataService, setLiveDataService] = useState(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // Data states
    const [priceData, setPriceData] = useState(null);
    const [gasData, setGasData] = useState(null);
    const [defiData, setDefiData] = useState(null);
    const [newsData, setNewsData] = useState(null);
    
    // UI states
    const [selectedTokens, setSelectedTokens] = useState(['bitcoin', 'ethereum']);
    const [newsQuery, setNewsQuery] = useState('cryptocurrency');
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(null);
    
    // Service stats
    const [serviceStats, setServiceStats] = useState(null);
    const [cachedData, setCachedData] = useState({});

    useEffect(() => {
        initializeLiveData();
        return () => {
            if (refreshInterval) {
                clearInterval(refreshInterval);
            }
        };
    }, []);

    useEffect(() => {
        if (autoRefresh && isInitialized) {
            const interval = setInterval(() => {
                refreshAllData();
            }, 60000); // Refresh every minute
            setRefreshInterval(interval);
        } else if (refreshInterval) {
            clearInterval(refreshInterval);
            setRefreshInterval(null);
        }
    }, [autoRefresh, isInitialized]);

    const initializeLiveData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const service = new LiveDataService();
            const result = await service.initialize();
            
            if (result.success) {
                setLiveDataService(service);
                setIsInitialized(true);
                
                // Load initial data
                await loadInitialData(service);
                
                // Load service stats
                const stats = service.getServiceStats();
                setServiceStats(stats);
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const loadInitialData = async (service) => {
        try {
            // Load all data types in parallel
            const [prices, gas, defi, news] = await Promise.all([
                service.getLivePriceData(selectedTokens),
                service.getLiveGasPrices(),
                service.getLiveDeFiData(),
                service.getLiveNewsData(newsQuery, 10)
            ]);
            
            if (prices.success) setPriceData(prices);
            if (gas.success) setGasData(gas);
            if (defi.success) setDefiData(defi);
            if (news.success) setNewsData(news);
            
        } catch (err) {
            console.error('Failed to load initial data:', err);
        }
    };

    const refreshAllData = async () => {
        if (!liveDataService) return;
        
        try {
            setLoading(true);
            await loadInitialData(liveDataService);
            
            // Update cached data view
            const cached = liveDataService.getAllCachedData();
            setCachedData(cached);
            
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleTokensChange = async (tokens) => {
        setSelectedTokens(tokens);
        
        if (liveDataService) {
            try {
                setLoading(true);
                const result = await liveDataService.getLivePriceData(tokens);
                if (result.success) {
                    setPriceData(result);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleNewsQueryChange = async (query) => {
        setNewsQuery(query);
        
        if (liveDataService) {
            try {
                setLoading(true);
                const result = await liveDataService.getLiveNewsData(query, 10);
                if (result.success) {
                    setNewsData(result);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
    };

    const verifyDataProof = async (proof, data) => {
        if (!liveDataService) return;
        
        try {
            const verification = await liveDataService.verifyDataProof(proof, data);
            alert(`Proof verification: ${verification.valid ? 'VALID' : 'INVALID'}\n\nDetails:\n${JSON.stringify(verification.checks, null, 2)}`);
        } catch (err) {
            alert(`Verification failed: ${err.message}`);
        }
    };

    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleString();
    };

    const getDataFreshness = (timestamp) => {
        const age = Date.now() - timestamp;
        if (age < 60000) return 'Fresh';
        if (age < 300000) return 'Recent';
        if (age < 900000) return 'Stale';
        return 'Old';
    };

    if (!isInitialized) {
        return (
            <div className="live-data-dashboard">
                <div className="dashboard-header">
                    <h2>Live Data Integration</h2>
                    <p>Initializing real-world data feeds...</p>
                    {loading && <div className="loading-spinner"></div>}
                    {error && <div className="error-message">{error}</div>}
                </div>
            </div>
        );
    }

    return (
        <div className="live-data-dashboard">
            <div className="dashboard-header">
                <h2>Live Data Integration Dashboard</h2>
                <p>Real-world data feeds with cryptographic proof validation</p>
                
                <div className="dashboard-controls">
                    <label className="auto-refresh-control">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                        />
                        Auto-refresh (1 min)
                    </label>
                    
                    <button
                        onClick={refreshAllData}
                        disabled={loading}
                        className="refresh-button"
                    >
                        {loading ? 'Refreshing...' : 'Refresh All'}
                    </button>
                </div>
                
                {error && (
                    <div className="error-message">
                        <span>⚠️ {error}</span>
                        <button onClick={() => setError(null)}>×</button>
                    </div>
                )}
            </div>

            {/* Service Status */}
            <div className="service-status">
                <h3>Service Status</h3>
                {serviceStats && (
                    <div className="status-grid">
                        <div className="status-item">
                            <span className="status-label">Cache Size:</span>
                            <span className="status-value">{serviceStats.cacheSize} items</span>
                        </div>
                        <div className="status-item">
                            <span className="status-label">Proof Store:</span>
                            <span className="status-value">{serviceStats.proofStoreSize} proofs</span>
                        </div>
                        <div className="status-item">
                            <span className="status-label">Available APIs:</span>
                            <span className="status-value">{serviceStats.availableApis.length}</span>
                        </div>
                        <div className="status-item">
                            <span className="status-label">Configured Keys:</span>
                            <span className="status-value">{serviceStats.configuredApiKeys.length}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Price Data */}
            <div className="data-section">
                <div className="section-header">
                    <h3>Live Cryptocurrency Prices</h3>
                    <div className="token-selector">
                        <label>Tokens:</label>
                        <select
                            multiple
                            value={selectedTokens}
                            onChange={(e) => {
                                const tokens = Array.from(e.target.selectedOptions, option => option.value);
                                handleTokensChange(tokens);
                            }}
                        >
                            <option value="bitcoin">Bitcoin</option>
                            <option value="ethereum">Ethereum</option>
                            <option value="cardano">Cardano</option>
                            <option value="polkadot">Polkadot</option>
                            <option value="chainlink">Chainlink</option>
                        </select>
                    </div>
                </div>
                
                {priceData && (
                    <div className="data-card">
                        <div className="data-header">
                            <div className="data-source">
                                <strong>Source:</strong> {priceData.source}
                                <span className={`freshness ${getDataFreshness(priceData.timestamp).toLowerCase()}`}>
                                    {getDataFreshness(priceData.timestamp)}
                                </span>
                            </div>
                            <div className="data-timestamp">
                                {formatTimestamp(priceData.timestamp)}
                            </div>
                        </div>
                        
                        <div className="price-grid">
                            {Object.entries(priceData.data).map(([token, data]) => (
                                <div key={token} className="price-item">
                                    <h4>{token.charAt(0).toUpperCase() + token.slice(1)}</h4>
                                    <div className="price-value">${data.usd?.toLocaleString()}</div>
                                    <div className="price-change">
                                        24h: <span className={data.usd_24h_change >= 0 ? 'positive' : 'negative'}>
                                            {data.usd_24h_change?.toFixed(2)}%
                                        </span>
                                    </div>
                                    <div className="market-cap">
                                        MCap: ${(data.usd_market_cap / 1e9)?.toFixed(2)}B
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <div className="proof-section">
                            <div className="proof-info">
                                <strong>Cryptographic Proof:</strong>
                                <span className={`validation-badge ${priceData.validation.valid ? 'valid' : 'invalid'}`}>
                                    {priceData.validation.valid ? 'VALIDATED' : 'INVALID'}
                                </span>
                            </div>
                            <button
                                onClick={() => verifyDataProof(priceData.proof, priceData.data)}
                                className="verify-button"
                            >
                                Verify Proof
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Gas Prices */}
            <div className="data-section">
                <h3>Live Ethereum Gas Prices</h3>
                
                {gasData && (
                    <div className="data-card">
                        <div className="data-header">
                            <div className="data-source">
                                <strong>Source:</strong> {gasData.source}
                                <span className={`freshness ${getDataFreshness(gasData.timestamp).toLowerCase()}`}>
                                    {getDataFreshness(gasData.timestamp)}
                                </span>
                            </div>
                            <div className="data-timestamp">
                                {formatTimestamp(gasData.timestamp)}
                            </div>
                        </div>
                        
                        <div className="gas-grid">
                            <div className="gas-item">
                                <h4>Safe Low</h4>
                                <div className="gas-value">{gasData.data.safeLow} Gwei</div>
                            </div>
                            <div className="gas-item">
                                <h4>Standard</h4>
                                <div className="gas-value">{gasData.data.standard} Gwei</div>
                            </div>
                            <div className="gas-item">
                                <h4>Fast</h4>
                                <div className="gas-value">{gasData.data.fast} Gwei</div>
                            </div>
                            <div className="gas-item">
                                <h4>Fastest</h4>
                                <div className="gas-value">{gasData.data.fastest} Gwei</div>
                            </div>
                        </div>
                        
                        <div className="gas-details">
                            <p><strong>Block Number:</strong> {gasData.data.blockNumber?.toLocaleString()}</p>
                            <p><strong>Block Time:</strong> {gasData.data.blockTime}s</p>
                        </div>
                        
                        <div className="proof-section">
                            <div className="proof-info">
                                <strong>Cryptographic Proof:</strong>
                                <span className={`validation-badge ${gasData.validation.valid ? 'valid' : 'invalid'}`}>
                                    {gasData.validation.valid ? 'VALIDATED' : 'INVALID'}
                                </span>
                            </div>
                            <button
                                onClick={() => verifyDataProof(gasData.proof, gasData.data)}
                                className="verify-button"
                            >
                                Verify Proof
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* News Sentiment */}
            <div className="data-section">
                <div className="section-header">
                    <h3>Live News Sentiment Analysis</h3>
                    <div className="news-query-input">
                        <label>Query:</label>
                        <input
                            type="text"
                            value={newsQuery}
                            onChange={(e) => setNewsQuery(e.target.value)}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    handleNewsQueryChange(newsQuery);
                                }
                            }}
                            placeholder="Enter search term..."
                        />
                        <button
                            onClick={() => handleNewsQueryChange(newsQuery)}
                            disabled={loading}
                        >
                            Search
                        </button>
                    </div>
                </div>
                
                {newsData && (
                    <div className="data-card">
                        <div className="data-header">
                            <div className="data-source">
                                <strong>Source:</strong> {newsData.source}
                                <span className={`freshness ${getDataFreshness(newsData.timestamp).toLowerCase()}`}>
                                    {getDataFreshness(newsData.timestamp)}
                                </span>
                            </div>
                            <div className="data-timestamp">
                                {formatTimestamp(newsData.timestamp)}
                            </div>
                        </div>
                        
                        <div className="sentiment-overview">
                            <div className="sentiment-main">
                                <h4>Overall Sentiment</h4>
                                <div className={`sentiment-badge ${newsData.data.sentiment.sentiment}`}>
                                    {newsData.data.sentiment.sentiment.toUpperCase()}
                                </div>
                                <div className="confidence">
                                    Confidence: {(newsData.data.sentiment.confidence * 100).toFixed(1)}%
                                </div>
                            </div>
                            
                            <div className="sentiment-breakdown">
                                <div className="sentiment-score">
                                    <span className="score-label">Positive:</span>
                                    <span className="score-value">{newsData.data.sentiment.scores.positive}</span>
                                </div>
                                <div className="sentiment-score">
                                    <span className="score-label">Negative:</span>
                                    <span className="score-value">{newsData.data.sentiment.scores.negative}</span>
                                </div>
                                <div className="sentiment-score">
                                    <span className="score-label">Neutral:</span>
                                    <span className="score-value">{newsData.data.sentiment.scores.neutral}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="articles-list">
                            <h4>Recent Articles ({newsData.data.articles.length})</h4>
                            {newsData.data.articles.slice(0, 5).map((article, index) => (
                                <div key={index} className="article-item">
                                    <h5>{article.title}</h5>
                                    <p>{article.description}</p>
                                    <div className="article-meta">
                                        <span>{article.source.name}</span>
                                        <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <div className="proof-section">
                            <div className="proof-info">
                                <strong>Cryptographic Proof:</strong>
                                <span className={`validation-badge ${newsData.validation.valid ? 'valid' : 'invalid'}`}>
                                    {newsData.validation.valid ? 'VALIDATED' : 'INVALID'}
                                </span>
                            </div>
                            <button
                                onClick={() => verifyDataProof(newsData.proof, newsData.data)}
                                className="verify-button"
                            >
                                Verify Proof
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* DeFi Data */}
            {defiData && (
                <div className="data-section">
                    <h3>Live DeFi Market Data</h3>
                    
                    <div className="data-card">
                        <div className="data-header">
                            <div className="data-source">
                                <strong>Source:</strong> {defiData.source}
                                <span className={`freshness ${getDataFreshness(defiData.timestamp).toLowerCase()}`}>
                                    {getDataFreshness(defiData.timestamp)}
                                </span>
                            </div>
                            <div className="data-timestamp">
                                {formatTimestamp(defiData.timestamp)}
                            </div>
                        </div>
                        
                        <div className="defi-stats">
                            {defiData.data.defi_market_cap && (
                                <div className="defi-stat">
                                    <h4>Total DeFi Market Cap</h4>
                                    <div className="stat-value">
                                        ${(defiData.data.defi_market_cap / 1e9).toFixed(2)}B
                                    </div>
                                </div>
                            )}
                            
                            {defiData.data.defi_to_eth_ratio && (
                                <div className="defi-stat">
                                    <h4>DeFi to ETH Ratio</h4>
                                    <div className="stat-value">
                                        {(defiData.data.defi_to_eth_ratio * 100).toFixed(2)}%
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="proof-section">
                            <div className="proof-info">
                                <strong>Cryptographic Proof:</strong>
                                <span className={`validation-badge ${defiData.validation.valid ? 'valid' : 'invalid'}`}>
                                    {defiData.validation.valid ? 'VALIDATED' : 'INVALID'}
                                </span>
                            </div>
                            <button
                                onClick={() => verifyDataProof(defiData.proof, defiData.data)}
                                className="verify-button"
                            >
                                Verify Proof
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LiveDataDashboard;
