import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import relayerService from '../services/relayerService';
import './GaslessTransaction.css';

const GaslessTransaction = ({ 
    transactionData, 
    contractAddress, 
    onTransactionComplete, 
    onError,
    disabled = false 
}) => {
    const { address, chain, isConnected } = useAccount();
    
    // State management
    const [isProcessing, setIsProcessing] = useState(false);
    const [gasEstimation, setGasEstimation] = useState(null);
    const [transactionStatus, setTransactionStatus] = useState(null);
    const [gasPoolStatus, setGasPoolStatus] = useState(null);
    const [error, setError] = useState(null);
    const [currentStep, setCurrentStep] = useState('idle');
    const [progress, setProgress] = useState(0);
    const [taskId, setTaskId] = useState(null);

    // Initialize relayer service
    useEffect(() => {
        const initializeRelayer = async () => {
            if (!isConnected || !chain || !window.ethereum) return;

            try {
                const provider = new ethers.BrowserProvider(window.ethereum);
                await relayerService.initialize(chain.id, provider);
                
                // Get gas pool status
                const poolStatus = relayerService.getGasPoolStatus(chain.id);
                setGasPoolStatus(poolStatus);
                
            } catch (error) {
                console.error('Relayer initialization failed:', error);
                setError(`Relayer initialization failed: ${error.message}`);
            }
        };

        initializeRelayer();
    }, [isConnected, chain]);

    // Estimate gas when transaction data changes
    useEffect(() => {
        const estimateGas = async () => {
            if (!transactionData || !chain || disabled) return;

            try {
                const estimation = await relayerService.estimateGasCost(transactionData, chain.id);
                setGasEstimation(estimation);
                
            } catch (error) {
                console.error('Gas estimation failed:', error);
                setError(`Gas estimation failed: ${error.message}`);
            }
        };

        estimateGas();
    }, [transactionData, chain, disabled]);

    /**
     * Execute gasless transaction
     */
    const executeGaslessTransaction = async () => {
        if (!transactionData || !contractAddress || !isConnected || disabled) return;

        setIsProcessing(true);
        setError(null);
        setCurrentStep('preparing');
        setProgress(20);

        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();

            setCurrentStep('estimating');
            setProgress(40);

            // Execute complete gasless transaction flow
            const result = await relayerService.executeGaslessTransaction(
                transactionData,
                signer,
                contractAddress,
                chain.id
            );

            setCurrentStep('submitting');
            setProgress(60);

            // Store task ID for status tracking
            setTaskId(result.taskId);

            setCurrentStep('confirming');
            setProgress(80);

            // Start status tracking
            await trackTransactionStatus(result.taskId, result.relayer);

            setCurrentStep('completed');
            setProgress(100);

            // Callback to parent
            if (onTransactionComplete) {
                onTransactionComplete(result);
            }

        } catch (error) {
            console.error('Gasless transaction failed:', error);
            setError(`Transaction failed: ${error.message}`);
            
            if (onError) {
                onError(error);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    /**
     * Track transaction status until completion
     * @param {String} taskId - Transaction task ID
     * @param {String} relayer - Relayer type
     */
    const trackTransactionStatus = async (taskId, relayer) => {
        const maxAttempts = 30; // 5 minutes with 10-second intervals
        let attempts = 0;

        const checkStatus = async () => {
            try {
                const status = await relayerService.getTransactionStatus(taskId, relayer, chain.id);
                setTransactionStatus(status);

                if (status.status === 'success' || status.status === 'confirmed') {
                    return true; // Transaction completed
                }

                if (status.status === 'failed' || status.status === 'reverted') {
                    throw new Error(`Transaction failed: ${status.status}`);
                }

                attempts++;
                if (attempts >= maxAttempts) {
                    throw new Error('Transaction status check timeout');
                }

                // Continue checking
                setTimeout(checkStatus, 10000); // Check every 10 seconds
                return false;

            } catch (error) {
                console.error('Status tracking failed:', error);
                throw error;
            }
        };

        await checkStatus();
    };

    /**
     * Refresh gas estimation
     */
    const refreshGasEstimation = async () => {
        if (!transactionData || !chain) return;

        try {
            const estimation = await relayerService.estimateGasCost(transactionData, chain.id);
            setGasEstimation(estimation);
            
            // Refresh gas pool status
            const poolStatus = relayerService.getGasPoolStatus(chain.id);
            setGasPoolStatus(poolStatus);
            
        } catch (error) {
            console.error('Gas estimation refresh failed:', error);
            setError(`Gas estimation failed: ${error.message}`);
        }
    };

    if (!isConnected) {
        return (
            <div className="gasless-transaction">
                <p>Please connect your wallet to use gasless transactions</p>
            </div>
        );
    }

    return (
        <div className="gasless-transaction">
            <div className="gasless-header">
                <h3>⚡ Gasless Transaction</h3>
                <div className="gas-pool-indicator">
                    {gasPoolStatus?.available ? (
                        <span className="status-available">🟢 Gas Pool Active</span>
                    ) : (
                        <span className="status-unavailable">🔴 Gas Pool Unavailable</span>
                    )}
                </div>
            </div>

            {/* Progress Bar */}
            {isProcessing && (
                <div className="progress-section">
                    <div className="progress-bar">
                        <div 
                            className="progress-fill" 
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                    <p className="progress-text">
                        {currentStep.replace('_', ' ').toUpperCase()} - {progress}%
                    </p>
                </div>
            )}

            {/* Gas Estimation */}
            {gasEstimation && (
                <div className="gas-estimation">
                    <h4>Gas Estimation</h4>
                    <div className="estimation-grid">
                        <div className="estimation-item">
                            <span className="label">Estimated Gas:</span>
                            <span className="value">{Number(gasEstimation.estimatedGas).toLocaleString()}</span>
                        </div>
                        <div className="estimation-item">
                            <span className="label">Gas Price:</span>
                            <span className="value">{ethers.formatUnits(gasEstimation.gasPrice, 'gwei')} Gwei</span>
                        </div>
                        <div className="estimation-item">
                            <span className="label">Gas Cost:</span>
                            <span className="value">{ethers.formatEther(gasEstimation.gasCost)} ETH</span>
                        </div>
                        <div className="estimation-item">
                            <span className="label">Relayer Fee:</span>
                            <span className="value">{ethers.formatEther(gasEstimation.relayerFee)} ETH</span>
                        </div>
                        <div className="estimation-item">
                            <span className="label">Total Cost:</span>
                            <span className="value">{ethers.formatEther(gasEstimation.totalCost)} ETH</span>
                        </div>
                        <div className="estimation-item">
                            <span className="label">Cost (USD):</span>
                            <span className="value">${gasEstimation.costInUSD}</span>
                        </div>
                    </div>
                    
                    <div className="affordability-check">
                        {gasEstimation.canAfford ? (
                            <span className="can-afford">✅ Gas pool can cover this transaction</span>
                        ) : (
                            <span className="cannot-afford">❌ Insufficient gas pool balance</span>
                        )}
                    </div>
                </div>
            )}

            {/* Gas Pool Status */}
            {gasPoolStatus?.available && (
                <div className="gas-pool-status">
                    <h4>Gas Pool Status</h4>
                    <div className="pool-grid">
                        <div className="pool-item">
                            <span className="label">Available Gas:</span>
                            <span className="value">{gasPoolStatus.availableGas} ETH</span>
                        </div>
                        <div className="pool-item">
                            <span className="label">Current Gas Price:</span>
                            <span className="value">{gasPoolStatus.gasPrice} Gwei</span>
                        </div>
                        <div className="pool-item">
                            <span className="label">Relayer Fee:</span>
                            <span className="value">{gasPoolStatus.feePercentage}%</span>
                        </div>
                        <div className="pool-item">
                            <span className="label">Supported Tokens:</span>
                            <span className="value">{gasPoolStatus.supportedTokens.join(', ')}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Transaction Status */}
            {transactionStatus && (
                <div className="transaction-status">
                    <h4>Transaction Status</h4>
                    <div className="status-details">
                        <div className="status-item">
                            <span className="label">Status:</span>
                            <span className={`value status-${transactionStatus.status}`}>
                                {transactionStatus.status.toUpperCase()}
                            </span>
                        </div>
                        {transactionStatus.transactionHash && (
                            <div className="status-item">
                                <span className="label">Transaction Hash:</span>
                                <span className="value hash">{transactionStatus.transactionHash}</span>
                            </div>
                        )}
                        {transactionStatus.blockNumber && (
                            <div className="status-item">
                                <span className="label">Block Number:</span>
                                <span className="value">{transactionStatus.blockNumber}</span>
                            </div>
                        )}
                        <div className="status-item">
                            <span className="label">Last Updated:</span>
                            <span className="value">
                                {new Date(transactionStatus.lastUpdated).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="action-section">
                <button
                    onClick={executeGaslessTransaction}
                    disabled={disabled || isProcessing || !gasEstimation?.canAfford || !transactionData}
                    className="execute-button"
                >
                    {isProcessing ? 'Processing...' : 'Execute Gasless Transaction'}
                </button>

                <button
                    onClick={refreshGasEstimation}
                    disabled={isProcessing || !transactionData}
                    className="refresh-button"
                >
                    Refresh Estimation
                </button>
            </div>

            {/* Information Section */}
            <div className="info-section">
                <h4>About Gasless Transactions</h4>
                <ul>
                    <li>💰 <strong>No Gas Required:</strong> Transactions are paid by the ZKVault gas pool</li>
                    <li>⚡ <strong>Instant Execution:</strong> Meta-transactions are processed immediately</li>
                    <li>🔒 <strong>Secure:</strong> Uses EIP-712 signatures for secure meta-transactions</li>
                    <li>🌐 <strong>Multi-Relayer:</strong> Supports Gelato Network and custom relayers</li>
                    <li>📊 <strong>Transparent Fees:</strong> Clear breakdown of all costs and fees</li>
                </ul>
            </div>

            {/* Error Display */}
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

export default GaslessTransaction;
