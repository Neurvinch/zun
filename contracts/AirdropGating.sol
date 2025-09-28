// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./CustomIdentityVerification.sol";

/**
 * @title AirdropGating
 * @dev Manages airdrops and eligibility gating using Custom Identity Verification
 * Supports multiple airdrop types: tokens, NFTs, and reputation SBTs
 */
contract AirdropGating is Ownable, ReentrancyGuard {
    
    // Custom identity verification contract
    CustomIdentityVerification public immutable identityVerifier;
    
    // Airdrop types
    enum AirdropType {
        TOKEN,
        NFT,
        SBT,
        REPUTATION_POINTS
    }
    
    // Eligibility criteria
    struct EligibilityCriteria {
        bool requiresHumanVerification;
        bool requiresAgeVerification;
        uint256 minimumAge;
        bool requiresCountryVerification;
        string[] allowedCountries;
        bool requiresKYC;
        bool requiresUniqueIdentity;
        uint256 minimumTradingVolume;
        uint256 minimumStakeAmount;
        bool requiresDataContribution;
    }
    
    // Airdrop campaign
    struct AirdropCampaign {
        uint256 id;
        string name;
        string description;
        AirdropType airdropType;
        address tokenContract;
        uint256 tokenId; // For NFTs
        uint256 rewardAmount;
        uint256 totalSupply;
        uint256 claimed;
        uint256 startTime;
        uint256 endTime;
        EligibilityCriteria criteria;
        bytes32 merkleRoot;
        bool isActive;
        mapping(address => bool) hasClaimed;
    }
    
    // Reputation system
    struct ReputationScore {
        uint256 tradingScore;
        uint256 dataContributionScore;
        uint256 governanceScore;
        uint256 verificationScore;
        uint256 totalScore;
        uint256 lastUpdated;
    }
    
    // Storage
    mapping(uint256 => AirdropCampaign) public campaigns;
    mapping(address => ReputationScore) public reputationScores;
    mapping(address => mapping(uint256 => bool)) public userCampaignEligibility;
    mapping(address => uint256[]) public userClaimedCampaigns;
    
    uint256 public campaignCounter;
    uint256 public constant MAX_REPUTATION_SCORE = 1000;
    
    // Events
    event CampaignCreated(
        uint256 indexed campaignId,
        string name,
        AirdropType airdropType,
        uint256 totalSupply
    );
    
    event AirdropClaimed(
        uint256 indexed campaignId,
        address indexed user,
        uint256 amount
    );
    
    event EligibilityUpdated(
        address indexed user,
        uint256 indexed campaignId,
        bool eligible
    );
    
    event ReputationUpdated(
        address indexed user,
        uint256 newScore,
        string reason
    );
    
    constructor(address _identityVerifier) {
        identityVerifier = CustomIdentityVerification(_identityVerifier);
    }
    
    /**
     * @dev Create a new airdrop campaign
     * @param name Campaign name
     * @param description Campaign description
     * @param airdropType Type of airdrop (TOKEN, NFT, SBT, REPUTATION_POINTS)
     * @param tokenContract Address of the token/NFT contract
     * @param tokenId Token ID for NFTs (0 for tokens)
     * @param rewardAmount Amount per claim
     * @param totalSupply Total supply for the campaign
     * @param startTime Campaign start time
     * @param endTime Campaign end time
     * @param criteria Eligibility criteria
     * @param merkleRoot Merkle root for additional eligibility (optional)
     */
    function createCampaign(
        string memory name,
        string memory description,
        AirdropType airdropType,
        address tokenContract,
        uint256 tokenId,
        uint256 rewardAmount,
        uint256 totalSupply,
        uint256 startTime,
        uint256 endTime,
        EligibilityCriteria memory criteria,
        bytes32 merkleRoot
    ) external onlyOwner {
        require(startTime < endTime, "Invalid time range");
        require(totalSupply > 0, "Invalid total supply");
        
        uint256 campaignId = campaignCounter++;
        AirdropCampaign storage campaign = campaigns[campaignId];
        
        campaign.id = campaignId;
        campaign.name = name;
        campaign.description = description;
        campaign.airdropType = airdropType;
        campaign.tokenContract = tokenContract;
        campaign.tokenId = tokenId;
        campaign.rewardAmount = rewardAmount;
        campaign.totalSupply = totalSupply;
        campaign.claimed = 0;
        campaign.startTime = startTime;
        campaign.endTime = endTime;
        campaign.criteria = criteria;
        campaign.merkleRoot = merkleRoot;
        campaign.isActive = true;
        
        emit CampaignCreated(campaignId, name, airdropType, totalSupply);
    }
    
    /**
     * @dev Check if user is eligible for a campaign
     * @param user User address
     * @param campaignId Campaign ID
     * @param verificationProof Custom verification proof (unused in current implementation)
     * @param merkleProof Merkle proof for additional eligibility
     * @return eligible Whether user is eligible
     */
    function checkEligibility(
        address user,
        uint256 campaignId,
        bytes memory verificationProof,
        bytes32[] memory merkleProof
    ) external view returns (bool eligible) {
        AirdropCampaign storage campaign = campaigns[campaignId];
        
        // Check campaign is active and within time range
        if (!campaign.isActive || 
            block.timestamp < campaign.startTime || 
            block.timestamp > campaign.endTime) {
            return false;
        }
        
        // Check if already claimed
        if (campaign.hasClaimed[user]) {
            return false;
        }
        
        // Check supply
        if (campaign.claimed >= campaign.totalSupply) {
            return false;
        }
        
        EligibilityCriteria memory criteria = campaign.criteria;
        
        // Check custom identity verification requirements
        if (criteria.requiresHumanVerification) {
            if (!identityVerifier.isUserVerified(user)) {
                return false;
            }
            
            // Check verification score if required
            (, uint256 verificationScore,,,,,) = identityVerifier.getUserVerificationDetails(user);
            if (verificationScore < 100) { // Minimum score requirement
                return false;
            }
        }
        
        // Check merkle proof if required
        if (campaign.merkleRoot != bytes32(0)) {
            bytes32 leaf = keccak256(abi.encodePacked(user));
            if (!MerkleProof.verify(merkleProof, campaign.merkleRoot, leaf)) {
                return false;
            }
        }
        
        // Check reputation score if required
        if (criteria.minimumStakeAmount > 0) {
            ReputationScore memory reputation = reputationScores[user];
            if (reputation.totalScore < criteria.minimumStakeAmount) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * @dev Claim airdrop reward
     * @param campaignId Campaign ID
     * @param verificationProof Custom verification proof (unused in current implementation)
     * @param merkleProof Merkle proof for additional eligibility
     */
    function claimAirdrop(
        uint256 campaignId,
        bytes memory verificationProof,
        bytes32[] memory merkleProof
    ) external nonReentrant {
        require(
            this.checkEligibility(msg.sender, campaignId, verificationProof, merkleProof),
            "Not eligible for this airdrop"
        );
        
        AirdropCampaign storage campaign = campaigns[campaignId];
        
        // Mark as claimed
        campaign.hasClaimed[msg.sender] = true;
        campaign.claimed++;
        userClaimedCampaigns[msg.sender].push(campaignId);
        
        // Distribute reward based on type
        if (campaign.airdropType == AirdropType.TOKEN) {
            IERC20(campaign.tokenContract).transfer(msg.sender, campaign.rewardAmount);
        } else if (campaign.airdropType == AirdropType.NFT) {
            IERC721(campaign.tokenContract).transferFrom(
                address(this),
                msg.sender,
                campaign.tokenId
            );
        } else if (campaign.airdropType == AirdropType.REPUTATION_POINTS) {
            _updateReputationScore(
                msg.sender,
                campaign.rewardAmount,
                "Airdrop participation"
            );
        }
        
        emit AirdropClaimed(campaignId, msg.sender, campaign.rewardAmount);
    }
    
    /**
     * @dev Update user's reputation score
     * @param user User address
     * @param points Points to add
     * @param reason Reason for the update
     */
    function updateReputationScore(
        address user,
        uint256 points,
        string memory reason
    ) external onlyOwner {
        _updateReputationScore(user, points, reason);
    }
    
    /**
     * @dev Internal function to update reputation score
     * @param user User address
     * @param points Points to add
     * @param reason Reason for the update
     */
    function _updateReputationScore(
        address user,
        uint256 points,
        string memory reason
    ) internal {
        ReputationScore storage reputation = reputationScores[user];
        
        // Update specific score based on reason
        if (keccak256(bytes(reason)) == keccak256(bytes("Trading activity"))) {
            reputation.tradingScore = _min(
                reputation.tradingScore + points,
                MAX_REPUTATION_SCORE / 4
            );
        } else if (keccak256(bytes(reason)) == keccak256(bytes("Data contribution"))) {
            reputation.dataContributionScore = _min(
                reputation.dataContributionScore + points,
                MAX_REPUTATION_SCORE / 4
            );
        } else if (keccak256(bytes(reason)) == keccak256(bytes("Governance participation"))) {
            reputation.governanceScore = _min(
                reputation.governanceScore + points,
                MAX_REPUTATION_SCORE / 4
            );
        } else if (keccak256(bytes(reason)) == keccak256(bytes("Identity verification"))) {
            reputation.verificationScore = _min(
                reputation.verificationScore + points,
                MAX_REPUTATION_SCORE / 4
            );
        }
        
        // Update total score
        reputation.totalScore = reputation.tradingScore +
                               reputation.dataContributionScore +
                               reputation.governanceScore +
                               reputation.verificationScore;
        
        reputation.lastUpdated = block.timestamp;
        
        emit ReputationUpdated(user, reputation.totalScore, reason);
    }
    
    /**
     * @dev Batch update reputation scores for multiple users
     * @param users Array of user addresses
     * @param points Array of points to add
     * @param reason Reason for the updates
     */
    function batchUpdateReputationScores(
        address[] memory users,
        uint256[] memory points,
        string memory reason
    ) external onlyOwner {
        require(users.length == points.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < users.length; i++) {
            _updateReputationScore(users[i], points[i], reason);
        }
    }
    
    /**
     * @dev Get user's claimed campaigns
     * @param user User address
     * @return Array of claimed campaign IDs
     */
    function getUserClaimedCampaigns(address user) external view returns (uint256[] memory) {
        return userClaimedCampaigns[user];
    }
    
    /**
     * @dev Get campaign details
     * @param campaignId Campaign ID
     * @return Campaign details (excluding mappings)
     */
    function getCampaign(uint256 campaignId) external view returns (
        uint256 id,
        string memory name,
        string memory description,
        AirdropType airdropType,
        address tokenContract,
        uint256 tokenId,
        uint256 rewardAmount,
        uint256 totalSupply,
        uint256 claimed,
        uint256 startTime,
        uint256 endTime,
        bool isActive
    ) {
        AirdropCampaign storage campaign = campaigns[campaignId];
        return (
            campaign.id,
            campaign.name,
            campaign.description,
            campaign.airdropType,
            campaign.tokenContract,
            campaign.tokenId,
            campaign.rewardAmount,
            campaign.totalSupply,
            campaign.claimed,
            campaign.startTime,
            campaign.endTime,
            campaign.isActive
        );
    }
    
    /**
     * @dev Get user's reputation score
     * @param user User address
     * @return Reputation score details
     */
    function getUserReputation(address user) external view returns (
        uint256 tradingScore,
        uint256 dataContributionScore,
        uint256 governanceScore,
        uint256 verificationScore,
        uint256 totalScore,
        uint256 lastUpdated
    ) {
        ReputationScore memory reputation = reputationScores[user];
        return (
            reputation.tradingScore,
            reputation.dataContributionScore,
            reputation.governanceScore,
            reputation.verificationScore,
            reputation.totalScore,
            reputation.lastUpdated
        );
    }
    
    /**
     * @dev Pause/unpause a campaign
     * @param campaignId Campaign ID
     * @param active New active status
     */
    function setCampaignActive(uint256 campaignId, bool active) external onlyOwner {
        campaigns[campaignId].isActive = active;
    }
    
    /**
     * @dev Emergency withdraw tokens
     * @param token Token address
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }
    
    /**
     * @dev Get minimum of two numbers
     * @param a First number
     * @param b Second number
     * @return Minimum value
     */
    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
    
    /**
     * @dev Get active campaigns count
     * @return Number of active campaigns
     */
    function getActiveCampaignsCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < campaignCounter; i++) {
            if (campaigns[i].isActive && 
                block.timestamp >= campaigns[i].startTime && 
                block.timestamp <= campaigns[i].endTime) {
                count++;
            }
        }
        return count;
    }
    
    /**
     * @dev Check if user has claimed a specific campaign
     * @param user User address
     * @param campaignId Campaign ID
     * @return Whether user has claimed
     */
    function hasUserClaimed(address user, uint256 campaignId) external view returns (bool) {
        return campaigns[campaignId].hasClaimed[user];
    }
}
