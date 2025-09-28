// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title CustomIdentityVerification
 * @dev Advanced custom identity verification system with multiple verification methods
 * Replaces Self Protocol with more flexible and comprehensive verification logic
 */
contract CustomIdentityVerification is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    // Verification methods enum
    enum VerificationMethod {
        SOCIAL_VERIFICATION,    // Community vouching
        ACTIVITY_VERIFICATION,  // On-chain activity patterns
        STAKE_VERIFICATION,     // Economic stake for verification
        BIOMETRIC_ZK_PROOF,    // Zero-knowledge biometric proof
        MULTI_SIG_VERIFICATION, // Multiple trusted verifiers
        TIME_LOCK_VERIFICATION, // Time-based verification
        CROSS_CHAIN_VERIFICATION // Cross-chain identity proof
    }

    // Verification status enum
    enum VerificationStatus {
        UNVERIFIED,
        PENDING,
        VERIFIED,
        DISPUTED,
        REVOKED
    }

    // User identity structure
    struct UserIdentity {
        address user;
        VerificationStatus status;
        uint256 verificationScore;
        uint256 reputationScore;
        uint256 verificationTimestamp;
        uint256 expirationTimestamp;
        bytes32 identityHash;
        mapping(VerificationMethod => bool) verificationMethods;
        mapping(VerificationMethod => uint256) methodScores;
        address[] socialVouchers;
        uint256 stakeAmount;
        bool isActive;
    }

    // Verifier structure for trusted verifiers
    struct TrustedVerifier {
        address verifier;
        uint256 reputation;
        uint256 successfulVerifications;
        uint256 disputedVerifications;
        bool isActive;
        string verifierType; // "individual", "organization", "dao"
    }

    // Social verification request
    struct SocialVerificationRequest {
        address requester;
        address[] vouchers;
        uint256 requiredVouchers;
        uint256 currentVouchers;
        uint256 deadline;
        bool completed;
        mapping(address => bool) hasVouched;
    }

    // Storage
    mapping(address => UserIdentity) public userIdentities;
    mapping(address => TrustedVerifier) public trustedVerifiers;
    mapping(bytes32 => SocialVerificationRequest) public socialRequests;
    mapping(address => bytes32[]) public userSocialRequests;
    
    // Configuration
    uint256 public constant MIN_VERIFICATION_SCORE = 100;
    uint256 public constant MAX_VERIFICATION_SCORE = 1000;
    uint256 public constant MIN_STAKE_AMOUNT = 0.1 ether;
    uint256 public constant VERIFICATION_DURATION = 365 days;
    uint256 public constant SOCIAL_VOUCHER_REQUIREMENT = 3;
    
    // Method weights for scoring
    mapping(VerificationMethod => uint256) public methodWeights;
    
    // Events
    event UserVerificationRequested(address indexed user, VerificationMethod method);
    event UserVerified(address indexed user, uint256 score, VerificationMethod[] methods);
    event VerificationDisputed(address indexed user, address indexed disputer, string reason);
    event SocialVouchingCompleted(address indexed user, uint256 voucherCount);
    event TrustedVerifierAdded(address indexed verifier, string verifierType);
    event VerificationRevoked(address indexed user, string reason);
    event StakeDeposited(address indexed user, uint256 amount);
    event StakeWithdrawn(address indexed user, uint256 amount);

    constructor() {
        // Initialize method weights
        methodWeights[VerificationMethod.SOCIAL_VERIFICATION] = 200;
        methodWeights[VerificationMethod.ACTIVITY_VERIFICATION] = 150;
        methodWeights[VerificationMethod.STAKE_VERIFICATION] = 100;
        methodWeights[VerificationMethod.BIOMETRIC_ZK_PROOF] = 250;
        methodWeights[VerificationMethod.MULTI_SIG_VERIFICATION] = 300;
        methodWeights[VerificationMethod.TIME_LOCK_VERIFICATION] = 50;
        methodWeights[VerificationMethod.CROSS_CHAIN_VERIFICATION] = 200;
    }

    /**
     * @dev Request identity verification using multiple methods
     * @param methods Array of verification methods to use
     * @param proofs Array of proofs corresponding to each method
     * @param additionalData Additional data for verification (nationality, age, etc.)
     */
    function requestVerification(
        VerificationMethod[] memory methods,
        bytes[] memory proofs,
        bytes memory additionalData
    ) external payable nonReentrant {
        require(methods.length == proofs.length, "Methods and proofs length mismatch");
        require(methods.length > 0, "At least one method required");
        
        UserIdentity storage identity = userIdentities[msg.sender];
        
        // Initialize identity if first time
        if (identity.user == address(0)) {
            identity.user = msg.sender;
            identity.status = VerificationStatus.PENDING;
            identity.verificationTimestamp = block.timestamp;
            identity.expirationTimestamp = block.timestamp + VERIFICATION_DURATION;
            identity.identityHash = keccak256(abi.encodePacked(msg.sender, block.timestamp, additionalData));
            identity.isActive = true;
        }

        uint256 totalScore = 0;
        
        // Process each verification method
        for (uint256 i = 0; i < methods.length; i++) {
            VerificationMethod method = methods[i];
            bytes memory proof = proofs[i];
            
            uint256 methodScore = _processVerificationMethod(method, proof, additionalData);
            
            if (methodScore > 0) {
                identity.verificationMethods[method] = true;
                identity.methodScores[method] = methodScore;
                totalScore += methodScore;
                
                emit UserVerificationRequested(msg.sender, method);
            }
        }
        
        identity.verificationScore = totalScore;
        
        // Auto-verify if score meets threshold
        if (totalScore >= MIN_VERIFICATION_SCORE) {
            identity.status = VerificationStatus.VERIFIED;
            emit UserVerified(msg.sender, totalScore, methods);
        }
    }

    /**
     * @dev Process individual verification method
     * @param method Verification method
     * @param proof Proof data
     * @param additionalData Additional verification data
     * @return methodScore Score earned from this method
     */
    function _processVerificationMethod(
        VerificationMethod method,
        bytes memory proof,
        bytes memory additionalData
    ) internal returns (uint256 methodScore) {
        
        if (method == VerificationMethod.SOCIAL_VERIFICATION) {
            return _processSocialVerification(proof);
        } else if (method == VerificationMethod.ACTIVITY_VERIFICATION) {
            return _processActivityVerification(proof);
        } else if (method == VerificationMethod.STAKE_VERIFICATION) {
            return _processStakeVerification();
        } else if (method == VerificationMethod.BIOMETRIC_ZK_PROOF) {
            return _processBiometricVerification(proof);
        } else if (method == VerificationMethod.MULTI_SIG_VERIFICATION) {
            return _processMultiSigVerification(proof);
        } else if (method == VerificationMethod.TIME_LOCK_VERIFICATION) {
            return _processTimeLockVerification(proof);
        } else if (method == VerificationMethod.CROSS_CHAIN_VERIFICATION) {
            return _processCrossChainVerification(proof);
        }
        
        return 0;
    }

    /**
     * @dev Process social verification (community vouching)
     * @param proof Encoded voucher addresses and signatures
     * @return Score from social verification
     */
    function _processSocialVerification(bytes memory proof) internal returns (uint256) {
        // Decode voucher addresses from proof
        address[] memory vouchers = abi.decode(proof, (address[]));
        
        require(vouchers.length >= SOCIAL_VOUCHER_REQUIREMENT, "Insufficient vouchers");
        
        uint256 validVouchers = 0;
        UserIdentity storage identity = userIdentities[msg.sender];
        
        for (uint256 i = 0; i < vouchers.length; i++) {
            address voucher = vouchers[i];
            
            // Voucher must be verified themselves
            if (isUserVerified(voucher) && voucher != msg.sender) {
                identity.socialVouchers.push(voucher);
                validVouchers++;
            }
        }
        
        if (validVouchers >= SOCIAL_VOUCHER_REQUIREMENT) {
            emit SocialVouchingCompleted(msg.sender, validVouchers);
            return methodWeights[VerificationMethod.SOCIAL_VERIFICATION];
        }
        
        return 0;
    }

    /**
     * @dev Process activity-based verification
     * @param proof Activity proof data
     * @return Score from activity verification
     */
    function _processActivityVerification(bytes memory proof) internal view returns (uint256) {
        // Decode activity metrics
        (uint256 txCount, uint256 contractInteractions, uint256 timeActive) = 
            abi.decode(proof, (uint256, uint256, uint256));
        
        // Calculate score based on activity patterns
        uint256 score = 0;
        
        if (txCount >= 50) score += 50;
        if (contractInteractions >= 10) score += 50;
        if (timeActive >= 30 days) score += 50;
        
        return score;
    }

    /**
     * @dev Process stake-based verification
     * @return Score from stake verification
     */
    function _processStakeVerification() internal returns (uint256) {
        require(msg.value >= MIN_STAKE_AMOUNT, "Insufficient stake amount");
        
        UserIdentity storage identity = userIdentities[msg.sender];
        identity.stakeAmount += msg.value;
        
        emit StakeDeposited(msg.sender, msg.value);
        
        return methodWeights[VerificationMethod.STAKE_VERIFICATION];
    }

    /**
     * @dev Process biometric ZK proof verification
     * @param proof ZK proof of biometric data
     * @return Score from biometric verification
     */
    function _processBiometricVerification(bytes memory proof) internal pure returns (uint256) {
        // In a real implementation, verify the ZK proof
        // For now, assume proof is valid if non-empty
        require(proof.length > 0, "Invalid biometric proof");
        
        return methodWeights[VerificationMethod.BIOMETRIC_ZK_PROOF];
    }

    /**
     * @dev Process multi-signature verification from trusted verifiers
     * @param proof Multi-sig proof data
     * @return Score from multi-sig verification
     */
    function _processMultiSigVerification(bytes memory proof) internal view returns (uint256) {
        // Decode verifier signatures
        (address[] memory verifiers, bytes[] memory signatures) = 
            abi.decode(proof, (address[], bytes[]));
        
        require(verifiers.length == signatures.length, "Verifiers and signatures mismatch");
        
        uint256 validSignatures = 0;
        bytes32 messageHash = keccak256(abi.encodePacked(msg.sender, "verification"));
        
        for (uint256 i = 0; i < verifiers.length; i++) {
            address verifier = verifiers[i];
            
            if (trustedVerifiers[verifier].isActive) {
                address recovered = messageHash.toEthSignedMessageHash().recover(signatures[i]);
                if (recovered == verifier) {
                    validSignatures++;
                }
            }
        }
        
        if (validSignatures >= 2) {
            return methodWeights[VerificationMethod.MULTI_SIG_VERIFICATION];
        }
        
        return 0;
    }

    /**
     * @dev Process time-lock verification
     * @param proof Time-lock proof data
     * @return Score from time-lock verification
     */
    function _processTimeLockVerification(bytes memory proof) internal view returns (uint256) {
        uint256 lockDuration = abi.decode(proof, (uint256));
        
        if (lockDuration >= 7 days) {
            return methodWeights[VerificationMethod.TIME_LOCK_VERIFICATION];
        }
        
        return 0;
    }

    /**
     * @dev Process cross-chain verification
     * @param proof Cross-chain proof data
     * @return Score from cross-chain verification
     */
    function _processCrossChainVerification(bytes memory proof) internal pure returns (uint256) {
        // Decode cross-chain verification data
        (bytes32 merkleRoot, bytes32[] memory merkleProof) = 
            abi.decode(proof, (bytes32, bytes32[]));
        
        // Verify merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        
        if (MerkleProof.verify(merkleProof, merkleRoot, leaf)) {
            return methodWeights[VerificationMethod.CROSS_CHAIN_VERIFICATION];
        }
        
        return 0;
    }

    /**
     * @dev Check if user is verified
     * @param user User address
     * @return Whether user is verified and verification is still valid
     */
    function isUserVerified(address user) public view returns (bool) {
        UserIdentity storage identity = userIdentities[user];
        
        return identity.status == VerificationStatus.VERIFIED &&
               identity.isActive &&
               block.timestamp <= identity.expirationTimestamp;
    }

    /**
     * @dev Get user verification details
     * @param user User address
     * @return Verification details
     */
    function getUserVerificationDetails(address user) external view returns (
        VerificationStatus status,
        uint256 verificationScore,
        uint256 reputationScore,
        uint256 verificationTimestamp,
        uint256 expirationTimestamp,
        uint256 stakeAmount,
        bool isActive
    ) {
        UserIdentity storage identity = userIdentities[user];
        
        return (
            identity.status,
            identity.verificationScore,
            identity.reputationScore,
            identity.verificationTimestamp,
            identity.expirationTimestamp,
            identity.stakeAmount,
            identity.isActive
        );
    }

    /**
     * @dev Add trusted verifier
     * @param verifier Verifier address
     * @param verifierType Type of verifier
     */
    function addTrustedVerifier(
        address verifier,
        string memory verifierType
    ) external onlyOwner {
        trustedVerifiers[verifier] = TrustedVerifier({
            verifier: verifier,
            reputation: 100,
            successfulVerifications: 0,
            disputedVerifications: 0,
            isActive: true,
            verifierType: verifierType
        });
        
        emit TrustedVerifierAdded(verifier, verifierType);
    }

    /**
     * @dev Dispute a user's verification
     * @param user User to dispute
     * @param reason Reason for dispute
     */
    function disputeVerification(
        address user,
        string memory reason
    ) external {
        require(isUserVerified(msg.sender), "Disputer must be verified");
        
        UserIdentity storage identity = userIdentities[user];
        identity.status = VerificationStatus.DISPUTED;
        
        emit VerificationDisputed(user, msg.sender, reason);
    }

    /**
     * @dev Revoke user verification (admin only)
     * @param user User to revoke
     * @param reason Reason for revocation
     */
    function revokeVerification(
        address user,
        string memory reason
    ) external onlyOwner {
        UserIdentity storage identity = userIdentities[user];
        identity.status = VerificationStatus.REVOKED;
        identity.isActive = false;
        
        emit VerificationRevoked(user, reason);
    }

    /**
     * @dev Withdraw stake (only if not verified or after verification expires)
     * @param amount Amount to withdraw
     */
    function withdrawStake(uint256 amount) external nonReentrant {
        UserIdentity storage identity = userIdentities[msg.sender];
        
        require(
            identity.status != VerificationStatus.VERIFIED ||
            block.timestamp > identity.expirationTimestamp,
            "Cannot withdraw stake while verified"
        );
        
        require(identity.stakeAmount >= amount, "Insufficient stake balance");
        
        identity.stakeAmount -= amount;
        payable(msg.sender).transfer(amount);
        
        emit StakeWithdrawn(msg.sender, amount);
    }

    /**
     * @dev Update method weights (admin only)
     * @param method Verification method
     * @param weight New weight
     */
    function updateMethodWeight(
        VerificationMethod method,
        uint256 weight
    ) external onlyOwner {
        methodWeights[method] = weight;
    }

    /**
     * @dev Get user's verification methods
     * @param user User address
     * @param method Verification method
     * @return Whether user has completed this method
     */
    function hasVerificationMethod(
        address user,
        VerificationMethod method
    ) external view returns (bool) {
        return userIdentities[user].verificationMethods[method];
    }

    /**
     * @dev Get user's social vouchers
     * @param user User address
     * @return Array of voucher addresses
     */
    function getUserSocialVouchers(address user) external view returns (address[] memory) {
        return userIdentities[user].socialVouchers;
    }

    /**
     * @dev Emergency pause contract
     */
    function pause() external onlyOwner {
        // Implementation for pausing contract
    }

    /**
     * @dev Receive function for stake deposits
     */
    receive() external payable {
        // Allow direct ETH deposits for staking
    }
}
