import React, { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import zkProofService from '../services/zkProofService';
import GaslessTransaction from './GaslessTransaction';
import ShieldedPool from './ShieldedPool';
import CustomIdentityVerification from './CustomIdentityVerification';
import customIdentityService from '../services/customIdentityService';
import './UserWallet.css';
import { ethers } from 'ethers';
import { getSupportedTokens, getTokenMetadata, getSwapLimits } from '../config/tokens';
import ZKVaultClient from './ZKVaultClient';
import FilecoinStorage from './FilecoinStorage';
import ReceiptManager from './ReceiptManager';

// Minimal ERC20 ABI used for balance/metadata
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];
 const UserWallet = () => {
   const { address, isConnected, chain } = useAccount();

   // State
   const [provider, setProvider] = useState(null);
   const [signer, setSigner] = useState(null);
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

   const initializeProvider = useCallback(async () => {
     if (!isConnected || !window.ethereum) return;

     try {
       const web3Provider = new ethers.BrowserProvider(window.ethereum);
       const web3Signer = await web3Provider.getSigner();

       setProvider(web3Provider);
       setSigner(web3Signer);

       console.log('Ethers provider initialized');
     } catch (error) {
       console.error('Failed to initialize provider:', error);
       setError('Failed to initialize wallet connection');
     }
   }, [isConnected]);

    // Fetch ETH balance
    const fetchETHBalance = async () => {
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
        if (isConnected) {
            initializeProvider();
        }
    }, [isConnected, initializeProvider]);

    useEffect(() => {
        if (provider) {
            fetchTokenBalances();
        }
    }, [provider, fetchTokenBalances]);

    useEffect(() => {
        const initServices = async () => {
            if (isConnected && address && signer && provider) {
                await initializeZKKey();
                await customIdentityService.initialize(provider, signer);
                await checkCustomVerificationStatus();
            }
        };
        initServices();
    }, [isConnected, address, signer, provider, initializeZKKey, checkCustomVerificationStatus]);

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
                <h2>ZKVault User Wallet</h2>
                <p className="wallet-address">Connected: {address}</p>
                <p className="chain-info">Chain: {chain?.name}</p>
            </div>

            {/* Token Balances */}
            <div className="balances-section">
                <h3>Token Balances {isLoading && <span className="loading-indicator">Loading...</span>}</h3>
                <div className="balance-grid">
                    {Object.entries(tokenBalances).map(([symbol, balance]) => {
                        const metadata = getTokenMetadata(symbol);
                        return (
                            <div key={symbol} className="balance-item">
                                <div className="token-info">
                                    <span className="token-icon">{metadata.icon}</span>
                                    <span className="token-symbol">{symbol}</span>
                                </div>
                                <span className="token-balance">
                                    {balance ? balance.formatted : '0.00'}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Swap Configuration */}
            <div className="swap-section">
                <h3>Configure Swap</h3>
                <div className="swap-inputs">
                    <select 
                        value={selectedToken} 
                        onChange={(e) => setSelectedToken(e.target.value)}
                        className="token-select"
                    >
                        {Object.keys(tokenBalances).map(symbol => (
                            <option key={symbol} value={symbol}>{symbol}</option>
                        ))}
                    </select>
                    
                    <input
                        type="number"
                        placeholder="Swap Amount"
                        value={swapAmount}
                        onChange={(e) => setSwapAmount(e.target.value)}
                        className="amount-input"
                    />
                </div>
            </div>

            {/* Eligibility Status */}
            {eligibilityStatus && (
                <div className={`eligibility-section ${eligibilityStatus.eligible ? 'eligible' : 'not-eligible'}`}>
                    <h3>Eligibility Status</h3>
                    <div className="eligibility-checks">
                        <div className={`check ${eligibilityStatus.hasMinBalance ? 'pass' : 'fail'}`}>
                            ✓ Minimum Balance: {eligibilityStatus.hasMinBalance ? 'Pass' : 'Fail'}
                        </div>
                        <div className={`check ${eligibilityStatus.withinSwapLimits ? 'pass' : 'fail'}`}>
                            ✓ Swap Limits: {eligibilityStatus.withinSwapLimits ? 'Pass' : 'Fail'}
                        </div>
                        <div className={`check ${eligibilityStatus.isHumanVerified ? 'pass' : 'fail'}`}>
                            ✓ Identity Verified: {eligibilityStatus.isHumanVerified ? 'Pass' : 'Fail'}
                            {!eligibilityStatus.isHumanVerified && (
                                <button 
                                    onClick={() => setShowCustomVerification(true)}
                                    className="verify-human-btn"
                                >
                                    Verify Identity
                                </button>
                            )}
                        </div>
                        <div className={`check ${eligibilityStatus.isHumanVerified ? 'pass' : 'fail'}`}>
                            ✓ Identity Verified: {eligibilityStatus.isHumanVerified ? 'Pass' : 'Fail'}
                            {!eligibilityStatus.isHumanVerified && (
                                <button 
                                    onClick={() => setShowCustomVerification(true)}
                                    className="verify-human-btn"
                                >
                                    Verify Identity
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ZK Proof Generation */}
            <div className="proof-section">
                <h3>Zero-Knowledge Proof</h3>
                {zkPrivateKey && (
                    <p className="zk-status">✓ ZK Private Key Initialized</p>
                )}
                
                <button
                    onClick={generateSwapProof}
                    disabled={!eligibilityStatus?.eligible || isGeneratingProof}
                    className="generate-proof-btn"
                >
                    {isGeneratingProof ? 'Generating Proof...' : 'Generate ZK Proof'}
                </button>

                {proofData && (
                    <div className="proof-data">
                        <h4>Generated Proof</h4>
                        <div className="proof-details">
                            <p><strong>Nullifier:</strong> {proofData.nullifier}</p>
                            <p><strong>Commitment:</strong> {proofData.commitment}</p>
                            <p><strong>Eligible:</strong> {proofData.isEligible ? 'Yes' : 'No'}</p>
                            <p><strong>Timestamp:</strong> {new Date(proofData.timestamp).toLocaleString()}</p>
                        </div>
                        
                        <button
                            onClick={signMetaTransaction}
                            className="sign-tx-btn"
                        >
                            Sign Meta-Transaction
                        </button>

                        <button
                            onClick={() => setShowStep2(true)}
                            className="step2-btn"
                            disabled={!proofData}
                        >
                            Execute Step 2 Workflow
                        </button>

                        <button
                            onClick={() => {
                                const txData = prepareGaslessTransaction();
                                setGaslessTransactionData(txData);
                                setShowGaslessTransaction(true);
                            }}
                            className="gasless-btn"
                            disabled={!proofData || !eligibilityStatus?.eligible}
                        >
                            Execute Gasless Swap
                        </button>

                        <button
                            onClick={() => setShowShieldedPool(true)}
                            className="shielded-pool-btn"
                            disabled={!eligibilityStatus?.eligible}
                        >
                            Open Shielded Pool
                        </button>

                        <button
                            onClick={() => setShowOneInchSwap(true)}
                            className="oneinch-swap-btn"
                        >
                            1inch Swap
                        </button>

                        <button
                            onClick={() => setShowFilecoinStorage(true)}
                            className="filecoin-storage-btn"
                        >
                            Filecoin Storage
                        </button>

                        <button
                            onClick={() => setShowReceiptManager(true)}
                            className="receipt-manager-btn"
                        >
                            Receipt Manager
                        </button>
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
                        <CustomIdentityVerification />
                        <button onClick={() => {
                            setShowCustomVerification(false);
                            checkCustomVerificationStatus(); // Re-check status on close
                        }} className="modal-close-btn">
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Custom Identity Verification Modal */}
            {showCustomVerification && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <CustomIdentityVerification />
                        <button onClick={() => {
                            setShowCustomVerification(false);
                            checkCustomVerificationStatus(); // Re-check status on close
                        }} className="modal-close-btn">
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2 Results */}
            {step2Result && (
                <div className="step2-results">
                    <h3>Step 2 Complete</h3>
                    <div className="step2-details">
                        <p><strong>Proof Package:</strong> Generated ✓</p>
                        <p><strong>Receipt Template:</strong> Prepared ✓</p>
                        <p><strong>Verification Submitted:</strong> ✓</p>
                        <p><strong>ZKVault Tx:</strong> {step2Result.submissionResult?.zkVaultTxHash}</p>
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
                    <p className="error-message">{error}</p>
                    <button onClick={() => setError(null)} className="dismiss-error">
                        Dismiss
                    </button>
                </div>
            )}
        </div>
    );
};

export default UserWallet;
