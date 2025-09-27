import React, { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import selfProtocolService from '../services/selfProtocolService';
import { getSelfProtocolContract } from '../config/tokens';
import './HumanVerification.css';

const HumanVerification = ({ onVerificationComplete, onError }) => {
    const { address, chain, isConnected } = useAccount();
    
    // State management
    const [verificationStatus, setVerificationStatus] = useState(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [behavioralData, setBehavioralData] = useState({
        sessionStart: Date.now(),
        interactions: 0,
        clicks: [],
        keystrokes: [],
        mouseMovements: []
    });
    const [verificationStep, setVerificationStep] = useState('check');
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState(0);

    // Initialize Self Protocol service
    useEffect(() => {
        const initializeService = async () => {
            if (!isConnected || !chain || !window.ethereum || !address) return;

            try {
                const provider = new ethers.BrowserProvider(window.ethereum);
                const contractAddress = getSelfProtocolContract(chain.id);
                
                const initialized = await selfProtocolService.initialize(
                    provider, 
                    chain.id, 
                    contractAddress,
                    address // Pass user address for SDK initialization
                );
                
                setIsInitialized(initialized);
                
                if (initialized) {
                    // Check existing verification status
                    await checkVerificationStatus();
                }
                
            } catch (error) {
                console.error('Self Protocol initialization failed:', error);
                setError(`Initialization failed: ${error.message}`);
            }
        };

        initializeService();
    }, [isConnected, chain, address]);

    // Behavioral data collection
    useEffect(() => {
        if (!isConnected) return;

        const handleClick = (event) => {
            setBehavioralData(prev => ({
                ...prev,
                interactions: prev.interactions + 1,
                clicks: [...prev.clicks.slice(-10), { // Keep last 10 clicks
                    x: event.clientX,
                    y: event.clientY,
                    timestamp: Date.now()
                }]
            }));
        };

        const handleKeyDown = (event) => {
            const now = Date.now();
            setBehavioralData(prev => {
                const lastKeystroke = prev.keystrokes[prev.keystrokes.length - 1];
                const interval = lastKeystroke ? now - lastKeystroke.timestamp : 0;
                
                return {
                    ...prev,
                    keystrokes: [...prev.keystrokes.slice(-10), { // Keep last 10 keystrokes
                        timestamp: now,
                        interval: interval,
                        duration: 0 // Will be updated on keyup
                    }]
                };
            });
        };

        const handleMouseMove = (event) => {
            setBehavioralData(prev => {
                const lastMovement = prev.mouseMovements[prev.mouseMovements.length - 1];
                const deltaX = lastMovement ? event.clientX - lastMovement.x : 0;
                const deltaY = lastMovement ? event.clientY - lastMovement.y : 0;
                const velocity = lastMovement ? 
                    Math.sqrt(deltaX * deltaX + deltaY * deltaY) / 
                    Math.max(1, Date.now() - lastMovement.timestamp) : 0;
                
                return {
                    ...prev,
                    mouseMovements: [...prev.mouseMovements.slice(-20), { // Keep last 20 movements
                        x: event.clientX,
                        y: event.clientY,
                        deltaX: deltaX,
                        deltaY: deltaY,
                        velocity: velocity,
                        timestamp: Date.now()
                    }]
                };
            });
        };

        // Add event listeners
        document.addEventListener('click', handleClick);
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('mousemove', handleMouseMove);

        return () => {
            document.removeEventListener('click', handleClick);
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousemove', handleMouseMove);
        };
    }, [isConnected]);

    /**
     * Check current verification status
     */
    const checkVerificationStatus = async () => {
        if (!address || !chain) return;

        try {
            const status = await selfProtocolService.checkHumanVerification(address, chain.id);
            setVerificationStatus(status);
            
            if (status.isVerified && onVerificationComplete) {
                onVerificationComplete(status);
            }
            
        } catch (error) {
            console.error('Verification status check failed:', error);
            setError(`Status check failed: ${error.message}`);
        }
    };

    /**
     * Start human verification process using Self Protocol SDK
     */
    const startVerification = async () => {
        if (!address || !isInitialized) return;

        setIsVerifying(true);
        setError(null);
        setVerificationStep('initializing');
        setProgress(25);

        try {
            // Step 1: Start Self Protocol verification process
            const verificationSession = await selfProtocolService.startVerificationProcess(
                address,
                chain.id
            );

            setVerificationStep('redirecting');
            setProgress(50);

            // Step 2: Redirect user to Self Protocol verification
            if (verificationSession.success && verificationSession.verificationUrl) {
                // Open Self Protocol verification in new window
                const verificationWindow = window.open(
                    verificationSession.verificationUrl,
                    'self-verification',
                    'width=600,height=800,scrollbars=yes,resizable=yes'
                );

                setVerificationStep('verifying');
                setProgress(75);

                // Listen for verification completion
                const checkVerificationComplete = setInterval(async () => {
                    if (verificationWindow.closed) {
                        clearInterval(checkVerificationComplete);
                        
                        // Check verification status after window closes
                        setVerificationStep('checking_result');
                        setProgress(90);
                        
                        // Wait a moment for the verification to be processed
                        setTimeout(async () => {
                            await checkVerificationStatus();
                            setVerificationStep('completed');
                            setProgress(100);
                            setIsVerifying(false);
                        }, 2000);
                    }
                }, 1000);

                // Set timeout for verification process
                setTimeout(() => {
                    if (!verificationWindow.closed) {
                        clearInterval(checkVerificationComplete);
                        verificationWindow.close();
                        setError('Verification timeout. Please try again.');
                        setIsVerifying(false);
                    }
                }, 300000); // 5 minute timeout

            } else {
                throw new Error('Failed to generate verification URL');
            }

        } catch (error) {
            console.error('Human verification failed:', error);
            setError(`Verification failed: ${error.message}`);
            
            if (onError) {
                onError(error);
            }
            setIsVerifying(false);
        }
    };

    /**
     * Refresh verification status
     */
    const refreshStatus = async () => {
        selfProtocolService.clearCache();
        await checkVerificationStatus();
    };

    if (!isConnected) {
        return (
            <div className="human-verification">
                <h3>Human Verification</h3>
                <p>Please connect your wallet to verify humanity</p>
            </div>
        );
    }

    return (
        <div className="human-verification">
            <div className="verification-header">
                <h3>🛡️ Human Verification (Self Protocol)</h3>
                <div className="verification-status">
                    {verificationStatus ? (
                        <span className={`status-badge ${verificationStatus.isVerified ? 'verified' : 'unverified'}`}>
                            {verificationStatus.isVerified ? '✅ Verified Human' : '❌ Not Verified'}
                        </span>
                    ) : (
                        <span className="status-badge loading">🔄 Checking...</span>
                    )}
                </div>
            </div>

            {/* Progress Bar */}
            {isVerifying && (
                <div className="progress-section">
                    <div className="progress-bar">
                        <div 
                            className="progress-fill" 
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                    <p className="progress-text">
                        {verificationStep.replace('_', ' ').toUpperCase()} - {progress}%
                    </p>
                </div>
            )}

            {/* Verification Details */}
            {verificationStatus && (
                <div className="verification-details">
                    <div className="detail-grid">
                        <div className="detail-item">
                            <span className="label">Status:</span>
                            <span className={`value ${verificationStatus.isVerified ? 'success' : 'error'}`}>
                                {verificationStatus.isVerified ? 'Verified' : 'Unverified'}
                            </span>
                        </div>
                        
                        {verificationStatus.timestamp > 0 && (
                            <div className="detail-item">
                                <span className="label">Verified At:</span>
                                <span className="value">
                                    {new Date(verificationStatus.timestamp * 1000).toLocaleString()}
                                </span>
                            </div>
                        )}
                        
                        <div className="detail-item">
                            <span className="label">Score:</span>
                            <span className="value">{verificationStatus.score}/100</span>
                        </div>
                        
                        <div className="detail-item">
                            <span className="label">Chain:</span>
                            <span className="value">{chain?.name}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Behavioral Data Summary */}
            <div className="behavioral-summary">
                <h4>Behavioral Analysis</h4>
                <div className="behavioral-grid">
                    <div className="behavioral-item">
                        <span className="label">Session Duration:</span>
                        <span className="value">
                            {Math.floor((Date.now() - behavioralData.sessionStart) / 1000)}s
                        </span>
                    </div>
                    <div className="behavioral-item">
                        <span className="label">Interactions:</span>
                        <span className="value">{behavioralData.interactions}</span>
                    </div>
                    <div className="behavioral-item">
                        <span className="label">Click Pattern:</span>
                        <span className="value">{behavioralData.clicks.length} clicks</span>
                    </div>
                    <div className="behavioral-item">
                        <span className="label">Mouse Activity:</span>
                        <span className="value">{behavioralData.mouseMovements.length} movements</span>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="action-section">
                {!verificationStatus?.isVerified && (
                    <button
                        onClick={startVerification}
                        disabled={!isInitialized || isVerifying}
                        className="verify-button"
                    >
                        {isVerifying ? 'Verifying...' : 'Start Human Verification'}
                    </button>
                )}

                <button
                    onClick={refreshStatus}
                    disabled={isVerifying}
                    className="refresh-button"
                >
                    Refresh Status
                </button>
            </div>

            {/* Information Section */}
            <div className="info-section">
                <h4>About Self Protocol Verification</h4>
                <ul>
                    <li>🛡️ <strong>Self Protocol:</strong> Decentralized identity verification using real passport data</li>
                    <li>🔒 <strong>Privacy-First:</strong> Zero-knowledge proofs ensure your personal data never leaves your device</li>
                    <li>📱 <strong>Mobile Verification:</strong> Uses your phone's NFC to read passport chips securely</li>
                    <li>🌍 <strong>Global Support:</strong> Works with passports from 150+ countries</li>
                    <li>⚡ <strong>Instant Verification:</strong> Complete verification in under 2 minutes</li>
                    <li>🤖 <strong>Sybil-Resistant:</strong> Prevents bot attacks and multiple account abuse</li>
                </ul>
                
                <div className="verification-requirements">
                    <h5>Requirements for ZKVault:</h5>
                    <ul>
                        <li>✅ Must be 18+ years old</li>
                        <li>✅ Valid passport with NFC chip</li>
                        <li>✅ Mobile device with NFC capability</li>
                        <li>✅ Nationality disclosure for compliance</li>
                        <li>✅ Date of birth for age verification</li>
                    </ul>
                </div>
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

export default HumanVerification;
