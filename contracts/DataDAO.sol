// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title DataDAO
 * @dev Decentralized Autonomous Organization for data sharing and governance
 * Manages DataCoin rewards, governance voting, and data contribution tracking
 */
contract DataDAO is Ownable, ReentrancyGuard {
    
    // DataCoin ERC20 token for rewards
    IERC20 public immutable dataCoin;
    
    // Governance parameters
    uint256 public proposalCount;
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant MIN_PROPOSAL_STAKE = 1000 * 10**18; // 1000 DataCoins
    
    // Data contribution tracking
    struct DataContribution {
        address contributor;
        string dataHash; // IPFS hash of anonymized data
        uint256 timestamp;
        uint256 rewardAmount;
        bool verified;
        DataType dataType;
    }
    
    enum DataType {
        TRADING_DATA,
        MARKET_SIGNALS,
        RISK_METRICS,
        COMPLIANCE_DATA,
        ML_DATASET
    }
    
    // Governance proposals
    struct Proposal {
        uint256 id;
        address proposer;
        string title;
        string description;
        uint256 startTime;
        uint256 endTime;
        uint256 forVotes;
        uint256 againstVotes;
        bool executed;
        mapping(address => bool) hasVoted;
        mapping(address => uint256) voteWeight;
    }
    
    // Data quality scoring
    struct QualityScore {
        uint256 accuracy;
        uint256 completeness;
        uint256 timeliness;
        uint256 uniqueness;
        uint256 totalScore;
    }
    
    // Storage
    mapping(uint256 => DataContribution) public dataContributions;
    mapping(address => uint256) public contributorRewards;
    mapping(address => uint256) public stakingBalance;
    mapping(uint256 => Proposal) public proposals;
    mapping(string => QualityScore) public dataQualityScores;
    mapping(address => bool) public verifiedContributors;
    
    uint256 public totalContributions;
    uint256 public totalRewardsDistributed;
    
    // Events
    event DataContributed(
        uint256 indexed contributionId,
        address indexed contributor,
        string dataHash,
        DataType dataType,
        uint256 rewardAmount
    );
    
    event RewardClaimed(
        address indexed contributor,
        uint256 amount
    );
    
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string title
    );
    
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 weight
    );
    
    event ProposalExecuted(
        uint256 indexed proposalId,
        bool success
    );
    
    constructor(address _dataCoin) {
        dataCoin = IERC20(_dataCoin);
    }
    
    /**
     * @dev Submit anonymized data contribution
     * @param dataHash IPFS hash of the encrypted data
     * @param dataType Type of data being contributed
     * @param merkleRoot Merkle root for data integrity proof
     */
    function contributeData(
        string memory dataHash,
        DataType dataType,
        bytes32 merkleRoot
    ) external nonReentrant {
        require(bytes(dataHash).length > 0, "Invalid data hash");
        require(verifiedContributors[msg.sender], "Contributor not verified");
        
        uint256 contributionId = totalContributions++;
        uint256 rewardAmount = calculateReward(dataType, msg.sender);
        
        dataContributions[contributionId] = DataContribution({
            contributor: msg.sender,
            dataHash: dataHash,
            timestamp: block.timestamp,
            rewardAmount: rewardAmount,
            verified: false,
            dataType: dataType
        });
        
        contributorRewards[msg.sender] += rewardAmount;
        
        emit DataContributed(
            contributionId,
            msg.sender,
            dataHash,
            dataType,
            rewardAmount
        );
    }
    
    /**
     * @dev Verify data contribution quality
     * @param contributionId ID of the contribution to verify
     * @param qualityScore Quality metrics for the data
     */
    function verifyDataQuality(
        uint256 contributionId,
        QualityScore memory qualityScore
    ) external onlyOwner {
        require(contributionId < totalContributions, "Invalid contribution ID");
        
        DataContribution storage contribution = dataContributions[contributionId];
        require(!contribution.verified, "Already verified");
        
        contribution.verified = true;
        dataQualityScores[contribution.dataHash] = qualityScore;
        
        // Adjust reward based on quality score
        uint256 adjustedReward = (contribution.rewardAmount * qualityScore.totalScore) / 100;
        contributorRewards[contribution.contributor] = 
            contributorRewards[contribution.contributor] - contribution.rewardAmount + adjustedReward;
        
        contribution.rewardAmount = adjustedReward;
    }
    
    /**
     * @dev Claim accumulated rewards
     */
    function claimRewards() external nonReentrant {
        uint256 amount = contributorRewards[msg.sender];
        require(amount > 0, "No rewards to claim");
        
        contributorRewards[msg.sender] = 0;
        totalRewardsDistributed += amount;
        
        require(dataCoin.transfer(msg.sender, amount), "Transfer failed");
        
        emit RewardClaimed(msg.sender, amount);
    }
    
    /**
     * @dev Stake DataCoins for governance voting power
     * @param amount Amount of DataCoins to stake
     */
    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(dataCoin.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        stakingBalance[msg.sender] += amount;
    }
    
    /**
     * @dev Unstake DataCoins
     * @param amount Amount of DataCoins to unstake
     */
    function unstake(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(stakingBalance[msg.sender] >= amount, "Insufficient staked balance");
        
        stakingBalance[msg.sender] -= amount;
        require(dataCoin.transfer(msg.sender, amount), "Transfer failed");
    }
    
    /**
     * @dev Create governance proposal
     * @param title Proposal title
     * @param description Proposal description
     */
    function createProposal(
        string memory title,
        string memory description
    ) external {
        require(stakingBalance[msg.sender] >= MIN_PROPOSAL_STAKE, "Insufficient stake for proposal");
        require(bytes(title).length > 0, "Title cannot be empty");
        
        uint256 proposalId = proposalCount++;
        Proposal storage proposal = proposals[proposalId];
        
        proposal.id = proposalId;
        proposal.proposer = msg.sender;
        proposal.title = title;
        proposal.description = description;
        proposal.startTime = block.timestamp;
        proposal.endTime = block.timestamp + VOTING_PERIOD;
        
        emit ProposalCreated(proposalId, msg.sender, title);
    }
    
    /**
     * @dev Vote on governance proposal
     * @param proposalId ID of the proposal to vote on
     * @param support True for yes, false for no
     */
    function vote(uint256 proposalId, bool support) external {
        require(proposalId < proposalCount, "Invalid proposal ID");
        
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp >= proposal.startTime, "Voting not started");
        require(block.timestamp <= proposal.endTime, "Voting ended");
        require(!proposal.hasVoted[msg.sender], "Already voted");
        
        uint256 weight = stakingBalance[msg.sender];
        require(weight > 0, "No voting power");
        
        proposal.hasVoted[msg.sender] = true;
        proposal.voteWeight[msg.sender] = weight;
        
        if (support) {
            proposal.forVotes += weight;
        } else {
            proposal.againstVotes += weight;
        }
        
        emit VoteCast(proposalId, msg.sender, support, weight);
    }
    
    /**
     * @dev Execute governance proposal
     * @param proposalId ID of the proposal to execute
     */
    function executeProposal(uint256 proposalId) external {
        require(proposalId < proposalCount, "Invalid proposal ID");
        
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp > proposal.endTime, "Voting still active");
        require(!proposal.executed, "Already executed");
        require(proposal.forVotes > proposal.againstVotes, "Proposal rejected");
        
        proposal.executed = true;
        
        // Execute proposal logic here
        // This would typically call other contract functions or update parameters
        
        emit ProposalExecuted(proposalId, true);
    }
    
    /**
     * @dev Calculate reward amount based on data type and contributor history
     * @param dataType Type of data being contributed
     * @param contributor Address of the contributor
     * @return Reward amount in DataCoins
     */
    function calculateReward(DataType dataType, address contributor) internal view returns (uint256) {
        uint256 baseReward;
        
        // Base rewards by data type
        if (dataType == DataType.TRADING_DATA) {
            baseReward = 100 * 10**18; // 100 DataCoins
        } else if (dataType == DataType.MARKET_SIGNALS) {
            baseReward = 150 * 10**18; // 150 DataCoins
        } else if (dataType == DataType.RISK_METRICS) {
            baseReward = 120 * 10**18; // 120 DataCoins
        } else if (dataType == DataType.COMPLIANCE_DATA) {
            baseReward = 200 * 10**18; // 200 DataCoins
        } else if (dataType == DataType.ML_DATASET) {
            baseReward = 300 * 10**18; // 300 DataCoins
        }
        
        // Bonus for verified contributors
        if (verifiedContributors[contributor]) {
            baseReward = (baseReward * 120) / 100; // 20% bonus
        }
        
        return baseReward;
    }
    
    /**
     * @dev Verify contributor (only owner)
     * @param contributor Address to verify
     */
    function verifyContributor(address contributor) external onlyOwner {
        verifiedContributors[contributor] = true;
    }
    
    /**
     * @dev Get proposal details
     * @param proposalId ID of the proposal
     * @return Proposal details
     */
    function getProposal(uint256 proposalId) external view returns (
        uint256 id,
        address proposer,
        string memory title,
        string memory description,
        uint256 startTime,
        uint256 endTime,
        uint256 forVotes,
        uint256 againstVotes,
        bool executed
    ) {
        require(proposalId < proposalCount, "Invalid proposal ID");
        
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.id,
            proposal.proposer,
            proposal.title,
            proposal.description,
            proposal.startTime,
            proposal.endTime,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.executed
        );
    }
    
    /**
     * @dev Get contributor statistics
     * @param contributor Address of the contributor
     * @return Total rewards, staking balance, verification status
     */
    function getContributorStats(address contributor) external view returns (
        uint256 totalRewards,
        uint256 stakedAmount,
        bool isVerified
    ) {
        return (
            contributorRewards[contributor],
            stakingBalance[contributor],
            verifiedContributors[contributor]
        );
    }
}
