import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import oneInchService from '../services/oneInchService';
import './OneInchSwap.css';

const OneInchSwap = ({ onSwapComplete, onError }) => {
    const { address, chain, isConnected } = useAccount();
    
    // State management
    const [isInitialized, setIsInitialized] = useState(false);
    const [supportedTokens, setSupportedTokens] = useState([]);
    const [tokenPrices, setTokenPrices] = useState({});
    
    // Swap form state
    const [fromToken, setFromToken] = useState('');
    const [toToken, setToToken] = useState('');
    const [fromAmount, setFromAmount] = useState('');
    const [toAmount, setToAmount] = useState('');
    const [slippage, setSlippage] = useState(1);
    
    // Quote and swap data
    const [currentQuote, setCurrentQuote] = useState(null);
    const [routeInfo, setRouteInfo] = useState(null);
    const [priceImpact, setPriceImpact] = useState(0);
    
    // UI state
    const [isLoadingQuote, setIsLoadingQuote] = useState(false);
    const [isExecutingSwap, setIsExecutingSwap] = useState(false);
    const [error, setError] = useState(null);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Initialize 1inch service
    useEffect(() => {
        const initializeService = async () => {
            if (!isConnected || !chain) return;

            try {
                const initialized = await oneInchService.initialize(chain.id);
                setIsInitialized(initialized);
                
                if (initialized) {
                    // Load supported tokens via 1inch token list
                    const tokensMap = await oneInchService.loadSupportedTokens(chain.id);
                    const tokens = Object.values(tokensMap || {});
                    setSupportedTokens(tokens);
                    
                    // Load token prices
                    const addresses = tokens.map(t => t.address);
                    if (addresses.length > 0) {
                        const prices = await oneInchService.getTokenPrices(addresses, chain.id);
                        setTokenPrices(prices);
                    }
                }
                
            } catch (error) {
                console.error('1inch service initialization failed:', error);
                setError(`1inch initialization failed: ${error.message}`);
            }
        };

        initializeService();
    }, [isConnected, chain]);

    // Auto-fetch quote when inputs change
    useEffect(() => {
        const fetchQuote = async () => {
            if (!fromToken || !toToken || !fromAmount || !isInitialized) {
                setCurrentQuote(null);
                setToAmount('');
                return;
            }

            if (fromToken.toLowerCase() === toToken.toLowerCase()) {
                setError('Cannot swap same token');
                return;
            }

            const amount = ethers.parseUnits(fromAmount || '0', 18).toString();
            if (BigInt(amount) <= 0n) return;

            setIsLoadingQuote(true);
            setError(null);

            try {
                const quote = await oneInchService.getQuote({
                    chainId: chain.id,
                    src: fromToken,
                    dst: toToken,
                    amount: amount
                });

                setCurrentQuote(quote);
                setToAmount(ethers.formatUnits(quote.dstAmount, 18));
                
                // Get route information
                const info = oneInchService.getRouteInfo(quote);
                setRouteInfo(info);
                
                // Calculate price impact
                const impact = oneInchService.calculatePriceImpact(quote, amount, quote.dstAmount);
                setPriceImpact(impact);
                
            } catch (error) {
                console.error('Quote fetch failed:', error);
                setError(`Quote failed: ${error.message}`);
                setCurrentQuote(null);
                setToAmount('');
            } finally {
                setIsLoadingQuote(false);
            }
        };

        // Debounce quote fetching
        const timeoutId = setTimeout(fetchQuote, 500);
        return () => clearTimeout(timeoutId);
        
    }, [fromToken, toToken, fromAmount, chain, isInitialized]);

    const prepareSwap = async () => {
        if (!currentQuote || !address) return null;

        try {
            const amount = ethers.parseUnits(fromAmount, 18).toString();
            
            const swapParams = {
                chainId: chain.id,
                src: fromToken,
                dst: toToken,
                amount: amount,
                from: address,
                slippage: slippage,
                disableEstimate: false,
                allowPartialFill: false
            };

            const swapData = await oneInchService.getSwap(swapParams);
            return swapData;
            
        } catch (error) {
            console.error('Swap preparation failed:', error);
            setError(`Swap preparation failed: ${error.message}`);
            return null;
        }
    };

    const executeSwap = async () => {
        if (!currentQuote || !address) return;

        setIsExecutingSwap(true);
        setError(null);

        try {
            const swapData = await prepareSwap();
            if (!swapData) return;

            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();

            const tx = await signer.sendTransaction({
                to: swapData.tx.to,
                data: swapData.tx.data,
                value: swapData.tx.value,
                gasLimit: swapData.tx.gas,
                gasPrice: swapData.tx.gasPrice
            });

            const receipt = await tx.wait();

            // Reset form
            setFromAmount('');
            setToAmount('');
            setCurrentQuote(null);

            if (onSwapComplete) {
                onSwapComplete({
                    txHash: tx.hash,
                    receipt: receipt,
                    fromToken,
                    toToken,
                    fromAmount,
                    toAmount
                });
            }

        } catch (error) {
            console.error('Swap execution failed:', error);
            setError(`Swap failed: ${error.message}`);
            if (onError) onError(error);
        } finally {
            setIsExecutingSwap(false);
        }
    };

    const swapTokens = () => {
        const tempToken = fromToken;
        const tempAmount = fromAmount;
        setFromToken(toToken);
        setToToken(tempToken);
        setFromAmount(toAmount);
        setToAmount(tempAmount);
    };

    const getTokenInfo = (tokenAddress) => {
        return supportedTokens.find(t => t.address.toLowerCase() === (tokenAddress || '').toLowerCase());
    };

    const getPriceImpactColor = (impact) => {
        if (impact < 1) return '#22c55e';
        if (impact < 3) return '#f59e0b';
        return '#ef4444';
    };

    if (!isConnected) {
        return (
            <div className="oneinch-swap">
                <h3>1inch Swap</h3>
                <p>Please connect your wallet to use 1inch swaps</p>
            </div>
        );
    }

    return (
        <div className="oneinch-swap">
            <div className="swap-header">
                <h3>🔄 1inch Swap</h3>
                <div className="service-status">
                    {isInitialized ? (
                        <span className="status-ready">🟢 Ready</span>
                    ) : (
                        <span className="status-loading">🔄 Loading...</span>
                    )}
                </div>
            </div>

            <div className="swap-form">
                <div className="token-input">
                    <div className="input-header">
                        <label>From</label>
                        <div className="token-selector">
                            <select value={fromToken} onChange={(e) => setFromToken(e.target.value)}>
                                <option value="">Select Token</option>
                                {supportedTokens.map(token => (
                                    <option key={token.address} value={token.address}>
                                        {token.symbol} - {token.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="amount-input">
                        <input
                            type="number"
                            value={fromAmount}
                            onChange={(e) => setFromAmount(e.target.value)}
                            placeholder="0.0"
                            step="0.000001"
                            min="0"
                        />
                        {fromToken && tokenPrices[fromToken] && (
                            <div className="usd-value">
                                ≈ ${(parseFloat(fromAmount || 0) * parseFloat(tokenPrices[fromToken] || 0)).toFixed(2)}
                            </div>
                        )}
                    </div>
                </div>

                <div className="swap-direction">
                    <button onClick={swapTokens} className="swap-tokens-btn">⇅</button>
                </div>

                <div className="token-input">
                    <div className="input-header">
                        <label>To</label>
                        <div className="token-selector">
                            <select value={toToken} onChange={(e) => setToToken(e.target.value)}>
                                <option value="">Select Token</option>
                                {supportedTokens.map(token => (
                                    <option key={token.address} value={token.address}>
                                        {token.symbol} - {token.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="amount-input">
                        <input
                            type="number"
                            value={toAmount}
                            readOnly
                            placeholder="0.0"
                            className="readonly-input"
                        />
                        {isLoadingQuote && (
                            <div className="loading-indicator">Fetching quote...</div>
                        )}
                        {toToken && tokenPrices[toToken] && toAmount && (
                            <div className="usd-value">
                                ≈ ${(parseFloat(toAmount) * parseFloat(tokenPrices[toToken] || 0)).toFixed(2)}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {currentQuote && (
                <div className="quote-info">
                    <h4>Quote Details</h4>
                    <div className="quote-grid">
                        <div className="quote-item">
                            <span className="label">Rate:</span>
                            <span className="value">
                                1 {getTokenInfo(fromToken)?.symbol} = {
                                    fromAmount && Number(fromAmount) > 0 ? (parseFloat(toAmount || '0') / parseFloat(fromAmount)).toFixed(6) : '0.000000'
                                } {getTokenInfo(toToken)?.symbol}
                            </span>
                        </div>
                        <div className="quote-item">
                            <span className="label">Price Impact:</span>
                            <span className="value" style={{ color: getPriceImpactColor(priceImpact) }}>
                                {priceImpact.toFixed(2)}%
                            </span>
                        </div>
                        <div className="quote-item">
                            <span className="label">Estimated Gas:</span>
                            <span className="value">{Number(currentQuote.estimatedGas || 0).toLocaleString()}</span>
                        </div>
                        {routeInfo && (
                            <div className="quote-item">
                                <span className="label">Route:</span>
                                <span className="value">{routeInfo.routeString || 'Direct'}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="advanced-section">
                <button onClick={() => setShowAdvanced(!showAdvanced)} className="advanced-toggle">
                    Advanced Settings {showAdvanced ? '▲' : '▼'}
                </button>
                {showAdvanced && (
                    <div className="advanced-content">
                        <div className="setting-group">
                            <label>Slippage Tolerance:</label>
                            <div className="slippage-options">
                                {[0.5, 1, 2, 5].map(value => (
                                    <button
                                        key={value}
                                        onClick={() => setSlippage(value)}
                                        className={`slippage-btn ${slippage === value ? 'active' : ''}`}
                                    >
                                        {value}%
                                    </button>
                                ))}
                                <input
                                    type="number"
                                    value={slippage}
                                    onChange={(e) => setSlippage(parseFloat(e.target.value) || 1)}
                                    min="0.1"
                                    max="50"
                                    step="0.1"
                                    className="custom-slippage"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="execute-section">
                <button
                    onClick={executeSwap}
                    disabled={!currentQuote || isExecutingSwap || !fromAmount || !toAmount}
                    className="execute-swap-btn"
                >
                    {isExecutingSwap ? 'Swapping...' : 'Execute Swap'}
                </button>
            </div>

            {routeInfo && routeInfo.protocols.length > 0 && (
                <div className="route-section">
                    <h4>Swap Route</h4>
                    <div className="route-protocols">
                        {routeInfo.protocols.map((protocol, index) => (
                            <div key={index} className="protocol-item">
                                <span className="protocol-name">{protocol.name}</span>
                                <span className="protocol-part">{protocol.part}%</span>
                            </div>
                        ))}
                    </div>
                    <div className="route-complexity">
                        Complexity: <span className={`complexity-${routeInfo.complexity}`}>
                            {routeInfo.complexity.toUpperCase()}
                        </span>
                    </div>
                </div>
            )}

            {error && (
                <div className="error-section">
                    <h4>Error</h4>
                    <p className="error-message">{error}</p>
                    <button onClick={() => setError(null)} className="dismiss-button">
                        Dismiss
                    </button>
                </div>
            )}
        </div>
    );
};

export default OneInchSwap;
