import { ethers } from 'ethers';
import { SelfAppBuilder } from '@selfxyz/qrcode';

// Self Protocol Hub addresses
const SELF_HUB_ADDRESSES = {
    // Celo Sepolia (Testnet)
    44787: '0x16ECBA51e18a4a7e61fdC417f0d47AFEeDfbed74',
    // Celo Mainnet
    42220: '0xe57F4773bd9c9d8b6Cd70431117d353298B9f5BF',
    // Ethereum Sepolia (for testing)
    11155111: '0x16ECBA51e18a4a7e61fdC417f0d47AFEeDfbed74'
};

// ProofOfHuman Contract ABI
const PROOF_OF_HUMAN_ABI = [
    {
        "inputs": [{"name": "user", "type": "address"}],
        "name": "verifiedHumans",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "verificationConfigId",
        "outputs": [{"name": "", "type": "bytes32"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "name": "user", "type": "address"},
            {"indexed": false, "name": "verified", "type": "bool"}
        ],
        "name": "VerificationCompleted",
        "type": "event"
    }
];

class SelfProtocolService {
    constructor() {
        this.contracts = new Map(); // Chain ID -> Contract instance
        this.selfApps = new Map(); // Chain ID -> SelfApp instance
        this.verificationCache = new Map(); // User address -> verification data
        this.isInitialized = false;
        this.currentChainId = null;
        this.currentUserAddress = null;
        this.CELO_TESTNET_CHAIN_ID = 44787; // Celo Sepolia testnet only
    }

    /**
     * Initialize Self Protocol service
     * @param {Object} provider - Ethers provider
     * @param {Number} chainId - Chain ID
     * @param {String} contractAddress - ProofOfHuman contract address
     * @param {String} userAddress - User's wallet address
     */
    async initialize(provider, chainId, contractAddress, userAddress) {
        try {
            if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
                console.warn('ProofOfHuman contract not deployed on this chain');
                return false;
            }

            // Initialize ProofOfHuman contract
            // Ensure the address has code deployed to avoid BAD_DATA decode errors
            try {
                const code = await provider.getCode(contractAddress);
                if (!code || code === '0x') {
                    console.warn(`No contract code found at ${contractAddress} on chain ${chainId}`);
                    return false;
                }
            } catch (codeErr) {
                console.error('Failed to fetch contract code:', codeErr);
                return false;
            }

            const contract = new ethers.Contract(contractAddress, PROOF_OF_HUMAN_ABI, provider);
            this.contracts.set(chainId, contract);
            
            // Initialize Self SDK App
            const endpointType = chainId === 42220 ? 'celo' : 'staging_celo';
            
            const selfApp = new SelfAppBuilder({
                // Contract integration settings
                endpoint: contractAddress,
                endpointType: endpointType,
                userIdType: 'hex', // For wallet addresses
                version: 2, // Always use V2
                
                // App details
                appName: 'ZKVault Protocol',
                scope: 'zkvault-human-verification',
                userId: userAddress,
                
                // Verification requirements
                disclosures: {
                    // Basic requirements for DeFi access
                    minimumAge: 18,
                    excludedCountries: [], // Configure based on your compliance needs
                    ofac: false, // OFAC compliance checking
                    
                    // Required disclosures for human verification
                    name: false, // Don't require name for privacy
                    nationality: true, // Required for compliance
                    gender: false, // Not required
                    date_of_birth: true, // Required for age verification
                    passport_number: false, // Not required for privacy
                    expiry_date: false // Not required
                }
            }).build();
            
            this.selfApps.set(chainId, selfApp);
            this.currentChainId = chainId;
            this.currentUserAddress = userAddress;
            
            this.isInitialized = true;
            console.log(`Self Protocol initialized on chain ${chainId} for user ${userAddress}`);
            return true;
            
        } catch (error) {
            console.error('Self Protocol initialization failed:', error);
            return false;
        }
    }

    /**
     * Check if user is verified as human
     * @param {String} userAddress - User's wallet address
     * @param {Number} chainId - Chain ID
     * @returns {Object} - Verification status
     */
    async checkHumanVerification(userAddress, chainId) {
        try {
            // Check cache first
            const cacheKey = `${chainId}_${userAddress.toLowerCase()}`;
            const cached = this.verificationCache.get(cacheKey);
            
            if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes cache
                return cached.data;
            }

            const contract = this.contracts.get(chainId);
            if (!contract) {
                return {
                    isVerified: false,
                    error: 'ProofOfHuman contract not available on this chain',
                    timestamp: 0,
                    score: 0
                };
            }

            // Check if user is verified in the ProofOfHuman contract
            let isVerified = false;
            try {
                isVerified = await contract.verifiedHumans(userAddress);
            } catch (callErr) {
                // Provide clearer diagnostics for BAD_DATA (likely no contract at address or ABI mismatch)
                const addr = contract.target?.toString?.() || 'unknown';
                console.error(`verifiedHumans() call failed on ${addr} (chain ${chainId}):`, callErr);
                return {
                    isVerified: false,
                    error: `Verification read failed at ${addr} on chain ${chainId}. Ensure the ProofOfHuman contract is deployed and the address is correct. (${callErr.code || 'CALL_ERROR'})`,
                    timestamp: 0,
                    score: 0,
                    userAddress: userAddress.toLowerCase(),
                    chainId,
                    lastChecked: Date.now()
                };
            }

            const result = {
                isVerified,
                timestamp: isVerified ? Date.now() : 0,
                score: isVerified ? 100 : 0,
                userAddress: userAddress.toLowerCase(),
                chainId,
                lastChecked: Date.now()
            };

            // Cache result
            this.verificationCache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            return result;
            
        } catch (error) {
            console.error('Human verification check failed:', error);
            return {
                isVerified: false,
                error: error.message,
                timestamp: 0,
                score: 0,
                userAddress: userAddress.toLowerCase(),
                chainId,
                lastChecked: Date.now()
            };
        }
    }

    /**
     * Generate verification data for Self Protocol
     * @param {String} userAddress - User's wallet address
     * @param {Object} biometricData - Biometric verification data
     * @param {Object} behavioralData - Behavioral analysis data
     * @returns {Object} - Formatted verification data
     */
    generateVerificationData(userAddress, biometricData = {}, behavioralData = {}) {
        try {
            const verificationPayload = {
                userAddress: userAddress.toLowerCase(),
                timestamp: Date.now(),
                
                // Biometric indicators (privacy-preserving hashes)
                biometric: {
                    deviceFingerprint: this.generateDeviceFingerprint(),
                    interactionPattern: this.generateInteractionPattern(behavioralData),
                    temporalSignature: this.generateTemporalSignature()
                },
                
                // Behavioral indicators
                behavioral: {
                    sessionDuration: behavioralData.sessionDuration || 0,
                    clickPattern: this.hashClickPattern(behavioralData.clicks || []),
                    keystrokePattern: this.hashKeystrokePattern(behavioralData.keystrokes || []),
                    mouseMovement: this.hashMouseMovement(behavioralData.mouseMovements || [])
                },
                
                // Network indicators
                network: {
                    ipHash: this.hashIP(behavioralData.ipAddress),
                    userAgent: this.hashUserAgent(navigator.userAgent),
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    language: navigator.language
                },
                
                // Verification metadata
                metadata: {
                    version: '1.0',
                    protocol: 'self-protocol-zk',
                    privacy: 'zero-knowledge'
                }
            };

            return verificationPayload;
            
        } catch (error) {
            console.error('Verification data generation failed:', error);
            throw new Error(`Verification data generation failed: ${error.message}`);
        }
    }

    /**
     * Start Self Protocol verification process
     * @param {String} userAddress - User's wallet address
     * @param {Number} chainId - Chain ID
     * @returns {Object} - Verification URL and session info
     */
    async startVerificationProcess(userAddress, chainId) {
        try {
            const selfApp = this.selfApps.get(chainId);
            if (!selfApp) {
                throw new Error('Self Protocol app not initialized for this chain');
            }

            // Generate verification URL using Self SDK (support multiple SDK method names)
            let verificationUrl;
            if (typeof selfApp.generateVerificationUrl === 'function') {
                verificationUrl = await selfApp.generateVerificationUrl();
            } else if (typeof selfApp.getVerificationUrl === 'function') {
                verificationUrl = await selfApp.getVerificationUrl();
            } else if (typeof selfApp.generateUrl === 'function') {
                verificationUrl = await selfApp.generateUrl();
            } else if (typeof selfApp.getUrl === 'function') {
                verificationUrl = await selfApp.getUrl();
            } else if (typeof selfApp.url === 'string') {
                verificationUrl = selfApp.url;
            } else {
                throw new Error('No compatible method to generate verification URL found in Self SDK instance');
            }
            
            console.log('Self Protocol verification URL generated:', verificationUrl);
            
            return {
                success: true,
                verificationUrl,
                appName: 'ZKVault Protocol',
                scope: 'zkvault-human-verification',
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error('Self Protocol verification start failed:', error);
            throw new Error(`Verification start failed: ${error.message}`);
        }
    }

    /**
     * Check verification status and handle callback
     * @param {String} userAddress - User's wallet address
     * @param {Number} chainId - Chain ID
     * @param {String} verificationToken - Token from Self Protocol callback
     * @returns {Object} - Verification result
     */
    async handleVerificationCallback(userAddress, chainId, verificationToken) {
        try {
            const selfApp = this.selfApps.get(chainId);
            if (!selfApp) {
                throw new Error('Self Protocol app not initialized for this chain');
            }

            // Process verification result using Self SDK
            const verificationResult = await selfApp.handleCallback(verificationToken);
            
            if (verificationResult.success) {
                // Update cache with successful verification
                const cacheKey = `${chainId}_${userAddress.toLowerCase()}`;
                this.verificationCache.set(cacheKey, {
                    data: {
                        isVerified: true,
                        timestamp: Date.now(),
                        score: 100,
                        userAddress: userAddress.toLowerCase(),
                        chainId,
                        lastChecked: Date.now(),
                        verificationData: verificationResult.data
                    },
                    timestamp: Date.now()
                });
            }

            return {
                success: verificationResult.success,
                isVerified: verificationResult.success,
                data: verificationResult.data,
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error('Self Protocol verification callback failed:', error);
            throw new Error(`Verification callback failed: ${error.message}`);
        }
    }

    /**
     * Generate device fingerprint (privacy-preserving)
     * @returns {String} - Hashed device fingerprint
     */
    generateDeviceFingerprint() {
        const fingerprint = {
            screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
            timezone: new Date().getTimezoneOffset(),
            language: navigator.language,
            platform: navigator.platform,
            cookieEnabled: navigator.cookieEnabled,
            doNotTrack: navigator.doNotTrack
        };
        
        return CryptoJS.SHA256(JSON.stringify(fingerprint)).toString();
    }

    /**
     * Generate interaction pattern hash
     * @param {Object} behavioralData - Behavioral data
     * @returns {String} - Hashed interaction pattern
     */
    generateInteractionPattern(behavioralData) {
        const pattern = {
            sessionStart: behavioralData.sessionStart || Date.now(),
            interactionCount: behavioralData.interactions || 0,
            avgResponseTime: behavioralData.avgResponseTime || 0
        };
        
        return CryptoJS.SHA256(JSON.stringify(pattern)).toString();
    }

    /**
     * Generate temporal signature
     * @returns {String} - Temporal signature hash
     */
    generateTemporalSignature() {
        const temporal = {
            hour: new Date().getHours(),
            dayOfWeek: new Date().getDay(),
            month: new Date().getMonth()
        };
        
        return CryptoJS.SHA256(JSON.stringify(temporal)).toString();
    }

    /**
     * Hash click pattern for privacy
     * @param {Array} clicks - Click events
     * @returns {String} - Hashed click pattern
     */
    hashClickPattern(clicks) {
        if (!clicks.length) return '0x0';
        
        const pattern = clicks.map(click => ({
            x: Math.floor(click.x / 10) * 10, // Quantize for privacy
            y: Math.floor(click.y / 10) * 10,
            timestamp: Math.floor(click.timestamp / 1000) // Second precision
        }));
        
        return CryptoJS.SHA256(JSON.stringify(pattern)).toString();
    }

    /**
     * Hash keystroke pattern for privacy
     * @param {Array} keystrokes - Keystroke events
     * @returns {String} - Hashed keystroke pattern
     */
    hashKeystrokePattern(keystrokes) {
        if (!keystrokes.length) return '0x0';
        
        const pattern = keystrokes.map(keystroke => ({
            duration: Math.floor(keystroke.duration / 10) * 10, // Quantize
            interval: Math.floor(keystroke.interval / 10) * 10
        }));
        
        return CryptoJS.SHA256(JSON.stringify(pattern)).toString();
    }

    /**
     * Hash mouse movement for privacy
     * @param {Array} movements - Mouse movement events
     * @returns {String} - Hashed movement pattern
     */
    hashMouseMovement(movements) {
        if (!movements.length) return '0x0';
        
        const pattern = movements.map(movement => ({
            deltaX: Math.floor(movement.deltaX / 5) * 5, // Quantize
            deltaY: Math.floor(movement.deltaY / 5) * 5,
            velocity: Math.floor(movement.velocity || 0)
        }));
        
        return CryptoJS.SHA256(JSON.stringify(pattern)).toString();
    }

    /**
     * Hash IP address for privacy
     * @param {String} ipAddress - IP address
     * @returns {String} - Hashed IP
     */
    hashIP(ipAddress) {
        if (!ipAddress) return '0x0';
        return CryptoJS.SHA256(ipAddress).toString();
    }

    /**
     * Hash user agent for privacy
     * @param {String} userAgent - User agent string
     * @returns {String} - Hashed user agent
     */
    hashUserAgent(userAgent) {
        return CryptoJS.SHA256(userAgent).toString();
    }

    /**
     * Encode verification data for contract
     * @param {Object} verificationData - Verification data
     * @returns {String} - Encoded data
     */
    encodeVerificationData(verificationData) {
        const jsonString = JSON.stringify(verificationData);
        return ethers.hexlify(ethers.toUtf8Bytes(jsonString));
    }

    /**
     * Encode ZK proof for contract
     * @param {Object} zkProof - ZK proof
     * @returns {String} - Encoded proof
     */
    encodeZKProof(zkProof) {
        if (!zkProof) return '0x0';
        
        const proofString = JSON.stringify(zkProof);
        return ethers.hexlify(ethers.toUtf8Bytes(proofString));
    }

    /**
     * Clear verification cache
     */
    clearCache() {
        this.verificationCache.clear();
    }

    /**
     * Get cached verification status
     * @param {String} userAddress - User address
     * @param {Number} chainId - Chain ID
     * @returns {Object|null} - Cached verification data
     */
    getCachedVerification(userAddress, chainId) {
        const cacheKey = `${chainId}_${userAddress.toLowerCase()}`;
        const cached = this.verificationCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < 300000) {
            return cached.data;
        }
        
        return null;
    }

    /**
     * Get service status
     * @returns {Object} - Service status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            contractsLoaded: this.contracts.size,
            cachedVerifications: this.verificationCache.size,
            supportedChains: Array.from(this.contracts.keys())
        };
    }
}

export default new SelfProtocolService();
