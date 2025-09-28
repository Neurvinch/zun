import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import zkVaultClient from '../services/zkVaultClient';
import { getZKVaultContract } from '../config/tokens';
import './ZKVaultClient.css';

const ZKVaultClient = ({ 
    swapParams, 
    userWalletData, 
    onWorkflowComplete,
    onError 
}) => {
    const { address, chain } = useAccount();
    
    // State management
    const [isInitialized, setIsInitialized] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentStep, setCurrentStep] = useState('idle');
    const [proofPackage, setProofPackage] = useState(null);
    const [receiptCid, setReceiptCid] = useState(null);
    const [submissionResult, setSubmissionResult] = useState(null);
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState([]);

    // Initialize ZKVault client
    useEffect(() => {
        const initializeClient = async () => {
            if (!address || !window.ethereum || isInitialized) return;

            try {
                const provider = new ethers.BrowserProvider(window.ethereum);
                const signer = await provider.getSigner();
                
                await zkVaultClient.initialize(signer, address);
                setIsInitialized(true);
                addLog('ZKVault client initialized successfully', 'success');
                
            } catch (error) {
                console.error('Client initialization failed:', error);
                setError(`Initialization failed: ${error.message}`);
                addLog(`Initialization failed: ${error.message}`, 'error');
            }
        };

        initializeClient();
    }, [address, isInitialized]);

    /**
     * Add log entry
     */
    const addLog = (message, type = 'info') => {
        const logEntry = {
            id: Date.now(),
            message,
            type,
            timestamp: new Date().toLocaleTimeString()
        };
        setLogs(prev => [...prev, logEntry]);
    };

    /**
     * Execute complete Step 2 workflow
     */
    const executeWorkflow = async () => {
        if (!isInitialized || !swapParams || !userWalletData) {
            setError('Prerequisites not met for workflow execution');
            return;
        }

        setIsProcessing(true);
        setError(null);
        setProgress(0);
        setCurrentStep('generating_proof');
        addLog('Starting ZKVault Step 2 workflow...', 'info');

        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();

            // Get contract addresses
            const contractAddresses = {
                zkVaultContract: getZKVaultContract(chain.id)
            };

            // Step 1: Generate ZK Proof
            setProgress(25);
            addLog('Generating zero-knowledge proof...', 'info');
            
            const proofResult = await zkVaultClient.generateProofPackage(swapParams, userWalletData);
            setProofPackage(proofResult);
            addLog('✓ ZK proof generated successfully', 'success');

            // Step 2: Prepare Encrypted Receipt
            setCurrentStep('creating_receipt');
            setProgress(50);
            addLog('Preparing encrypted receipt...', 'info');

            const receiptTemplate = {
                tokenIn: swapParams.tokenIn,
                tokenOut: swapParams.tokenOut,
                amountIn: swapParams.swapAmount,
                userAddress: swapParams.userAddress,
                chainId: swapParams.chainId,
                timestamp: Date.now(),
                nullifier: proofResult.nullifier,
                commitment: proofResult.commitment
            };

            // Step 3: Submit Verification Data
            setCurrentStep('submitting_verification');
            setProgress(75);
            addLog('Submitting verification data to contracts...', 'info');

            const submission = await zkVaultClient.submitVerificationData(
                proofResult,
                contractAddresses,
                signer
            );
            setSubmissionResult(submission);
            addLog('✓ Verification data submitted successfully', 'success');

            // Step 4: Complete Workflow
            setCurrentStep('completed');
            setProgress(100);
            addLog('Step 2 workflow completed successfully!', 'success');

            // Callback to parent component
            if (onWorkflowComplete) {
                onWorkflowComplete({
                    proofPackage: proofResult,
                    receiptTemplate,
                    submissionResult: submission,
                    encryptionKey: zkVaultClient.encryptionKey
                });
            }

        } catch (error) {
            console.error('Workflow execution failed:', error);
            setError(`Workflow failed: ${error.message}`);
            addLog(`Workflow failed: ${error.message}`, 'error');
            
            if (onError) {
                onError(error);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    /**
     * Generate proof only (for testing)
     */
    const generateProofOnly = async () => {
        if (!isInitialized || !swapParams || !userWalletData) {
            setError('Prerequisites not met for proof generation');
            return;
        }

        setIsProcessing(true);
        setError(null);
        setCurrentStep('generating_proof');
        addLog('Generating ZK proof only...', 'info');

        try {
            const proofResult = await zkVaultClient.generateProofPackage(swapParams, userWalletData);
            setProofPackage(proofResult);
            addLog('✓ ZK proof generated successfully', 'success');
            setCurrentStep('proof_ready');
            
        } catch (error) {
            console.error('Proof generation failed:', error);
            setError(`Proof generation failed: ${error.message}`);
            addLog(`Proof generation failed: ${error.message}`, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    /**
     * Create and store encrypted receipt
     */
    const createReceipt = async (swapDetails) => {
        if (!proofPackage) {
            setError('No proof package available for receipt creation');
            return;
        }

        try {
            addLog('Creating encrypted receipt...', 'info');
            const cid = await zkVaultClient.createEncryptedReceipt(swapDetails, proofPackage);
            setReceiptCid(cid);
            addLog(`✓ Encrypted receipt stored: ${cid}`, 'success');
            return cid;
            
        } catch (error) {
            console.error('Receipt creation failed:', error);
            setError(`Receipt creation failed: ${error.message}`);
            addLog(`Receipt creation failed: ${error.message}`, 'error');
        }
    };

    /**
     * Clear all data and reset
     */
    const resetWorkflow = () => {
        setProofPackage(null);
        setReceiptCid(null);
        setSubmissionResult(null);
        setError(null);
        setProgress(0);
        setCurrentStep('idle');
        setLogs([]);
    };

    return (
        <div className="zkvault-client">
            <div className="client-header">
                <h3>ZKVault Client - Step 2</h3>
                <div className="client-status">
                    <span className={`status-indicator ${isInitialized ? 'connected' : 'disconnected'}`}>
                        {isInitialized ? '🟢 Connected' : '🔴 Disconnected'}
                    </span>
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

            {/* Action Buttons */}
            <div className="action-section">
                <button
                    onClick={executeWorkflow}
                    disabled={!isInitialized || isProcessing || !swapParams}
                    className="primary-button"
                >
                    {isProcessing ? 'Processing...' : 'Execute Step 2 Workflow'}
                </button>

                <button
                    onClick={generateProofOnly}
                    disabled={!isInitialized || isProcessing || !swapParams}
                    className="secondary-button"
                >
                    Generate Proof Only
                </button>

                <button
                    onClick={resetWorkflow}
                    disabled={isProcessing}
                    className="reset-button"
                >
                    Reset
                </button>
            </div>

            {/* Results Display */}
            {proofPackage && (
                <div className="results-section">
                    <h4>Generated Proof Package</h4>
                    <div className="proof-details">
                        <div className="detail-item">
                            <span className="label">Nullifier:</span>
                            <span className="value">{proofPackage.nullifier}</span>
                        </div>
                        <div className="detail-item">
                            <span className="label">Commitment:</span>
                            <span className="value">{proofPackage.commitment}</span>
                        </div>
                        <div className="detail-item">
                            <span className="label">Eligible:</span>
                            <span className={`value ${proofPackage.isEligible ? 'success' : 'error'}`}>
                                {proofPackage.isEligible ? 'Yes' : 'No'}
                            </span>
                        </div>
                        <div className="detail-item">
                            <span className="label">Timestamp:</span>
                            <span className="value">
                                {new Date(proofPackage.timestamp).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {receiptCid && (
                <div className="receipt-section">
                    <h4>Encrypted Receipt</h4>
                    <div className="receipt-details">
                        <div className="detail-item">
                            <span className="label">IPFS CID:</span>
                            <span className="value">{receiptCid}</span>
                        </div>
                        <div className="detail-item">
                            <span className="label">Status:</span>
                            <span className="value success">Stored on IPFS</span>
                        </div>
                    </div>
                </div>
            )}

            {submissionResult && (
                <div className="submission-section">
                    <h4>Verification Submission</h4>
                    <div className="submission-details">
                        <div className="detail-item">
                            <span className="label">ZKVault Tx:</span>
                            <span className="value">{submissionResult.zkVaultTxHash}</span>
                        </div>
                        <div className="detail-item">
                            <span className="label">Status:</span>
                            <span className="value success">{submissionResult.status}</span>
                        </div>
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

            {/* Activity Log */}
            <div className="log-section">
                <h4>Activity Log</h4>
                <div className="log-container">
                    {logs.map(log => (
                        <div key={log.id} className={`log-entry ${log.type}`}>
                            <span className="log-time">{log.timestamp}</span>
                            <span className="log-message">{log.message}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ZKVaultClient;
