// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title GasPoolDAO
 * @dev Decentralized gas pool for funding relayers and meta-transactions
 * Allows users to stake tokens, earn rewards, and participate in governance
 */
contract GasPoolDAO is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    
    // Staking token (DataCoin or ETH)
    IERC20 public immutable stakingToken;
    
    // Pool configuration
    struct PoolConfig {
        uint256 minimumStake;
        uint256 stakingRewardRate; // Annual percentage rate (APR)
        uint256 relayerRewardRate; // Percentage of gas costs covered
        uint256 governanceThreshold; // Minimum stake for governance participation
        uint256 proposalThreshold; // Minimum stake to create proposals
        bool isActive;
    }
    
    // Staker information
    struct StakerInfo {
        uint256 stakedAmount;
        uint256 rewardDebt;
        uint256 lastStakeTime;
        uint256 totalRewardsClaimed;
        bool isRelayer;
    }
    
    // Relayer information
    struct RelayerInfo {
        address relayerAddress;
        uint256 totalGasUsed;
        uint256 totalReimbursed;
        uint256 successfulTransactions;
        uint256 failedTransactions;
        bool isActive;
        uint256 registrationTime;
    }
    
    // Governance proposal
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
        ProposalType proposalType;
        bytes proposalData;
        mapping(address => bool) hasVoted;
        mapping(address => uint256) voteWeight;
    }
    
    enum ProposalType {
        CONFIG_UPDATE,
        RELAYER_REGISTRATION,
        EMERGENCY_PAUSE,
        FUND_ALLOCATION
    }
    
    // Storage
    PoolConfig public poolConfig;
    mapping(address => StakerInfo) public stakers;
    mapping(address => RelayerInfo) public relayers;
    mapping(uint256 => Proposal) public proposals;
    
    address[] public relayerList;
    address[] public stakerList;
    
    uint256 public totalStaked;
    uint256 public totalRewardsDistributed;
    uint256 public proposalCount;
    uint256 public accRewardPerShare;
    uint256 public lastRewardBlock;
    
    // Constants
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant REWARD_PRECISION = 1e12;
    uint256 public constant MAX_RELAYERS = 50;
    
    // Events
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RelayerRegistered(address indexed relayer);
    event RelayerDeactivated(address indexed relayer);
    event GasReimbursed(address indexed relayer, uint256 amount, bytes32 txHash);
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string title);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId, bool success);
    
    constructor(
        address _stakingToken,
        uint256 _minimumStake,
        uint256 _stakingRewardRate,
        uint256 _relayerRewardRate
    ) {
        stakingToken = IERC20(_stakingToken);
        
        poolConfig = PoolConfig({
            minimumStake: _minimumStake,
            stakingRewardRate: _stakingRewardRate,
            relayerRewardRate: _relayerRewardRate,
            governanceThreshold: _minimumStake.mul(10),
            proposalThreshold: _minimumStake.mul(100),
            isActive: true
        });
        
        lastRewardBlock = block.number;
    }
    
    /**
     * @dev Stake tokens to participate in the gas pool
     * @param amount Amount of tokens to stake
     */
    function stake(uint256 amount) external nonReentrant {
        require(poolConfig.isActive, "Pool is not active");
        require(amount >= poolConfig.minimumStake, "Amount below minimum stake");
        
        updatePool();
        
        StakerInfo storage staker = stakers[msg.sender];
        
        // Transfer tokens from user
        stakingToken.transferFrom(msg.sender, address(this), amount);
        
        // Calculate pending rewards
        if (staker.stakedAmount > 0) {
            uint256 pending = staker.stakedAmount.mul(accRewardPerShare).div(REWARD_PRECISION).sub(staker.rewardDebt);
            if (pending > 0) {
                staker.totalRewardsClaimed = staker.totalRewardsClaimed.add(pending);
                stakingToken.transfer(msg.sender, pending);
                emit RewardsClaimed(msg.sender, pending);
            }
        } else {
            // First time staker
            stakerList.push(msg.sender);
        }
        
        // Update staker info
        staker.stakedAmount = staker.stakedAmount.add(amount);
        staker.rewardDebt = staker.stakedAmount.mul(accRewardPerShare).div(REWARD_PRECISION);
        staker.lastStakeTime = block.timestamp;
        
        totalStaked = totalStaked.add(amount);
        
        emit Staked(msg.sender, amount);
    }
    
    /**
     * @dev Unstake tokens from the gas pool
     * @param amount Amount of tokens to unstake
     */
    function unstake(uint256 amount) external nonReentrant {
        StakerInfo storage staker = stakers[msg.sender];
        require(staker.stakedAmount >= amount, "Insufficient staked amount");
        
        updatePool();
        
        // Calculate pending rewards
        uint256 pending = staker.stakedAmount.mul(accRewardPerShare).div(REWARD_PRECISION).sub(staker.rewardDebt);
        if (pending > 0) {
            staker.totalRewardsClaimed = staker.totalRewardsClaimed.add(pending);
            stakingToken.transfer(msg.sender, pending);
            emit RewardsClaimed(msg.sender, pending);
        }
        
        // Update staker info
        staker.stakedAmount = staker.stakedAmount.sub(amount);
        staker.rewardDebt = staker.stakedAmount.mul(accRewardPerShare).div(REWARD_PRECISION);
        
        totalStaked = totalStaked.sub(amount);
        
        // Transfer tokens back to user
        stakingToken.transfer(msg.sender, amount);
        
        emit Unstaked(msg.sender, amount);
    }
    
    /**
     * @dev Claim pending staking rewards
     */
    function claimRewards() external nonReentrant {
        updatePool();
        
        StakerInfo storage staker = stakers[msg.sender];
        require(staker.stakedAmount > 0, "No staked amount");
        
        uint256 pending = staker.stakedAmount.mul(accRewardPerShare).div(REWARD_PRECISION).sub(staker.rewardDebt);
        require(pending > 0, "No pending rewards");
        
        staker.totalRewardsClaimed = staker.totalRewardsClaimed.add(pending);
        staker.rewardDebt = staker.stakedAmount.mul(accRewardPerShare).div(REWARD_PRECISION);
        
        stakingToken.transfer(msg.sender, pending);
        
        emit RewardsClaimed(msg.sender, pending);
    }
    
    /**
     * @dev Register as a relayer
     */
    function registerAsRelayer() external {
        require(stakers[msg.sender].stakedAmount >= poolConfig.governanceThreshold, "Insufficient stake for relayer");
        require(!relayers[msg.sender].isActive, "Already registered as relayer");
        require(relayerList.length < MAX_RELAYERS, "Maximum relayers reached");
        
        relayers[msg.sender] = RelayerInfo({
            relayerAddress: msg.sender,
            totalGasUsed: 0,
            totalReimbursed: 0,
            successfulTransactions: 0,
            failedTransactions: 0,
            isActive: true,
            registrationTime: block.timestamp
        });
        
        stakers[msg.sender].isRelayer = true;
        relayerList.push(msg.sender);
        
        emit RelayerRegistered(msg.sender);
    }
    
    /**
     * @dev Reimburse gas costs for a relayer
     * @param relayer Relayer address
     * @param gasUsed Amount of gas used
     * @param gasPrice Gas price used
     * @param txHash Transaction hash
     * @param success Whether the transaction was successful
     */
    function reimburseGas(
        address relayer,
        uint256 gasUsed,
        uint256 gasPrice,
        bytes32 txHash,
        bool success
    ) external onlyOwner {
        require(relayers[relayer].isActive, "Relayer not active");
        
        uint256 gasCost = gasUsed.mul(gasPrice);
        uint256 reimbursement = gasCost.mul(poolConfig.relayerRewardRate).div(100);
        
        // Update relayer stats
        RelayerInfo storage relayerInfo = relayers[relayer];
        relayerInfo.totalGasUsed = relayerInfo.totalGasUsed.add(gasUsed);
        relayerInfo.totalReimbursed = relayerInfo.totalReimbursed.add(reimbursement);
        
        if (success) {
            relayerInfo.successfulTransactions = relayerInfo.successfulTransactions.add(1);
        } else {
            relayerInfo.failedTransactions = relayerInfo.failedTransactions.add(1);
        }
        
        // Transfer reimbursement
        if (reimbursement > 0 && address(this).balance >= reimbursement) {
            payable(relayer).transfer(reimbursement);
        }
        
        emit GasReimbursed(relayer, reimbursement, txHash);
    }
    
    /**
     * @dev Create a governance proposal
     * @param title Proposal title
     * @param description Proposal description
     * @param proposalType Type of proposal
     * @param proposalData Encoded proposal data
     */
    function createProposal(
        string memory title,
        string memory description,
        ProposalType proposalType,
        bytes memory proposalData
    ) external {
        require(stakers[msg.sender].stakedAmount >= poolConfig.proposalThreshold, "Insufficient stake for proposal");
        
        uint256 proposalId = proposalCount++;
        Proposal storage proposal = proposals[proposalId];
        
        proposal.id = proposalId;
        proposal.proposer = msg.sender;
        proposal.title = title;
        proposal.description = description;
        proposal.startTime = block.timestamp;
        proposal.endTime = block.timestamp.add(VOTING_PERIOD);
        proposal.proposalType = proposalType;
        proposal.proposalData = proposalData;
        
        emit ProposalCreated(proposalId, msg.sender, title);
    }
    
    /**
     * @dev Vote on a governance proposal
     * @param proposalId Proposal ID
     * @param support True for yes, false for no
     */
    function vote(uint256 proposalId, bool support) external {
        require(proposalId < proposalCount, "Invalid proposal ID");
        require(stakers[msg.sender].stakedAmount >= poolConfig.governanceThreshold, "Insufficient stake for voting");
        
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp >= proposal.startTime, "Voting not started");
        require(block.timestamp <= proposal.endTime, "Voting ended");
        require(!proposal.hasVoted[msg.sender], "Already voted");
        
        uint256 weight = stakers[msg.sender].stakedAmount;
        proposal.hasVoted[msg.sender] = true;
        proposal.voteWeight[msg.sender] = weight;
        
        if (support) {
            proposal.forVotes = proposal.forVotes.add(weight);
        } else {
            proposal.againstVotes = proposal.againstVotes.add(weight);
        }
        
        emit VoteCast(proposalId, msg.sender, support, weight);
    }
    
    /**
     * @dev Execute a governance proposal
     * @param proposalId Proposal ID
     */
    function executeProposal(uint256 proposalId) external {
        require(proposalId < proposalCount, "Invalid proposal ID");
        
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp > proposal.endTime, "Voting still active");
        require(!proposal.executed, "Already executed");
        require(proposal.forVotes > proposal.againstVotes, "Proposal rejected");
        
        proposal.executed = true;
        
        bool success = _executeProposalLogic(proposal);
        
        emit ProposalExecuted(proposalId, success);
    }
    
    /**
     * @dev Internal function to execute proposal logic
     * @param proposal Proposal to execute
     * @return success Whether execution was successful
     */
    function _executeProposalLogic(Proposal storage proposal) internal returns (bool) {
        if (proposal.proposalType == ProposalType.CONFIG_UPDATE) {
            // Decode and update pool configuration
            (uint256 newMinStake, uint256 newStakingRate, uint256 newRelayerRate) = 
                abi.decode(proposal.proposalData, (uint256, uint256, uint256));
            
            poolConfig.minimumStake = newMinStake;
            poolConfig.stakingRewardRate = newStakingRate;
            poolConfig.relayerRewardRate = newRelayerRate;
            
            return true;
        } else if (proposal.proposalType == ProposalType.RELAYER_REGISTRATION) {
            // Handle relayer registration/deregistration
            (address relayerAddress, bool activate) = 
                abi.decode(proposal.proposalData, (address, bool));
            
            relayers[relayerAddress].isActive = activate;
            
            return true;
        } else if (proposal.proposalType == ProposalType.EMERGENCY_PAUSE) {
            // Emergency pause/unpause
            bool pause = abi.decode(proposal.proposalData, (bool));
            poolConfig.isActive = !pause;
            
            return true;
        }
        
        return false;
    }
    
    /**
     * @dev Update reward pool
     */
    function updatePool() public {
        if (block.number <= lastRewardBlock) {
            return;
        }
        
        if (totalStaked == 0) {
            lastRewardBlock = block.number;
            return;
        }
        
        uint256 blocksSinceLastReward = block.number.sub(lastRewardBlock);
        uint256 rewardPerBlock = poolConfig.stakingRewardRate.mul(totalStaked).div(365 days).div(100);
        uint256 reward = blocksSinceLastReward.mul(rewardPerBlock);
        
        accRewardPerShare = accRewardPerShare.add(reward.mul(REWARD_PRECISION).div(totalStaked));
        lastRewardBlock = block.number;
        totalRewardsDistributed = totalRewardsDistributed.add(reward);
    }
    
    /**
     * @dev Get pending rewards for a staker
     * @param staker Staker address
     * @return Pending reward amount
     */
    function getPendingRewards(address staker) external view returns (uint256) {
        StakerInfo memory stakerInfo = stakers[staker];
        if (stakerInfo.stakedAmount == 0) {
            return 0;
        }
        
        uint256 tempAccRewardPerShare = accRewardPerShare;
        if (block.number > lastRewardBlock && totalStaked != 0) {
            uint256 blocksSinceLastReward = block.number.sub(lastRewardBlock);
            uint256 rewardPerBlock = poolConfig.stakingRewardRate.mul(totalStaked).div(365 days).div(100);
            uint256 reward = blocksSinceLastReward.mul(rewardPerBlock);
            tempAccRewardPerShare = tempAccRewardPerShare.add(reward.mul(REWARD_PRECISION).div(totalStaked));
        }
        
        return stakerInfo.stakedAmount.mul(tempAccRewardPerShare).div(REWARD_PRECISION).sub(stakerInfo.rewardDebt);
    }
    
    /**
     * @dev Get relayer statistics
     * @param relayer Relayer address
     * @return Relayer information
     */
    function getRelayerStats(address relayer) external view returns (
        uint256 totalGasUsed,
        uint256 totalReimbursed,
        uint256 successfulTransactions,
        uint256 failedTransactions,
        bool isActive,
        uint256 successRate
    ) {
        RelayerInfo memory relayerInfo = relayers[relayer];
        uint256 totalTransactions = relayerInfo.successfulTransactions.add(relayerInfo.failedTransactions);
        uint256 rate = totalTransactions > 0 ? 
            relayerInfo.successfulTransactions.mul(100).div(totalTransactions) : 0;
        
        return (
            relayerInfo.totalGasUsed,
            relayerInfo.totalReimbursed,
            relayerInfo.successfulTransactions,
            relayerInfo.failedTransactions,
            relayerInfo.isActive,
            rate
        );
    }
    
    /**
     * @dev Get pool statistics
     * @return Pool statistics
     */
    function getPoolStats() external view returns (
        uint256 totalStakedAmount,
        uint256 totalStakers,
        uint256 totalRelayers,
        uint256 totalRewards,
        uint256 poolBalance
    ) {
        return (
            totalStaked,
            stakerList.length,
            relayerList.length,
            totalRewardsDistributed,
            address(this).balance
        );
    }
    
    /**
     * @dev Emergency withdraw (owner only)
     * @param token Token address (address(0) for ETH)
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            payable(owner()).transfer(amount);
        } else {
            IERC20(token).transfer(owner(), amount);
        }
    }
    
    /**
     * @dev Receive ETH for gas reimbursements
     */
    receive() external payable {}
}
