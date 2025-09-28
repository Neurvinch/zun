import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import zkProofService from '../services/zkProofService';
import GaslessTransaction from './GaslessTransaction';
import ShieldedPool from './ShieldedPool';
import CustomIdentityVerification from './CustomIdentityVerification';
import customIdentityService from '../services/customIdentityService';
import './UserWallet.css';
import { ethers } from 'ethers';
import { getSupportedTokens, getTokenMetadata, getSwapLimits } from '../config/tokens';
import { publicClientToProvider } from '../utils/viem-ethers-adapter';
import ZKVaultClient from './ZKVaultClient';
import FilecoinStorage from './FilecoinStorage';
import ReceiptManager from './ReceiptManager';
import OneInchSwap from './OneInchSwap';

// Minimal ERC20 ABI used for balance/metadata
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];
 const UserWallet = ({ provider, signer, userAddress }) => {
   const { address, isConnected, chain } = useAccount();
   const publicClient = usePublicClient();
   const { data: walletClient } = useWalletClient();

   // State
   const [tokenBalances, setTokenBalances] = useState({});
   const [isLoading, setIsLoading] = useState(false);
   const [selectedToken, setSelectedToken] = useState('ETH');
   const [swapAmount, setSwapAmount] = useState('');
   const [eligibilityStatus, setEligibilityStatus] = useState(null);
   const [zkPrivateKey, setZkPrivateKey] = useState(null);
   const [nonce, setNonce] = useState(null);
   const [proofData, setProofData] = useState(null);
   const [isGeneratingProof, setIsGeneratingProof] = useState(false);
   const [showStep2, setShowStep2] = useState(false);
   const [step2Result, setStep2Result] = useState(null);
   const [error, setError] = useState(null);
   const [showOneInchSwap, setShowOneInchSwap] = useState(false);
   const [showFilecoinStorage, setShowFilecoinStorage] = useState(false);
   const [showReceiptManager, setShowReceiptManager] = useState(false);
   const [showShieldedPool, setShowShieldedPool] = useState(false);
   const [showGaslessTransaction, setShowGaslessTransaction] = useState(false);
   const [gaslessTransactionData, setGaslessTransactionData] = useState(null);
   const [customVerificationStatus, setCustomVerificationStatus] = useState(null);
   const [showCustomVerification, setShowCustomVerification] = useState(false);

   const checkCustomVerificationStatus = useCallback(async () => {
     if (!address) return;
     try {
       const status = await customIdentityService.getUserVerificationStatus(address);
       setCustomVerificationStatus(status);
     } catch (_) { /* noop */ }
   }, [address]);

   // Convert publicClient to ethers provider for token balance fetching
   const getEthersProvider = useCallback(() => {
     if (!publicClient) return null;
     try {
       return publicClientToProvider(publicClient);
     } catch (error) {
       console.error('Failed to convert publicClient to provider:', error);
       return null;
     }
   }, [publicClient]);

    // Fetch ETH balance
    const fetchETHBalance = async () => {
        const provider = getEthersProvider();
        if (!provider || !address) return null;

        try {
            const balance = await provider.getBalance(address);
            return {
                value: balance,
                decimals: 18,
                symbol: 'ETH',
                formatted: ethers.formatEther(balance)
            };
        } catch (error) {
            console.error('Failed to fetch ETH balance:', error);
            return null;
        }
    };

    // Fetch ERC20 token balance
    const fetchTokenBalance = async (tokenAddress, userAddress) => {
        const provider = getEthersProvider();
        if (!provider) return null;

        try {
            const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
            
            const [balance, decimals, symbol] = await Promise.all([
                contract.balanceOf(userAddress),
                contract.decimals(),
                contract.symbol()
            ]);

            return {
                value: balance,
                decimals: Number(decimals),
                symbol: symbol,
                formatted: ethers.formatUnits(balance, decimals)
            };
        } catch (error) {
            console.error(`Failed to fetch token balance for ${tokenAddress}:`, error);
            return {
                value: 0n,
                decimals: 18,
                symbol: 'UNKNOWN',
                formatted: '0.00'
            };
        }
    };

    // Fetch all token balances
    const fetchTokenBalances = useCallback(async () => {
        if (!address || !chain || !provider || !isConnected) return;

        setIsLoading(true);
        try {
            const supportedTokens = getSupportedTokens(chain.id);
            const balances = {};

            // Fetch ETH balance
            const ethBalance = await fetchETHBalance();
            if (ethBalance) {
                balances.ETH = ethBalance;
            }

            // Fetch token balances
            for (const [symbol, tokenAddress] of Object.entries(supportedTokens)) {
                try {
                    const balance = await fetchTokenBalance(tokenAddress, address);
                    if (balance) {
                        balances[symbol] = balance;
                    }
                } catch (error) {
                    console.error(`Failed to fetch ${symbol} balance:`, error);
                    balances[symbol] = {
                        value: 0n,
                        decimals: 18,
                        symbol: symbol,
                        formatted: '0.00'
                    };
                }
            }

            setTokenBalances(balances);
            console.log('Token balances fetched:', balances);
        } catch (error) {
            console.error('Failed to fetch token balances:', error);
            setError('Failed to fetch token balances');
        } finally {
            setIsLoading(false);
        }
    }, [address, chain, provider, isConnected]);

    // Initialize ZK private key from wallet signature
    const initializeZKKey = useCallback(async () => {
        if (!address || zkPrivateKey || !signer) return;

        try {
            const message = `ZKVault Key Derivation for ${address}`;
            const signature = await signer.signMessage(message);
            
            const derivedKey = zkProofService.deriveZKPrivateKey(signature);
            setZkPrivateKey(derivedKey);
            
            // Generate a new nonce for this session
            const newNonce = zkProofService.generateNonce();
            setNonce(newNonce);
            
            console.log('ZK private key initialized');
        } catch (error) {
            console.error('Failed to initialize ZK key:', error);
            setError('Failed to initialize ZK key');
        }
    }, [address, signer, zkPrivateKey]);

    // Check swap eligibility
    const checkEligibility = useCallback(async () => {
        if (!address || !selectedToken || !swapAmount) return;

        try {
            const tokenBalance = tokenBalances[selectedToken];
            if (!tokenBalance) return;

            const swapAmountWei = ethers.parseUnits(swapAmount, tokenBalance.decimals);
            const swapLimits = getSwapLimits(selectedToken);
            const minBalanceWei = ethers.parseUnits(swapLimits.minBalance, tokenBalance.decimals);
            const maxSwapAmountWei = ethers.parseUnits(swapLimits.maxSwap, tokenBalance.decimals);
            const minSwapAmountWei = ethers.parseUnits(swapLimits.minSwap, tokenBalance.decimals);

            // Check basic eligibility
            const hasMinBalance = tokenBalance.value >= minBalanceWei + swapAmountWei;
            const withinSwapLimits = swapAmountWei <= maxSwapAmountWei && swapAmountWei >= minSwapAmountWei;
            const isHumanVerified = customVerificationStatus?.isVerified || false;

            const eligible = hasMinBalance && withinSwapLimits && isHumanVerified;

            setEligibilityStatus({
                eligible,
                hasMinBalance,
                withinSwapLimits,
                isHumanVerified: customVerificationStatus?.isVerified || false,
                balance: tokenBalance.formatted,
                swapAmount: swapAmount,
                token: selectedToken,
                limits: swapLimits
            });

        } catch (error) {
            console.error('Eligibility check failed:', error);
            setError('Eligibility check failed');
        }
    }, [address, selectedToken, swapAmount, tokenBalances]);

    // Generate ZK proof for swap
    const generateSwapProof = async () => {
        if (!eligibilityStatus?.eligible || !zkPrivateKey || !nonce) {
            setError('Prerequisites not met for proof generation');
            return;
        }

        setIsGeneratingProof(true);
        setError(null);

        try {
            const tokenBalance = tokenBalances[selectedToken];
            const swapAmountWei = ethers.parseUnits(swapAmount, tokenBalance.decimals);
            const balanceWei = tokenBalance.value;
            const swapLimits = getSwapLimits(selectedToken);

            // Prepare private inputs (witness)
            const privateInputs = {
                balance: balanceWei.toString(),
                swapAmount: swapAmountWei.toString(),
                privateKey: zkPrivateKey,
                nonce: nonce,
                eligibilityFlag: eligibilityStatus.eligible ? 1 : 0
            };

            // Prepare public inputs
            const publicInputs = {
                minBalance: ethers.parseUnits(swapLimits.minBalance, tokenBalance.decimals).toString(),
                maxSwapAmount: ethers.parseUnits(swapLimits.maxSwap, tokenBalance.decimals).toString(),
                merkleRoot: '0x1234567890abcdef' // Placeholder merkle root
            };

            console.log('Generating ZK proof...');
            const proof = await zkProofService.generateSwapProof(privateInputs, publicInputs);

            // Verify proof locally
            const isValid = await zkProofService.verifyProof(proof.proof, proof.publicSignals);
            
            if (!isValid) {
                throw new Error('Generated proof is invalid');
            }

            const supportedTokens = getSupportedTokens(chain.id);
            setProofData({
                ...proof,
                timestamp: Date.now(),
                tokenAddress: selectedToken === 'ETH' ? '0x0000000000000000000000000000000000000000' : supportedTokens[selectedToken],
                userAddress: address,
                chainId: chain.id
            });

            console.log('ZK proof generated successfully:', proof);

        } catch (error) {
            console.error('Proof generation failed:', error);
            setError(`Proof generation failed: ${error.message}`);
        } finally {
            setIsGeneratingProof(false);
        }
    };

    // Sign meta-transaction
    const signMetaTransaction = async () => {
        if (!proofData || !address || !signer) return;

        try {
            const metaTxData = {
                from: address,
                to: '0x0000000000000000000000000000000000000000', // ZKVault contract address
                value: 0,
                data: '0x', // Encoded swap data
                nonce: nonce,
                proof: proofData.proof,
                publicSignals: proofData.publicSignals,
                timestamp: proofData.timestamp
            };

            const message = JSON.stringify(metaTxData);
            const signature = await signer.signMessage(message);

            const signedMetaTx = {
                ...metaTxData,
                signature
            };

            console.log('Meta-transaction signed:', signedMetaTx);
            return signedMetaTx;

        } catch (error) {
            console.error('Meta-transaction signing failed:', error);
            setError('Failed to sign meta-transaction');
        }
    };

    // Step 2 workflow callbacks
    const handleStep2Complete = (result) => {
        setStep2Result(result);
        console.log('Step 2 workflow completed:', result);
    };

    const handleStep2Error = (error) => {
        setError(`Step 2 failed: ${error.message}`);
        console.error('Step 2 workflow error:', error);
    };


    // Gasless transaction callbacks
    const handleGaslessTransactionComplete = (result) => {
        console.log('Gasless transaction completed:', result);
        setShowGaslessTransaction(false);
        setGaslessTransactionData(null);
        
        // Refresh balances after successful transaction
        setTimeout(() => {
            fetchTokenBalances();
        }, 5000);
    };

    const handleGaslessTransactionError = (error) => {
        setError(`Gasless transaction failed: ${error.message}`);
        console.error('Gasless transaction error:', error);
    };

    // Prepare gasless transaction data
    const prepareGaslessTransaction = () => {
        if (!selectedToken || !swapAmount || !proofData) {
            return null;
        }

        // This would be the actual swap transaction data
        // For now, we'll create a mock transaction
        return {
            to: '0x1234567890123456789012345678901234567890', // ZKVault contract address
            data: '0x12345678', // Encoded swap function call
            gasLimit: 300000,
            value: '0x0'
        };
    };

    // Shielded pool callbacks
    const handleShieldedPoolDeposit = (result) => {
        console.log('Shielded pool deposit completed:', result);
        // Refresh balances after deposit
        setTimeout(() => {
            fetchTokenBalances();
        }, 5000);
    };

    const handleShieldedPoolSwap = (result) => {
        console.log('Shielded pool swap completed:', result);
        // Refresh balances after swap
        setTimeout(() => {
            fetchTokenBalances();
        }, 5000);
    };

    const handleShieldedPoolWithdraw = (result) => {
        console.log('Shielded pool withdrawal completed:', result);
        // Refresh balances after withdrawal
        setTimeout(() => {
            fetchTokenBalances();
        }, 5000);
    };

    const handleShieldedPoolError = (error) => {
        setError(`Shielded pool operation failed: ${error.message}`);
        console.error('Shielded pool error:', error);
    };

    // 1inch swap callbacks
    const handleOneInchSwapComplete = (result) => {
        console.log('1inch swap completed:', result);
        // Refresh balances after swap
        setTimeout(() => {
            fetchTokenBalances();
        }, 5000);
    };

    const handleOneInchSwapError = (error) => {
        setError(`1inch swap failed: ${error.message}`);
        console.error('1inch swap error:', error);
    };

    // Filecoin storage callbacks
    const handleFilecoinStorageComplete = (result) => {
        console.log('Filecoin storage completed:', result);
        // Could trigger UI updates or notifications
    };

    const handleFilecoinRetrievalComplete = (result) => {
        console.log('Filecoin retrieval completed:', result);
        // Could display retrieved data or update UI
    };

    const handleFilecoinStorageError = (error) => {
        setError(`Filecoin storage operation failed: ${error.message}`);
        console.error('Filecoin storage error:', error);
    };

    // Receipt manager callbacks
    const handleReceiptLoad = (result) => {
        console.log('Receipt loaded:', result);
        // Could display receipt data or update UI
    };

    const handleReceiptManagerError = (error) => {
        setError(`Receipt manager operation failed: ${error.message}`);
        console.error('Receipt manager error:', error);
    };

    // Prepare swap parameters for Step 2
    const prepareSwapParams = () => {
        if (!selectedToken || !swapAmount || !tokenBalances[selectedToken] || !zkPrivateKey || !nonce) {
            return null;
        }

        const tokenBalance = tokenBalances[selectedToken];
        const supportedTokens = getSupportedTokens(chain.id);
        
        return {
            tokenAddress: selectedToken === 'ETH' ? '0x0000000000000000000000000000000000000000' : supportedTokens[selectedToken],
            tokenIn: {
                symbol: selectedToken,
                address: selectedToken === 'ETH' ? '0x0000000000000000000000000000000000000000' : supportedTokens[selectedToken],
                decimals: tokenBalance.decimals
            },
            tokenOut: {
                symbol: 'USDC', // Default output token
                address: supportedTokens['USDC'] || '0x0000000000000000000000000000000000000000',
                decimals: 6
            },
            swapAmount: ethers.parseUnits(swapAmount, tokenBalance.decimals),
            balance: tokenBalance.value,
            zkPrivateKey: zkPrivateKey,
            nonce: nonce,
            eligibilityFlag: eligibilityStatus?.eligible || false,
            userAddress: address,
            chainId: chain.id
        };
    };

    // Prepare user wallet data for Step 2
    const prepareUserWalletData = () => {
        if (!selectedToken || !tokenBalances[selectedToken]) {
            return null;
        }

        const tokenBalance = tokenBalances[selectedToken];
        const swapLimits = getSwapLimits(selectedToken);

        return {
            minBalance: ethers.parseUnits(swapLimits.minBalance, tokenBalance.decimals),
            maxSwapAmount: ethers.parseUnits(swapLimits.maxSwap, tokenBalance.decimals),
            merkleRoot: '0x1234567890abcdef' // Placeholder merkle root
        };
    };

    // Effects
    useEffect(() => {
        if (isConnected && publicClient && address) {
            fetchTokenBalances();
        }
    }, [isConnected, publicClient, address, fetchTokenBalances]);

    useEffect(() => {
        const initServices = async () => {
            if (isConnected && address && walletClient && publicClient) {
                try {
                    await initializeZKKey();
                    await customIdentityService.initialize(publicClient, walletClient);
                    await checkCustomVerificationStatus();
                } catch (error) {
                    console.warn('Failed to initialize services:', error.message);
                    // Don't set error state for initialization failures
                }
            }
        };
        
        // Add a delay to ensure wallet is fully connected
        const timeoutId = setTimeout(initServices, 200);
        return () => clearTimeout(timeoutId);
    }, [isConnected, address, walletClient, publicClient, initializeZKKey, checkCustomVerificationStatus]);

    useEffect(() => {
        checkEligibility();
    }, [checkEligibility]);

    // Render
    if (!isConnected) {
        return (
            <div className="wallet-container">
                <h2>ZKVault User Wallet</h2>
                <p>Please connect your wallet to continue</p>
            </div>
        );
    }

    return (
        <div className="wallet-container">
            <div className="wallet-header">
                <div className="header-content">
                    <div className="wallet-title">
                        <div className="title-icon">🔐</div>
                        <h2>ZKVault User Wallet</h2>
                    </div>
                    <div className="wallet-status">
                        <div className="status-indicator connected"></div>
                        <span className="status-text">Connected</span>
                    </div>
                </div>
                <div className="wallet-info">
                    <div className="info-item">
                        <span className="info-label">Address:</span>
                        <span className="wallet-address">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">Network:</span>
                        <span className="chain-info">{chain?.name}</span>
                    </div>
                </div>
            </div>

            {/* Token Balances */}
            <div className="balances-section">
                <div className="section-header">
                    <h3>
                        <span className="section-icon">💰</span>
                        Token Balances
                    </h3>
                    {isLoading && (
                        <div className="loading-spinner">
                            <div className="spinner"></div>
                            <span>Loading...</span>
                        </div>
                    )}
                    <button 
                        onClick={fetchTokenBalances} 
                        className="refresh-btn"
                        disabled={isLoading}
                        title="Refresh balances"
                    >
                        🔄
                    </button>
                </div>
                <div className="balance-grid">
                    {Object.entries(tokenBalances).map(([symbol, balance]) => {
                        const metadata = getTokenMetadata(symbol);
                        return (
                            <div key={symbol} className="balance-item">
                                <div className="token-header">
                                    <div className="token-info">
                                        <span className="token-icon">{metadata.icon}</span>
                                        <span className="token-symbol">{symbol}</span>
                                    </div>
                                    <div className="balance-value">
                                        <span className="token-balance">
                                            {balance ? parseFloat(balance.formatted).toFixed(4) : '0.0000'}
                                        </span>
                                        <span className="balance-label">{symbol}</span>
                                    </div>
                                </div>
                                <div className="balance-actions">
                                    <button 
                                        className="action-btn"
                                        onClick={() => setSelectedToken(symbol)}
                                        title={`Select ${symbol} for swap`}
                                    >
                                        Select
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Swap Configuration */}
            <div className="swap-section">
                <div className="section-header">
                    <h3>
                        <span className="section-icon">🔄</span>
                        Configure Swap
                    </h3>
                </div>
                <div className="swap-form">
                    <div className="input-group">
                        <label className="input-label">From Token</label>
                        <div className="select-wrapper">
                            <select 
                                value={selectedToken} 
                                onChange={(e) => setSelectedToken(e.target.value)}
                                className="token-select"
                            >
                                {Object.keys(tokenBalances).map(symbol => {
                                    const metadata = getTokenMetadata(symbol);
                                    return (
                                        <option key={symbol} value={symbol}>
                                            {metadata.icon} {symbol}
                                        </option>
                                    );
                                })}
                            </select>
                            <span className="select-arrow">▼</span>
                        </div>
                        {selectedToken && tokenBalances[selectedToken] && (
                            <div className="balance-info">
                                <span>Available: {parseFloat(tokenBalances[selectedToken].formatted).toFixed(4)} {selectedToken}</span>
                                <button 
                                    className="max-btn"
                                    onClick={() => setSwapAmount(tokenBalances[selectedToken].formatted)}
                                >
                                    MAX
                                </button>
                            </div>
                        )}
                    </div>
                    
                    <div className="input-group">
                        <label className="input-label">Amount</label>
                        <div className="amount-wrapper">
                            <input
                                type="number"
                                placeholder="0.00"
                                value={swapAmount}
                                onChange={(e) => setSwapAmount(e.target.value)}
                                className="amount-input"
                                step="0.0001"
                                min="0"
                            />
                            <span className="amount-currency">{selectedToken}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Eligibility Status */}
            {eligibilityStatus && (
                <div className={`eligibility-section ${eligibilityStatus.eligible ? 'eligible' : 'not-eligible'}`}>
                    <div className="section-header">
                        <h3>
                            <span className="section-icon">{eligibilityStatus.eligible ? '✅' : '⚠️'}</span>
                            Eligibility Status
                        </h3>
                        <div className={`eligibility-badge ${eligibilityStatus.eligible ? 'eligible' : 'not-eligible'}`}>
                            {eligibilityStatus.eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}
                        </div>
                    </div>
                    <div className="eligibility-checks">
                        <div className={`check-item ${eligibilityStatus.hasMinBalance ? 'pass' : 'fail'}`}>
                            <div className="check-icon">
                                {eligibilityStatus.hasMinBalance ? '✅' : '❌'}
                            </div>
                            <div className="check-content">
                                <span className="check-title">Minimum Balance</span>
                                <span className="check-status">
                                    {eligibilityStatus.hasMinBalance ? 'Sufficient balance' : 'Insufficient balance'}
                                </span>
                            </div>
                        </div>
                        
                        <div className={`check-item ${eligibilityStatus.withinSwapLimits ? 'pass' : 'fail'}`}>
                            <div className="check-icon">
                                {eligibilityStatus.withinSwapLimits ? '✅' : '❌'}
                            </div>
                            <div className="check-content">
                                <span className="check-title">Swap Limits</span>
                                <span className="check-status">
                                    {eligibilityStatus.withinSwapLimits ? 'Within limits' : 'Outside limits'}
                                </span>
                            </div>
                        </div>
                        
                        <div className={`check-item ${eligibilityStatus.isHumanVerified ? 'pass' : 'fail'}`}>
                            <div className="check-icon">
                                {eligibilityStatus.isHumanVerified ? '✅' : '❌'}
                            </div>
                            <div className="check-content">
                                <span className="check-title">Identity Verification</span>
                                <span className="check-status">
                                    {eligibilityStatus.isHumanVerified ? 'Verified' : 'Not verified'}
                                </span>
                                {!eligibilityStatus.isHumanVerified && (
                                    <button 
                                        onClick={() => setShowCustomVerification(true)}
                                        className="verify-human-btn"
                                    >
                                        🔐 Verify Identity
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ZK Proof Generation */}
            <div className="proof-section">
                <div className="section-header">
                    <h3>
                        <span className="section-icon">🔒</span>
                        Zero-Knowledge Proof
                    </h3>
                    {zkPrivateKey && (
                        <div className="zk-status">
                            <span className="status-indicator success"></span>
                            <span>ZK Key Ready</span>
                        </div>
                    )}
                </div>
                
                <div className="proof-controls">
                    <button
                        onClick={generateSwapProof}
                        disabled={!eligibilityStatus?.eligible || isGeneratingProof}
                        className={`generate-proof-btn ${isGeneratingProof ? 'generating' : ''}`}
                    >
                        {isGeneratingProof ? (
                            <>
                                <div className="btn-spinner"></div>
                                Generating Proof...
                            </>
                        ) : (
                            <>
                                🔐 Generate ZK Proof
                            </>
                        )}
                    </button>
                </div>

                {proofData && (
                    <div className="proof-data">
                        <div className="proof-header">
                            <h4>
                                <span className="proof-icon">🎯</span>
                                Generated Proof
                            </h4>
                            <div className="proof-status success">
                                <span className="status-indicator success"></span>
                                <span>Valid</span>
                            </div>
                        </div>
                        
                        <div className="proof-details">
                            <div className="detail-item">
                                <span className="detail-label">Nullifier:</span>
                                <span className="detail-value">{proofData.nullifier?.slice(0, 10)}...{proofData.nullifier?.slice(-6)}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Commitment:</span>
                                <span className="detail-value">{proofData.commitment?.slice(0, 10)}...{proofData.commitment?.slice(-6)}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Eligible:</span>
                                <span className={`detail-value ${proofData.isEligible ? 'success' : 'error'}`}>
                                    {proofData.isEligible ? '✅ Yes' : '❌ No'}
                                </span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Generated:</span>
                                <span className="detail-value">{new Date(proofData.timestamp).toLocaleString()}</span>
                            </div>
                        </div>
                        
                        <div className="action-grid">
                            <button
                                onClick={signMetaTransaction}
                                className="action-btn primary"
                            >
                                📝 Sign Meta-Transaction
                            </button>

                            <button
                                onClick={() => setShowStep2(true)}
                                className="action-btn secondary"
                                disabled={!proofData}
                            >
                                🔄 Execute Step 2 Workflow
                            </button>

                            <button
                                onClick={() => {
                                    const txData = prepareGaslessTransaction();
                                    setGaslessTransactionData(txData);
                                    setShowGaslessTransaction(true);
                                }}
                                className="action-btn primary"
                                disabled={!proofData || !eligibilityStatus?.eligible}
                            >
                                ⚡ Execute Gasless Swap
                            </button>

                            <button
                                onClick={() => setShowShieldedPool(true)}
                                className="action-btn secondary"
                                disabled={!eligibilityStatus?.eligible}
                            >
                                🛡️ Open Shielded Pool
                            </button>

                            <button
                                onClick={() => setShowOneInchSwap(true)}
                                className="action-btn tertiary"
                            >
                                🔄 1inch Swap
                            </button>

                            <button
                                onClick={() => setShowFilecoinStorage(true)}
                                className="action-btn tertiary"
                            >
                                📁 Filecoin Storage
                            </button>

                            <button
                                onClick={() => setShowReceiptManager(true)}
                                className="action-btn tertiary"
                            >
                                🧾 Receipt Manager
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Step 2: ZKVault Client */}
            {showStep2 && (
                <ZKVaultClient
                    swapParams={prepareSwapParams()}
                    userWalletData={prepareUserWalletData()}
                    onWorkflowComplete={handleStep2Complete}
                    onError={handleStep2Error}
                />
            )}

            {/* Custom Identity Verification Modal */}
            {showCustomVerification && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>
                                <span className="modal-icon">🔐</span>
                                Identity Verification
                            </h3>
                            <button 
                                onClick={() => {
                                    setShowCustomVerification(false);
                                    checkCustomVerificationStatus();
                                }} 
                                className="modal-close-btn"
                                title="Close"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="modal-body">
                            <CustomIdentityVerification />
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2 Results */}
            {step2Result && (
                <div className="step2-results">
                    <div className="result-header">
                        <h3>
                            <span className="result-icon">🎉</span>
                            Step 2 Complete
                        </h3>
                        <div className="result-status success">
                            <span className="status-indicator success"></span>
                            <span>Success</span>
                        </div>
                    </div>
                    <div className="step2-details">
                        <div className="detail-item">
                            <span className="detail-label">Proof Package:</span>
                            <span className="detail-value success">✅ Generated</span>
                        </div>
                        <div className="detail-item">
                            <span className="detail-label">Receipt Template:</span>
                            <span className="detail-value success">✅ Prepared</span>
                        </div>
                        <div className="detail-item">
                            <span className="detail-label">Verification:</span>
                            <span className="detail-value success">✅ Submitted</span>
                        </div>
                        <div className="detail-item">
                            <span className="detail-label">ZKVault Tx:</span>
                            <span className="detail-value tx-hash">
                                {step2Result.submissionResult?.zkVaultTxHash?.slice(0, 10)}...{step2Result.submissionResult?.zkVaultTxHash?.slice(-6)}
                            </span>
                        </div>
                    </div>
                </div>
            )}



            {/* Step 4: Gasless Transaction */}
            {showGaslessTransaction && gaslessTransactionData && (
                <GaslessTransaction
                    transactionData={gaslessTransactionData}
                    contractAddress="0x1234567890123456789012345678901234567890" // ZKVault contract
                    onTransactionComplete={handleGaslessTransactionComplete}
                    onError={handleGaslessTransactionError}
                />
            )}

            {/* Step 5: Shielded Pool */}
            {showShieldedPool && (
                <ShieldedPool
                    onDepositComplete={handleShieldedPoolDeposit}
                    onSwapComplete={handleShieldedPoolSwap}
                    onWithdrawComplete={handleShieldedPoolWithdraw}
                    onError={handleShieldedPoolError}
                />
            )}

            {/* Step 6: 1inch Swap */}
            {showOneInchSwap && (
                <OneInchSwap
                    onSwapComplete={handleOneInchSwapComplete}
                    onError={handleOneInchSwapError}
                />
            )}

            {/* Step 7: Filecoin Storage */}
            {showFilecoinStorage && (
                <FilecoinStorage
                    onStorageComplete={handleFilecoinStorageComplete}
                    onRetrievalComplete={handleFilecoinRetrievalComplete}
                    onError={handleFilecoinStorageError}
                />
            )}

            {/* Step 8: Receipt Manager */}
            {showReceiptManager && (
                <ReceiptManager
                    onReceiptLoad={handleReceiptLoad}
                    onError={handleReceiptManagerError}
                />
            )}

            {/* Error Display */}
            {error && (
                <div className="error-section">
                    <div className="error-header">
                        <span className="error-icon">⚠️</span>
                        <span className="error-title">Error</span>
                        <button onClick={() => setError(null)} className="dismiss-error" title="Dismiss">
                            ✕
                        </button>
                    </div>
                    <p className="error-message">{error}</p>
                </div>
            )}
        </div>
    );
};
