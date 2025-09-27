import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import shieldedPoolService from '../services/shieldedPoolService';
import './ShieldedPool.css';

const ShieldedPool = ({ onDepositComplete, onSwapComplete, onWithdrawComplete, onError }) => {
    const { address, chain, isConnected } = useAccount();
    
    // State management
    const [isInitialized, setIsInitialized] = useState(false);
    const [poolStatus, setPoolStatus] = useState(null);
    const [activeTab, setActiveTab] = useState('deposit');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);
    
    // Deposit state
    const [depositAmount, setDepositAmount] = useState('');
    const [depositSecret, setDepositSecret] = useState('');
    const [depositNullifier, setDepositNullifier] = useState('');
    const [generatedCommitment, setGeneratedCommitment] = useState(null);
    
    // Swap state
    const [swapCommitment, setSwapCommitment] = useState('');
    const [swapSecret, setSwapSecret] = useState('');
    const [swapNullifier, setSwapNullifier] = useState('');
    const [swapTokenOut, setSwapTokenOut] = useState('');
    const [swapAmountOut, setSwapAmountOut] = useState('');
    
    // Withdraw state
    const [withdrawCommitment, setWithdrawCommitment] = useState('');
    const [withdrawSecret, setWithdrawSecret] = useState('');
    const [withdrawNullifier, setWithdrawNullifier] = useState('');
    const [withdrawRecipient, setWithdrawRecipient] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');

    // Initialize shielded pool service
    useEffect(() => {
        const initializeService = async () => {
            if (!isConnected || !chain || !window.ethereum) return;

            try {
                const provider = new ethers.BrowserProvider(window.ethereum);
                const initialized = await shieldedPoolService.initialize(provider, chain.id);
                
                setIsInitialized(initialized);
                
                if (initialized) {
                    const status = shieldedPoolService.getStatus();
                    setPoolStatus(status);
                }
                
            } catch (error) {
                console.error('Shielded Pool initialization failed:', error);
                setError(`Initialization failed: ${error.message}`);
            }
        };

        initializeService();
    }, [isConnected, chain]);

    /**
     * Generate random values for deposit
     */
    const generateRandomValues = () => {
        const randomValues = shieldedPoolService.generateRandomValues();
        setDepositSecret(randomValues.secret);
        setDepositNullifier(randomValues.nullifier);
    };

    /**
     * Generate commitment for deposit
     */
    const generateCommitment = () => {
        if (!depositAmount || !depositSecret || !depositNullifier) {
            setError('Please fill all deposit fields');
            return;
        }

        try {
            const amountWei = ethers.parseEther(depositAmount);
            const commitment = shieldedPoolService.generateCommitment(
                depositSecret,
                depositNullifier,
                amountWei.toString(),
                ethers.ZeroAddress // ETH
            );
            
            setGeneratedCommitment(commitment);
            setError(null);
            
        } catch (error) {
            console.error('Commitment generation failed:', error);
            setError(`Commitment generation failed: ${error.message}`);
        }
    };

    /**
     * Execute deposit to shielded pool
     */
    const executeDeposit = async () => {
        if (!generatedCommitment) {
            setError('Please generate commitment first');
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();

            const result = await shieldedPoolService.deposit(
                generatedCommitment,
                signer,
                chain.id
            );

            console.log('Deposit completed:', result);
            
            // Update pool status
            const status = shieldedPoolService.getStatus();
            setPoolStatus(status);
            
            // Reset form
            setDepositAmount('');
            setDepositSecret('');
            setDepositNullifier('');
            setGeneratedCommitment(null);
            
            if (onDepositComplete) {
                onDepositComplete(result);
            }

        } catch (error) {
            console.error('Deposit failed:', error);
            setError(`Deposit failed: ${error.message}`);
            
            if (onError) {
                onError(error);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    /**
     * Execute private swap
     */
    const executePrivateSwap = async () => {
        if (!swapCommitment || !swapSecret || !swapNullifier) {
            setError('Please fill all swap fields');
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            // Find commitment in the tree
            const commitmentIndex = poolStatus?.commitmentsLoaded || 0;
            
            // Generate nullifier hash
            const nullifierHash = shieldedPoolService.generateNullifierHash(
                swapNullifier,
                commitmentIndex
            );

            // Check if nullifier is already spent
            const isSpent = await shieldedPoolService.isNullifierSpent(nullifierHash, chain.id);
            if (isSpent) {
                throw new Error('This commitment has already been spent');
            }

            // Generate new commitment for output
            const newRandomValues = shieldedPoolService.generateRandomValues();
            const outputAmount = ethers.parseEther(swapAmountOut || '0');
            const newCommitment = shieldedPoolService.generateCommitment(
                newRandomValues.secret,
                newRandomValues.nullifier,
                outputAmount.toString(),
                swapTokenOut || ethers.ZeroAddress
            );

            // Prepare swap data
            const swapData = {
                tokenIn: ethers.ZeroAddress, // ETH
                tokenOut: swapTokenOut || ethers.ZeroAddress,
                amountIn: ethers.parseEther(depositAmount || '0').toString(),
                minAmountOut: outputAmount.toString(),
                nullifierHash: nullifierHash,
                newCommitment: newCommitment.commitment,
                recipient: address,
                routerData: '0x' // Would contain 1inch router data
            };

            // Mock ZK proof (in production, this would be generated by the circuit)
            const zkProof = {
                proof: [
                    '0x1234567890123456789012345678901234567890123456789012345678901234',
                    '0x1234567890123456789012345678901234567890123456789012345678901234',
                    '0x1234567890123456789012345678901234567890123456789012345678901234',
                    '0x1234567890123456789012345678901234567890123456789012345678901234',
                    '0x1234567890123456789012345678901234567890123456789012345678901234',
                    '0x1234567890123456789012345678901234567890123456789012345678901234',
                    '0x1234567890123456789012345678901234567890123456789012345678901234',
                    '0x1234567890123456789012345678901234567890123456789012345678901234'
                ]
            };

            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();

            const result = await shieldedPoolService.privateSwap(
                swapData,
                zkProof,
                signer,
                chain.id
            );

            console.log('Private swap completed:', result);
            
            // Update pool status
            const status = shieldedPoolService.getStatus();
            setPoolStatus(status);
            
            // Reset form
            setSwapCommitment('');
            setSwapSecret('');
            setSwapNullifier('');
            setSwapTokenOut('');
            setSwapAmountOut('');
            
            if (onSwapComplete) {
                onSwapComplete(result);
            }

        } catch (error) {
            console.error('Private swap failed:', error);
            setError(`Private swap failed: ${error.message}`);
            
            if (onError) {
                onError(error);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    /**
     * Execute withdrawal from shielded pool
     */
    const executeWithdraw = async () => {
        if (!withdrawCommitment || !withdrawSecret || !withdrawNullifier || !withdrawRecipient) {
            setError('Please fill all withdrawal fields');
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            // Find commitment and generate proof
            const commitmentIndex = 0; // Would need to find actual index
            const nullifierHash = shieldedPoolService.generateNullifierHash(
                withdrawNullifier,
                commitmentIndex
            );

            // Check if nullifier is already spent
            const isSpent = await shieldedPoolService.isNullifierSpent(nullifierHash, chain.id);
            if (isSpent) {
                throw new Error('This commitment has already been spent');
            }

            // Get current root
            const root = await shieldedPoolService.getCurrentRoot(chain.id);

            // Prepare withdrawal data
            const withdrawData = {
                root: root,
                nullifierHash: nullifierHash,
                commitmentHash: withdrawCommitment,
                recipient: withdrawRecipient,
                relayer: address, // Self-relay
                fee: '0',
                refund: '0'
            };

            // Mock ZK proof
            const zkProof = {
                proof: [
                    '0x1234567890123456789012345678901234567890123456789012345678901234',
                    '0x1234567890123456789012345678901234567890123456789012345678901234',
                    '0x1234567890123456789012345678901234567890123456789012345678901234',
                    '0x1234567890123456789012345678901234567890123456789012345678901234',
                    '0x1234567890123456789012345678901234567890123456789012345678901234',
                    '0x1234567890123456789012345678901234567890123456789012345678901234',
                    '0x1234567890123456789012345678901234567890123456789012345678901234',
                    '0x1234567890123456789012345678901234567890123456789012345678901234'
                ]
            };

            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();

            const result = await shieldedPoolService.withdraw(
                withdrawData,
                zkProof,
                signer,
                chain.id
            );

            console.log('Withdrawal completed:', result);
            
            // Update pool status
            const status = shieldedPoolService.getStatus();
            setPoolStatus(status);
            
            // Reset form
            setWithdrawCommitment('');
            setWithdrawSecret('');
            setWithdrawNullifier('');
            setWithdrawRecipient('');
            setWithdrawAmount('');
            
            if (onWithdrawComplete) {
                onWithdrawComplete(result);
            }

        } catch (error) {
            console.error('Withdrawal failed:', error);
            setError(`Withdrawal failed: ${error.message}`);
            
            if (onError) {
                onError(error);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isConnected) {
        return (
            <div className="shielded-pool">
                <h3>Shielded Pool</h3>
                <p>Please connect your wallet to use the shielded pool</p>
            </div>
        );
    }

    return (
        <div className="shielded-pool">
            <div className="pool-header">
                <h3>🛡️ Shielded Pool</h3>
                <div className="pool-status">
                    {isInitialized ? (
                        <span className="status-ready">🟢 Ready</span>
                    ) : (
                        <span className="status-loading">🔄 Loading...</span>
                    )}
                </div>
            </div>

            {/* Pool Statistics */}
            {poolStatus && (
                <div className="pool-stats">
                    <h4>Pool Statistics</h4>
                    <div className="stats-grid">
                        <div className="stat-item">
                            <span className="label">Anonymity Set Size:</span>
                            <span className="value">{poolStatus.anonymitySetSize}</span>
                        </div>
                        <div className="stat-item">
                            <span className="label">Total Deposits:</span>
                            <span className="value">{poolStatus.commitmentsLoaded}</span>
                        </div>
                        <div className="stat-item">
                            <span className="label">Nullifiers Tracked:</span>
                            <span className="value">{poolStatus.nullifiersTracked}</span>
                        </div>
                        <div className="stat-item">
                            <span className="label">Merkle Tree:</span>
                            <span className="value">{poolStatus.merkleTreeReady ? '✅ Ready' : '❌ Not Ready'}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Navigation */}
            <div className="tab-navigation">
                <button
                    onClick={() => setActiveTab('deposit')}
                    className={`tab-button ${activeTab === 'deposit' ? 'active' : ''}`}
                >
                    Deposit
                </button>
                <button
                    onClick={() => setActiveTab('swap')}
                    className={`tab-button ${activeTab === 'swap' ? 'active' : ''}`}
                >
                    Private Swap
                </button>
                <button
                    onClick={() => setActiveTab('withdraw')}
                    className={`tab-button ${activeTab === 'withdraw' ? 'active' : ''}`}
                >
                    Withdraw
                </button>
            </div>

            {/* Deposit Tab */}
            {activeTab === 'deposit' && (
                <div className="tab-content">
                    <h4>Deposit to Shielded Pool</h4>
                    <div className="form-group">
                        <label>Amount (ETH):</label>
                        <input
                            type="number"
                            value={depositAmount}
                            onChange={(e) => setDepositAmount(e.target.value)}
                            placeholder="0.1"
                            step="0.01"
                            min="0"
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Secret:</label>
                        <input
                            type="text"
                            value={depositSecret}
                            onChange={(e) => setDepositSecret(e.target.value)}
                            placeholder="Your secret (keep this safe!)"
                        />
                        <button onClick={generateRandomValues} className="generate-btn">
                            Generate Random
                        </button>
                    </div>
                    
                    <div className="form-group">
                        <label>Nullifier:</label>
                        <input
                            type="text"
                            value={depositNullifier}
                            onChange={(e) => setDepositNullifier(e.target.value)}
                            placeholder="Your nullifier (keep this safe!)"
                        />
                    </div>

                    {generatedCommitment && (
                        <div className="commitment-display">
                            <h5>Generated Commitment:</h5>
                            <p className="commitment-hash">{generatedCommitment.commitment}</p>
                        </div>
                    )}

                    <div className="action-buttons">
                        <button
                            onClick={generateCommitment}
                            disabled={!depositAmount || !depositSecret || !depositNullifier}
                            className="generate-commitment-btn"
                        >
                            Generate Commitment
                        </button>
                        
                        <button
                            onClick={executeDeposit}
                            disabled={!generatedCommitment || isProcessing}
                            className="deposit-btn"
                        >
                            {isProcessing ? 'Depositing...' : 'Deposit'}
                        </button>
                    </div>
                </div>
            )}

            {/* Private Swap Tab */}
            {activeTab === 'swap' && (
                <div className="tab-content">
                    <h4>Private Swap</h4>
                    <div className="form-group">
                        <label>Commitment Hash:</label>
                        <input
                            type="text"
                            value={swapCommitment}
                            onChange={(e) => setSwapCommitment(e.target.value)}
                            placeholder="Your commitment hash"
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Secret:</label>
                        <input
                            type="text"
                            value={swapSecret}
                            onChange={(e) => setSwapSecret(e.target.value)}
                            placeholder="Your secret"
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Nullifier:</label>
                        <input
                            type="text"
                            value={swapNullifier}
                            onChange={(e) => setSwapNullifier(e.target.value)}
                            placeholder="Your nullifier"
                        />
                    </div>

                    <div className="form-group">
                        <label>Output Token:</label>
                        <input
                            type="text"
                            value={swapTokenOut}
                            onChange={(e) => setSwapTokenOut(e.target.value)}
                            placeholder="0x... (token address)"
                        />
                    </div>

                    <div className="form-group">
                        <label>Expected Output Amount:</label>
                        <input
                            type="number"
                            value={swapAmountOut}
                            onChange={(e) => setSwapAmountOut(e.target.value)}
                            placeholder="0.1"
                            step="0.01"
                            min="0"
                        />
                    </div>

                    <div className="action-buttons">
                        <button
                            onClick={executePrivateSwap}
                            disabled={!swapCommitment || !swapSecret || !swapNullifier || isProcessing}
                            className="swap-btn"
                        >
                            {isProcessing ? 'Swapping...' : 'Execute Private Swap'}
                        </button>
                    </div>
                </div>
            )}

            {/* Withdraw Tab */}
            {activeTab === 'withdraw' && (
                <div className="tab-content">
                    <h4>Withdraw from Shielded Pool</h4>
                    <div className="form-group">
                        <label>Commitment Hash:</label>
                        <input
                            type="text"
                            value={withdrawCommitment}
                            onChange={(e) => setWithdrawCommitment(e.target.value)}
                            placeholder="Your commitment hash"
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Secret:</label>
                        <input
                            type="text"
                            value={withdrawSecret}
                            onChange={(e) => setWithdrawSecret(e.target.value)}
                            placeholder="Your secret"
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Nullifier:</label>
                        <input
                            type="text"
                            value={withdrawNullifier}
                            onChange={(e) => setWithdrawNullifier(e.target.value)}
                            placeholder="Your nullifier"
                        />
                    </div>

                    <div className="form-group">
                        <label>Recipient Address:</label>
                        <input
                            type="text"
                            value={withdrawRecipient}
                            onChange={(e) => setWithdrawRecipient(e.target.value)}
                            placeholder="0x... (recipient address)"
                        />
                    </div>

                    <div className="action-buttons">
                        <button
                            onClick={executeWithdraw}
                            disabled={!withdrawCommitment || !withdrawSecret || !withdrawNullifier || !withdrawRecipient || isProcessing}
                            className="withdraw-btn"
                        >
                            {isProcessing ? 'Withdrawing...' : 'Withdraw'}
                        </button>
                    </div>
                </div>
            )}

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

export default ShieldedPool;
