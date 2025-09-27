import { ethers } from 'ethers';
import { MerkleTree } from 'merkletreejs';

/**
 * Airdrop Gating Service
 * Manages airdrop campaigns and eligibility verification using Self Protocol
 */
class AirdropGatingService {
    constructor() {
        this.contract = null;
        this.provider = null;
        this.signer = null;
        this.contractAddress = import.meta.env.VITE_AIRDROP_GATING_CONTRACT_ADDRESS;
        this.initialized = false;
        
        // Airdrop types
        this.airdropTypes = {
            TOKEN: 0,
            NFT: 1,
            SBT: 2,
            REPUTATION_POINTS: 3
        };
        
        // Cache for eligibility checks
        this.eligibilityCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }
    
    /**
     * Initialize the airdrop gating service
     * @param {Object} provider - Ethereum provider
     * @param {Object} signer - Ethereum signer
     */
    async initialize(provider, signer) {
        try {
            this.provider = provider;
            this.signer = signer;
            
            // Initialize contract
            await this.initializeContract();
            
            this.initialized = true;
            console.log('Airdrop gating service initialized successfully');
            
            return { success: true };
        } catch (error) {
            console.error('Failed to initialize airdrop gating service:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Initialize smart contract
     */
    async initializeContract() {
        const contractABI = [
            "function createCampaign(string memory name, string memory description, uint8 airdropType, address tokenContract, uint256 tokenId, uint256 rewardAmount, uint256 totalSupply, uint256 startTime, uint256 endTime, tuple(bool requiresHumanVerification, bool requiresAgeVerification, uint256 minimumAge, bool requiresCountryVerification, string[] allowedCountries, bool requiresKYC, bool requiresUniqueIdentity, uint256 minimumTradingVolume, uint256 minimumStakeAmount, bool requiresDataContribution) criteria, bytes32 merkleRoot) external",
            "function checkEligibility(address user, uint256 campaignId, bytes memory selfProof, bytes32[] memory merkleProof) external view returns (bool)",
            "function claimAirdrop(uint256 campaignId, bytes memory selfProof, bytes32[] memory merkleProof) external",
            "function getCampaign(uint256 campaignId) external view returns (uint256, string memory, string memory, uint8, address, uint256, uint256, uint256, uint256, uint256, uint256, bool)",
            "function getUserReputation(address user) external view returns (uint256, uint256, uint256, uint256, uint256, uint256)",
            "function getUserClaimedCampaigns(address user) external view returns (uint256[] memory)",
            "function hasUserClaimed(address user, uint256 campaignId) external view returns (bool)",
            "function getActiveCampaignsCount() external view returns (uint256)",
            "function updateReputationScore(address user, uint256 points, string memory reason) external",
            "function campaignCounter() external view returns (uint256)",
            "event CampaignCreated(uint256 indexed campaignId, string name, uint8 airdropType, uint256 totalSupply)",
            "event AirdropClaimed(uint256 indexed campaignId, address indexed user, uint256 amount)",
            "event ReputationUpdated(address indexed user, uint256 newScore, string reason)"
        ];
        
        this.contract = new ethers.Contract(
            this.contractAddress,
            contractABI,
            this.signer
        );
    }
    
    /**
     * Create a new airdrop campaign
     * @param {Object} campaignData - Campaign configuration
     * @returns {Object} Creation result
     */
    async createCampaign(campaignData) {
        try {
            if (!this.initialized) {
                throw new Error('Airdrop gating service not initialized');
            }
            
            const {
                name,
                description,
                airdropType,
                tokenContract,
                tokenId = 0,
                rewardAmount,
                totalSupply,
                startTime,
                endTime,
                criteria,
                eligibleAddresses = []
            } = campaignData;
            
            // Generate merkle tree for eligible addresses if provided
            let merkleRoot = ethers.constants.HashZero;
            if (eligibleAddresses.length > 0) {
                const merkleTree = this.generateMerkleTree(eligibleAddresses);
                merkleRoot = merkleTree.getHexRoot();
            }
            
            // Convert criteria to contract format
            const contractCriteria = {
                requiresHumanVerification: criteria.requiresHumanVerification || false,
                requiresAgeVerification: criteria.requiresAgeVerification || false,
                minimumAge: criteria.minimumAge || 0,
                requiresCountryVerification: criteria.requiresCountryVerification || false,
                allowedCountries: criteria.allowedCountries || [],
                requiresKYC: criteria.requiresKYC || false,
                requiresUniqueIdentity: criteria.requiresUniqueIdentity || false,
                minimumTradingVolume: ethers.utils.parseEther(criteria.minimumTradingVolume?.toString() || '0'),
                minimumStakeAmount: criteria.minimumStakeAmount || 0,
                requiresDataContribution: criteria.requiresDataContribution || false
            };
            
            // Create campaign transaction
            const tx = await this.contract.createCampaign(
                name,
                description,
                this.airdropTypes[airdropType],
                tokenContract,
                tokenId,
                ethers.utils.parseEther(rewardAmount.toString()),
                totalSupply,
                Math.floor(startTime / 1000),
                Math.floor(endTime / 1000),
                contractCriteria,
                merkleRoot
            );
            
            const receipt = await tx.wait();
            
            // Parse campaign created event
            const campaignCreatedEvent = receipt.events?.find(
                event => event.event === 'CampaignCreated'
            );
            
            if (campaignCreatedEvent) {
                const { campaignId } = campaignCreatedEvent.args;
                
                return {
                    success: true,
                    campaignId: campaignId.toString(),
                    merkleRoot,
                    transactionHash: receipt.transactionHash
                };
            }
            
            throw new Error('Campaign creation event not found');
            
        } catch (error) {
            console.error('Failed to create campaign:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Check user eligibility for a campaign
     * @param {string} userAddress - User address
     * @param {string} campaignId - Campaign ID
     * @param {Object} selfProof - Self Protocol verification proof
     * @param {Array} eligibleAddresses - List of eligible addresses for merkle proof
     * @returns {Object} Eligibility result
     */
    async checkEligibility(userAddress, campaignId, selfProof = {}, eligibleAddresses = []) {
        try {
            if (!this.initialized) {
                throw new Error('Airdrop gating service not initialized');
            }
            
            const cacheKey = `${userAddress}_${campaignId}`;
            
            // Check cache first
            if (this.eligibilityCache.has(cacheKey)) {
                const cached = this.eligibilityCache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return { success: true, ...cached.data, fromCache: true };
                }
            }
            
            // Generate merkle proof if eligible addresses provided
            let merkleProof = [];
            if (eligibleAddresses.length > 0) {
                const merkleTree = this.generateMerkleTree(eligibleAddresses);
                const leaf = ethers.utils.keccak256(ethers.utils.solidityPack(['address'], [userAddress]));
                merkleProof = merkleTree.getHexProof(leaf);
            }
            
            // Encode Self Protocol proof (simplified for demo)
            const encodedSelfProof = ethers.utils.defaultAbiCoder.encode(
                ['address', 'bool', 'uint256'],
                [userAddress, selfProof.isVerified || false, selfProof.timestamp || Date.now()]
            );
            
            // Check eligibility on-chain
            const isEligible = await this.contract.checkEligibility(
                userAddress,
                campaignId,
                encodedSelfProof,
                merkleProof
            );
            
            // Get additional eligibility details
            const campaign = await this.getCampaign(campaignId);
            const userReputation = await this.getUserReputation(userAddress);
            const hasClaimed = await this.contract.hasUserClaimed(userAddress, campaignId);
            
            const result = {
                eligible: isEligible,
                hasClaimed,
                campaign,
                userReputation,
                merkleProof: merkleProof.length > 0 ? merkleProof : null,
                reasons: this.getEligibilityReasons(isEligible, campaign, userReputation, hasClaimed)
            };
            
            // Cache the result
            this.eligibilityCache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });
            
            return { success: true, ...result };
            
        } catch (error) {
            console.error('Failed to check eligibility:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Claim airdrop reward
     * @param {string} campaignId - Campaign ID
     * @param {Object} selfProof - Self Protocol verification proof
     * @param {Array} eligibleAddresses - List of eligible addresses for merkle proof
     * @returns {Object} Claim result
     */
    async claimAirdrop(campaignId, selfProof = {}, eligibleAddresses = []) {
        try {
            if (!this.initialized) {
                throw new Error('Airdrop gating service not initialized');
            }
            
            const userAddress = await this.signer.getAddress();
            
            // Generate merkle proof if needed
            let merkleProof = [];
            if (eligibleAddresses.length > 0) {
                const merkleTree = this.generateMerkleTree(eligibleAddresses);
                const leaf = ethers.utils.keccak256(ethers.utils.solidityPack(['address'], [userAddress]));
                merkleProof = merkleTree.getHexProof(leaf);
            }
            
            // Encode Self Protocol proof
            const encodedSelfProof = ethers.utils.defaultAbiCoder.encode(
                ['address', 'bool', 'uint256'],
                [userAddress, selfProof.isVerified || false, selfProof.timestamp || Date.now()]
            );
            
            // Claim airdrop
            const tx = await this.contract.claimAirdrop(
                campaignId,
                encodedSelfProof,
                merkleProof
            );
            
            const receipt = await tx.wait();
            
            // Parse claim event
            const claimEvent = receipt.events?.find(
                event => event.event === 'AirdropClaimed'
            );
            
            if (claimEvent) {
                const { amount } = claimEvent.args;
                
                // Clear eligibility cache for this user/campaign
                const cacheKey = `${userAddress}_${campaignId}`;
                this.eligibilityCache.delete(cacheKey);
                
                return {
                    success: true,
                    amount: ethers.utils.formatEther(amount),
                    transactionHash: receipt.transactionHash
                };
            }
            
            return { success: true, transactionHash: receipt.transactionHash };
            
        } catch (error) {
            console.error('Failed to claim airdrop:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get campaign details
     * @param {string} campaignId - Campaign ID
     * @returns {Object} Campaign details
     */
    async getCampaign(campaignId) {
        try {
            const [
                id,
                name,
                description,
                airdropType,
                tokenContract,
                tokenId,
                rewardAmount,
                totalSupply,
                claimed,
                startTime,
                endTime,
                isActive
            ] = await this.contract.getCampaign(campaignId);
            
            return {
                id: id.toString(),
                name,
                description,
                airdropType: Object.keys(this.airdropTypes)[airdropType],
                tokenContract,
                tokenId: tokenId.toString(),
                rewardAmount: ethers.utils.formatEther(rewardAmount),
                totalSupply: totalSupply.toString(),
                claimed: claimed.toString(),
                startTime: new Date(startTime.toNumber() * 1000),
                endTime: new Date(endTime.toNumber() * 1000),
                isActive,
                progress: totalSupply.gt(0) ? (claimed.toNumber() / totalSupply.toNumber()) * 100 : 0
            };
            
        } catch (error) {
            console.error('Failed to get campaign:', error);
            return null;
        }
    }
    
    /**
     * Get user reputation score
     * @param {string} userAddress - User address
     * @returns {Object} Reputation details
     */
    async getUserReputation(userAddress) {
        try {
            const [
                tradingScore,
                dataContributionScore,
                governanceScore,
                verificationScore,
                totalScore,
                lastUpdated
            ] = await this.contract.getUserReputation(userAddress);
            
            return {
                tradingScore: tradingScore.toNumber(),
                dataContributionScore: dataContributionScore.toNumber(),
                governanceScore: governanceScore.toNumber(),
                verificationScore: verificationScore.toNumber(),
                totalScore: totalScore.toNumber(),
                lastUpdated: new Date(lastUpdated.toNumber() * 1000),
                level: this.calculateReputationLevel(totalScore.toNumber())
            };
            
        } catch (error) {
            console.error('Failed to get user reputation:', error);
            return {
                tradingScore: 0,
                dataContributionScore: 0,
                governanceScore: 0,
                verificationScore: 0,
                totalScore: 0,
                lastUpdated: new Date(),
                level: 'Newcomer'
            };
        }
    }
    
    /**
     * Get user's claimed campaigns
     * @param {string} userAddress - User address
     * @returns {Object} Claimed campaigns
     */
    async getUserClaimedCampaigns(userAddress) {
        try {
            const claimedIds = await this.contract.getUserClaimedCampaigns(userAddress);
            const campaigns = [];
            
            for (const id of claimedIds) {
                const campaign = await this.getCampaign(id.toString());
                if (campaign) {
                    campaigns.push(campaign);
                }
            }
            
            return { success: true, campaigns };
            
        } catch (error) {
            console.error('Failed to get claimed campaigns:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get all active campaigns
     * @returns {Object} Active campaigns
     */
    async getActiveCampaigns() {
        try {
            const campaignCount = await this.contract.campaignCounter();
            const campaigns = [];
            
            for (let i = 0; i < campaignCount.toNumber(); i++) {
                const campaign = await this.getCampaign(i.toString());
                if (campaign && campaign.isActive) {
                    const now = new Date();
                    if (campaign.startTime <= now && campaign.endTime >= now) {
                        campaigns.push(campaign);
                    }
                }
            }
            
            return { success: true, campaigns };
            
        } catch (error) {
            console.error('Failed to get active campaigns:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Generate merkle tree from eligible addresses
     * @param {Array} addresses - Array of eligible addresses
     * @returns {MerkleTree} Merkle tree
     */
    generateMerkleTree(addresses) {
        const leaves = addresses.map(addr => 
            ethers.utils.keccak256(ethers.utils.solidityPack(['address'], [addr]))
        );
        return new MerkleTree(leaves, ethers.utils.keccak256, { sortPairs: true });
    }
    
    /**
     * Get eligibility reasons
     * @param {boolean} isEligible - Whether user is eligible
     * @param {Object} campaign - Campaign details
     * @param {Object} reputation - User reputation
     * @param {boolean} hasClaimed - Whether user has claimed
     * @returns {Array} Array of reasons
     */
    getEligibilityReasons(isEligible, campaign, reputation, hasClaimed) {
        const reasons = [];
        
        if (hasClaimed) {
            reasons.push({ type: 'error', message: 'Already claimed this airdrop' });
        }
        
        if (!campaign.isActive) {
            reasons.push({ type: 'error', message: 'Campaign is not active' });
        }
        
        const now = new Date();
        if (campaign.startTime > now) {
            reasons.push({ type: 'warning', message: 'Campaign has not started yet' });
        }
        
        if (campaign.endTime < now) {
            reasons.push({ type: 'error', message: 'Campaign has ended' });
        }
        
        if (campaign.claimed >= campaign.totalSupply) {
            reasons.push({ type: 'error', message: 'All rewards have been claimed' });
        }
        
        if (isEligible && !hasClaimed) {
            reasons.push({ type: 'success', message: 'You are eligible to claim this airdrop!' });
        }
        
        return reasons;
    }
    
    /**
     * Calculate reputation level based on total score
     * @param {number} totalScore - Total reputation score
     * @returns {string} Reputation level
     */
    calculateReputationLevel(totalScore) {
        if (totalScore >= 800) return 'Legend';
        if (totalScore >= 600) return 'Expert';
        if (totalScore >= 400) return 'Advanced';
        if (totalScore >= 200) return 'Intermediate';
        if (totalScore >= 50) return 'Beginner';
        return 'Newcomer';
    }
    
    /**
     * Update user reputation score (admin only)
     * @param {string} userAddress - User address
     * @param {number} points - Points to add
     * @param {string} reason - Reason for update
     * @returns {Object} Update result
     */
    async updateReputationScore(userAddress, points, reason) {
        try {
            if (!this.initialized) {
                throw new Error('Airdrop gating service not initialized');
            }
            
            const tx = await this.contract.updateReputationScore(
                userAddress,
                points,
                reason
            );
            
            const receipt = await tx.wait();
            
            return {
                success: true,
                transactionHash: receipt.transactionHash
            };
            
        } catch (error) {
            console.error('Failed to update reputation score:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Clear eligibility cache
     */
    clearCache() {
        this.eligibilityCache.clear();
    }
    
    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getCacheStats() {
        return {
            size: this.eligibilityCache.size,
            timeout: this.cacheTimeout
        };
    }
}

export default AirdropGatingService;
