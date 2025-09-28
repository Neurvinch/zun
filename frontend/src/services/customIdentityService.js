import { ethers } from 'ethers';
import { toast } from 'react-hot-toast';
import { publicClientToProvider, walletClientToSigner } from '../utils/viem-ethers-adapter';

// Custom Identity Verification ABI (key functions)
const CUSTOM_IDENTITY_ABI = [
    "function requestVerification(uint8[] memory methods, bytes[] memory proofs, bytes memory additionalData) external payable",
    "function isUserVerified(address user) public view returns (bool)",
    "function getUserVerificationDetails(address user) external view returns (uint8 status, uint256 verificationScore, uint256 reputationScore, uint256 verificationTimestamp, uint256 expirationTimestamp, uint256 stakeAmount, bool isActive)",
    "function hasVerificationMethod(address user, uint8 method) external view returns (bool)",
    "function getUserSocialVouchers(address user) external view returns (address[] memory)",
    "function addTrustedVerifier(address verifier, string memory verifierType) external",
    "function disputeVerification(address user, string memory reason) external",
    "function withdrawStake(uint256 amount) external",
    "function updateMethodWeight(uint8 method, uint256 weight) external",
    "event UserVerificationRequested(address indexed user, uint8 method)",
    "event UserVerified(address indexed user, uint256 score, uint8[] methods)",
    "event SocialVouchingCompleted(address indexed user, uint256 voucherCount)",
    "event StakeDeposited(address indexed user, uint256 amount)",
    "event VerificationDisputed(address indexed user, address indexed disputer, string reason)"
];

// Verification Methods Enum
export const VerificationMethod = {
    SOCIAL_VERIFICATION: 0,
    ACTIVITY_VERIFICATION: 1,
    STAKE_VERIFICATION: 2,
    BIOMETRIC_ZK_PROOF: 3,
    MULTI_SIG_VERIFICATION: 4,
    TIME_LOCK_VERIFICATION: 5,
    CROSS_CHAIN_VERIFICATION: 6
};

// Verification Status Enum
export const VerificationStatus = {
    UNVERIFIED: 0,
    PENDING: 1,
    VERIFIED: 2,
    DISPUTED: 3,
    REVOKED: 4
};

class CustomIdentityService {
    constructor() {
        this.contract = null;
        this.provider = null;
        this.signer = null;
        this.contractAddress = import.meta.env.VITE_CUSTOM_IDENTITY_VERIFIER_ADDRESS;
    }

    /**
     * Initialize the service with Web3 provider
     */
    async initialize(publicClient, walletClient) {
        try {
            if (!publicClient || !walletClient) {
                throw new Error('Public client or wallet client is not available.');
            }

            this.provider = publicClientToProvider(publicClient);
            this.signer = walletClientToSigner(walletClient);
            
            if (!this.contractAddress) {
                throw new Error('Custom Identity Verifier contract address not configured');
            }

            this.contract = new ethers.Contract(
                this.contractAddress,
                CUSTOM_IDENTITY_ABI,
                this.signer
            );

            console.log('✅ Custom Identity Service initialized');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Custom Identity Service:', error);
            throw error;
        }
    }

    /**
     * Check if user is verified
     */
    async isUserVerified(userAddress) {
        try {
            if (!this.contract) {
                throw new Error('Service not initialized');
            }

            const isVerified = await this.contract.isUserVerified(userAddress);
            return isVerified;
        } catch (error) {
            console.error('Error checking user verification:', error);
            return false;
        }
    }

    /**
     * Get user verification details
     */
    async getUserVerificationDetails(userAddress) {
        try {
            if (!this.contract) {
                throw new Error('Service not initialized');
            }

            const details = await this.contract.getUserVerificationDetails(userAddress);
            
            return {
                status: details[0],
                verificationScore: details[1].toNumber(),
                reputationScore: details[2].toNumber(),
                verificationTimestamp: details[3].toNumber(),
                expirationTimestamp: details[4].toNumber(),
                stakeAmount: ethers.utils.formatEther(details[5]),
                isActive: details[6]
            };
        } catch (error) {
            console.error('Error getting user verification details:', error);
            return null;
        }
    }

    /**
     * Request verification using multiple methods
     */
    async requestVerification(methods, proofs, additionalData = {}, stakeAmount = '0') {
        try {
            if (!this.contract) {
                throw new Error('Service not initialized');
            }

            const encodedAdditionalData = ethers.utils.defaultAbiCoder.encode(
                ['string', 'uint256', 'string'],
                [additionalData.nationality || '', additionalData.age || 0, additionalData.metadata || '']
            );

            const tx = await this.contract.requestVerification(
                methods,
                proofs,
                encodedAdditionalData,
                {
                    value: stakeAmount ? ethers.utils.parseEther(stakeAmount) : 0,
                    gasLimit: 500000
                }
            );

            toast.loading('Requesting verification...', { id: 'verification-request' });
            
            const receipt = await tx.wait();
            
            toast.success('Verification request submitted!', { id: 'verification-request' });
            
            return {
                success: true,
                txHash: receipt.transactionHash,
                gasUsed: receipt.gasUsed.toString()
            };
        } catch (error) {
            console.error('Error requesting verification:', error);
            toast.error('Failed to request verification', { id: 'verification-request' });
            throw error;
        }
    }

    /**
     * Request social verification (community vouching)
     */
    async requestSocialVerification(voucherAddresses, additionalData = {}) {
        try {
            // Encode voucher addresses as proof
            const proof = ethers.utils.defaultAbiCoder.encode(['address[]'], [voucherAddresses]);
            
            return await this.requestVerification(
                [VerificationMethod.SOCIAL_VERIFICATION],
                [proof],
                additionalData
            );
        } catch (error) {
            console.error('Error requesting social verification:', error);
            throw error;
        }
    }

    /**
     * Request activity-based verification
     */
    async requestActivityVerification(activityMetrics, additionalData = {}) {
        try {
            // Encode activity metrics as proof
            const proof = ethers.utils.defaultAbiCoder.encode(
                ['uint256', 'uint256', 'uint256'],
                [
                    activityMetrics.txCount || 0,
                    activityMetrics.contractInteractions || 0,
                    activityMetrics.timeActive || 0
                ]
            );
            
            return await this.requestVerification(
                [VerificationMethod.ACTIVITY_VERIFICATION],
                [proof],
                additionalData
            );
        } catch (error) {
            console.error('Error requesting activity verification:', error);
            throw error;
        }
    }

    /**
     * Request stake-based verification
     */
    async requestStakeVerification(stakeAmount, additionalData = {}) {
        try {
            const proof = ethers.utils.defaultAbiCoder.encode(['uint256'], [ethers.utils.parseEther(stakeAmount)]);
            
            return await this.requestVerification(
                [VerificationMethod.STAKE_VERIFICATION],
                [proof],
                additionalData,
                stakeAmount
            );
        } catch (error) {
            console.error('Error requesting stake verification:', error);
            throw error;
        }
    }

    /**
     * Request biometric ZK proof verification
     */
    async requestBiometricVerification(zkProof, additionalData = {}) {
        try {
            // In a real implementation, this would be a proper ZK proof
            const proof = ethers.utils.defaultAbiCoder.encode(['bytes'], [zkProof || '0x1234']);
            
            return await this.requestVerification(
                [VerificationMethod.BIOMETRIC_ZK_PROOF],
                [proof],
                additionalData
            );
        } catch (error) {
            console.error('Error requesting biometric verification:', error);
            throw error;
        }
    }

    /**
     * Request multi-signature verification
     */
    async requestMultiSigVerification(verifierSignatures, additionalData = {}) {
        try {
            const verifiers = verifierSignatures.map(sig => sig.verifier);
            const signatures = verifierSignatures.map(sig => sig.signature);
            
            const proof = ethers.utils.defaultAbiCoder.encode(
                ['address[]', 'bytes[]'],
                [verifiers, signatures]
            );
            
            return await this.requestVerification(
                [VerificationMethod.MULTI_SIG_VERIFICATION],
                [proof],
                additionalData
            );
        } catch (error) {
            console.error('Error requesting multi-sig verification:', error);
            throw error;
        }
    }

    /**
     * Request comprehensive verification using multiple methods
     */
    async requestComprehensiveVerification(verificationData) {
        try {
            const methods = [];
            const proofs = [];
            let stakeAmount = '0';

            // Social verification
            if (verificationData.socialVouchers && verificationData.socialVouchers.length > 0) {
                methods.push(VerificationMethod.SOCIAL_VERIFICATION);
                proofs.push(ethers.utils.defaultAbiCoder.encode(['address[]'], [verificationData.socialVouchers]));
            }

            // Activity verification
            if (verificationData.activityMetrics) {
                methods.push(VerificationMethod.ACTIVITY_VERIFICATION);
                proofs.push(ethers.utils.defaultAbiCoder.encode(
                    ['uint256', 'uint256', 'uint256'],
                    [
                        verificationData.activityMetrics.txCount || 0,
                        verificationData.activityMetrics.contractInteractions || 0,
                        verificationData.activityMetrics.timeActive || 0
                    ]
                ));
            }

            // Stake verification
            if (verificationData.stakeAmount && parseFloat(verificationData.stakeAmount) > 0) {
                methods.push(VerificationMethod.STAKE_VERIFICATION);
                proofs.push(ethers.utils.defaultAbiCoder.encode(['uint256'], [ethers.utils.parseEther(verificationData.stakeAmount)]));
                stakeAmount = verificationData.stakeAmount;
            }

            // Biometric verification
            if (verificationData.biometricProof) {
                methods.push(VerificationMethod.BIOMETRIC_ZK_PROOF);
                proofs.push(ethers.utils.defaultAbiCoder.encode(['bytes'], [verificationData.biometricProof]));
            }

            if (methods.length === 0) {
                throw new Error('At least one verification method must be provided');
            }

            return await this.requestVerification(
                methods,
                proofs,
                verificationData.additionalData || {},
                stakeAmount
            );
        } catch (error) {
            console.error('Error requesting comprehensive verification:', error);
            throw error;
        }
    }

    /**
     * Get user's verification methods
     */
    async getUserVerificationMethods(userAddress) {
        try {
            if (!this.contract) {
                throw new Error('Service not initialized');
            }

            const methods = {};
            
            for (const [methodName, methodId] of Object.entries(VerificationMethod)) {
                methods[methodName] = await this.contract.hasVerificationMethod(userAddress, methodId);
            }

            return methods;
        } catch (error) {
            console.error('Error getting user verification methods:', error);
            return {};
        }
    }

    /**
     * Get user's social vouchers
     */
    async getUserSocialVouchers(userAddress) {
        try {
            if (!this.contract) {
                throw new Error('Service not initialized');
            }

            const vouchers = await this.contract.getUserSocialVouchers(userAddress);
            return vouchers;
        } catch (error) {
            console.error('Error getting user social vouchers:', error);
            return [];
        }
    }

    /**
     * Dispute a user's verification
     */
    async disputeVerification(userAddress, reason) {
        try {
            if (!this.contract) {
                throw new Error('Service not initialized');
            }

            const tx = await this.contract.disputeVerification(userAddress, reason);
            
            toast.loading('Submitting dispute...', { id: 'dispute' });
            
            const receipt = await tx.wait();
            
            toast.success('Dispute submitted successfully!', { id: 'dispute' });
            
            return {
                success: true,
                txHash: receipt.transactionHash
            };
        } catch (error) {
            console.error('Error disputing verification:', error);
            toast.error('Failed to submit dispute', { id: 'dispute' });
            throw error;
        }
    }

    /**
     * Withdraw stake
     */
    async withdrawStake(amount) {
        try {
            if (!this.contract) {
                throw new Error('Service not initialized');
            }

            const tx = await this.contract.withdrawStake(ethers.utils.parseEther(amount));
            
            toast.loading('Withdrawing stake...', { id: 'withdraw-stake' });
            
            const receipt = await tx.wait();
            
            toast.success('Stake withdrawn successfully!', { id: 'withdraw-stake' });
            
            return {
                success: true,
                txHash: receipt.transactionHash
            };
        } catch (error) {
            console.error('Error withdrawing stake:', error);
            toast.error('Failed to withdraw stake', { id: 'withdraw-stake' });
            throw error;
        }
    }

    /**
     * Generate activity metrics for verification
     */
    async generateActivityMetrics(userAddress) {
        try {
            if (!this.provider) {
                throw new Error('Provider not initialized');
            }

            // Get transaction count
            const txCount = await this.provider.getTransactionCount(userAddress);
            
            // Estimate contract interactions (simplified)
            const contractInteractions = Math.floor(txCount * 0.3); // Assume 30% are contract interactions
            
            // Estimate time active (based on first transaction)
            const currentBlock = await this.provider.getBlockNumber();
            const firstTxBlock = Math.max(1, currentBlock - txCount);
            const firstBlock = await this.provider.getBlock(firstTxBlock);
            const timeActive = Math.floor((Date.now() / 1000) - firstBlock.timestamp);

            return {
                txCount,
                contractInteractions,
                timeActive
            };
        } catch (error) {
            console.error('Error generating activity metrics:', error);
            return {
                txCount: 0,
                contractInteractions: 0,
                timeActive: 0
            };
        }
    }

    /**
     * Get verification method weights
     */
    getMethodWeights() {
        return {
            [VerificationMethod.SOCIAL_VERIFICATION]: 200,
            [VerificationMethod.ACTIVITY_VERIFICATION]: 150,
            [VerificationMethod.STAKE_VERIFICATION]: 100,
            [VerificationMethod.BIOMETRIC_ZK_PROOF]: 250,
            [VerificationMethod.MULTI_SIG_VERIFICATION]: 300,
            [VerificationMethod.TIME_LOCK_VERIFICATION]: 50,
            [VerificationMethod.CROSS_CHAIN_VERIFICATION]: 200
        };
    }

    /**
     * Calculate estimated verification score
     */
    calculateEstimatedScore(selectedMethods) {
        const weights = this.getMethodWeights();
        return selectedMethods.reduce((total, method) => total + (weights[method] || 0), 0);
    }

    /**
     * Get verification status text
     */
    getStatusText(status) {
        const statusTexts = {
            [VerificationStatus.UNVERIFIED]: 'Unverified',
            [VerificationStatus.PENDING]: 'Pending',
            [VerificationStatus.VERIFIED]: 'Verified',
            [VerificationStatus.DISPUTED]: 'Disputed',
            [VerificationStatus.REVOKED]: 'Revoked'
        };
        
        return statusTexts[status] || 'Unknown';
    }

    /**
     * Get method name
     */
    getMethodName(method) {
        const methodNames = {
            [VerificationMethod.SOCIAL_VERIFICATION]: 'Social Verification',
            [VerificationMethod.ACTIVITY_VERIFICATION]: 'Activity Verification',
            [VerificationMethod.STAKE_VERIFICATION]: 'Stake Verification',
            [VerificationMethod.BIOMETRIC_ZK_PROOF]: 'Biometric ZK Proof',
            [VerificationMethod.MULTI_SIG_VERIFICATION]: 'Multi-Signature',
            [VerificationMethod.TIME_LOCK_VERIFICATION]: 'Time Lock',
            [VerificationMethod.CROSS_CHAIN_VERIFICATION]: 'Cross-Chain'
        };
        
        return methodNames[method] || 'Unknown Method';
    }
}

// Create singleton instance
const customIdentityService = new CustomIdentityService();

export default customIdentityService;
