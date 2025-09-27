import { ethers } from 'ethers';

/**
 * Gas Pool DAO Service
 * Manages staking, relayer operations, and governance for the gas pool
 */
class GasPoolDAOService {
    constructor() {
        this.contract = null;
        this.provider = null;
        this.signer = null;
        this.contractAddress = import.meta.env.VITE_GAS_POOL_DAO_CONTRACT_ADDRESS;
        this.stakingTokenAddress = import.meta.env.VITE_STAKING_TOKEN_CONTRACT_ADDRESS;
        this.initialized = false;
        
        // Proposal types
        this.proposalTypes = {
            CONFIG_UPDATE: 0,
            RELAYER_REGISTRATION: 1,
            EMERGENCY_PAUSE: 2,
            FUND_ALLOCATION: 3
        };
        
        // Cache for gas estimates and stats
        this.cache = new Map();
        this.cacheTimeout = 2 * 60 * 1000; // 2 minutes
    }
    
    /**
     * Initialize the gas pool DAO service
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
            console.log('Gas Pool DAO service initialized successfully');
            
            return { success: true };
        } catch (error) {
            console.error('Failed to initialize Gas Pool DAO service:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Initialize smart contract
     */
    async initializeContract() {
        const contractABI = [
            "function stake(uint256 amount) external",
            "function unstake(uint256 amount) external",
            "function claimRewards() external",
            "function registerAsRelayer() external",
            "function createProposal(string memory title, string memory description, uint8 proposalType, bytes memory proposalData) external",
            "function vote(uint256 proposalId, bool support) external",
            "function executeProposal(uint256 proposalId) external",
            "function getPendingRewards(address staker) external view returns (uint256)",
            "function getRelayerStats(address relayer) external view returns (uint256, uint256, uint256, uint256, bool, uint256)",
            "function getPoolStats() external view returns (uint256, uint256, uint256, uint256, uint256)",
            "function stakers(address) external view returns (uint256, uint256, uint256, uint256, bool)",
            "function relayers(address) external view returns (address, uint256, uint256, uint256, uint256, bool, uint256)",
            "function proposals(uint256) external view returns (uint256, address, string memory, string memory, uint256, uint256, uint256, uint256, bool, uint8, bytes memory)",
            "function poolConfig() external view returns (uint256, uint256, uint256, uint256, uint256, bool)",
            "function totalStaked() external view returns (uint256)",
            "function proposalCount() external view returns (uint256)",
            "event Staked(address indexed user, uint256 amount)",
            "event Unstaked(address indexed user, uint256 amount)",
            "event RewardsClaimed(address indexed user, uint256 amount)",
            "event RelayerRegistered(address indexed relayer)",
            "event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string title)",
            "event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight)"
        ];
        
        this.contract = new ethers.Contract(
            this.contractAddress,
            contractABI,
            this.signer
        );
        
        // Initialize staking token contract
        const tokenABI = [
            "function approve(address spender, uint256 amount) external returns (bool)",
            "function balanceOf(address account) external view returns (uint256)",
            "function allowance(address owner, address spender) external view returns (uint256)"
        ];
        
        this.stakingTokenContract = new ethers.Contract(
            this.stakingTokenAddress,
            tokenABI,
            this.signer
        );
    }
    
    /**
     * Stake tokens in the gas pool
     * @param {string} amount - Amount to stake (in ether units)
     * @returns {Object} Staking result
     */
    async stake(amount) {
        try {
            if (!this.initialized) {
                throw new Error('Gas Pool DAO service not initialized');
            }
            
            const amountWei = ethers.utils.parseEther(amount);
            const userAddress = await this.signer.getAddress();
            
            // Check token balance
            const balance = await this.stakingTokenContract.balanceOf(userAddress);
            if (balance.lt(amountWei)) {
                throw new Error('Insufficient token balance');
            }
            
            // Check allowance
            const allowance = await this.stakingTokenContract.allowance(userAddress, this.contractAddress);
            if (allowance.lt(amountWei)) {
                // Approve tokens
                const approveTx = await this.stakingTokenContract.approve(this.contractAddress, amountWei);
                await approveTx.wait();
            }
            
            // Stake tokens
            const tx = await this.contract.stake(amountWei);
            const receipt = await tx.wait();
            
            // Clear cache
            this.clearUserCache(userAddress);
            
            return {
                success: true,
                amount,
                transactionHash: receipt.transactionHash
            };
            
        } catch (error) {
            console.error('Failed to stake tokens:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Unstake tokens from the gas pool
     * @param {string} amount - Amount to unstake (in ether units)
     * @returns {Object} Unstaking result
     */
    async unstake(amount) {
        try {
            if (!this.initialized) {
                throw new Error('Gas Pool DAO service not initialized');
            }
            
            const amountWei = ethers.utils.parseEther(amount);
            const tx = await this.contract.unstake(amountWei);
            const receipt = await tx.wait();
            
            // Clear cache
            const userAddress = await this.signer.getAddress();
            this.clearUserCache(userAddress);
            
            return {
                success: true,
                amount,
                transactionHash: receipt.transactionHash
            };
            
        } catch (error) {
            console.error('Failed to unstake tokens:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Claim staking rewards
     * @returns {Object} Claim result
     */
    async claimRewards() {
        try {
            if (!this.initialized) {
                throw new Error('Gas Pool DAO service not initialized');
            }
            
            const tx = await this.contract.claimRewards();
            const receipt = await tx.wait();
            
            // Parse reward claimed event
            const rewardEvent = receipt.events?.find(
                event => event.event === 'RewardsClaimed'
            );
            
            let claimedAmount = '0';
            if (rewardEvent) {
                claimedAmount = ethers.utils.formatEther(rewardEvent.args.amount);
            }
            
            // Clear cache
            const userAddress = await this.signer.getAddress();
            this.clearUserCache(userAddress);
            
            return {
                success: true,
                amount: claimedAmount,
                transactionHash: receipt.transactionHash
            };
            
        } catch (error) {
            console.error('Failed to claim rewards:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Register as a relayer
     * @returns {Object} Registration result
     */
    async registerAsRelayer() {
        try {
            if (!this.initialized) {
                throw new Error('Gas Pool DAO service not initialized');
            }
            
            const tx = await this.contract.registerAsRelayer();
            const receipt = await tx.wait();
            
            // Clear cache
            const userAddress = await this.signer.getAddress();
            this.clearUserCache(userAddress);
            
            return {
                success: true,
                transactionHash: receipt.transactionHash
            };
            
        } catch (error) {
            console.error('Failed to register as relayer:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Create a governance proposal
     * @param {Object} proposalData - Proposal data
     * @returns {Object} Proposal creation result
     */
    async createProposal(proposalData) {
        try {
            if (!this.initialized) {
                throw new Error('Gas Pool DAO service not initialized');
            }
            
            const { title, description, type, data } = proposalData;
            
            // Encode proposal data based on type
            let encodedData = '0x';
            if (type === 'CONFIG_UPDATE') {
                encodedData = ethers.utils.defaultAbiCoder.encode(
                    ['uint256', 'uint256', 'uint256'],
                    [data.minimumStake, data.stakingRewardRate, data.relayerRewardRate]
                );
            } else if (type === 'RELAYER_REGISTRATION') {
                encodedData = ethers.utils.defaultAbiCoder.encode(
                    ['address', 'bool'],
                    [data.relayerAddress, data.activate]
                );
            } else if (type === 'EMERGENCY_PAUSE') {
                encodedData = ethers.utils.defaultAbiCoder.encode(
                    ['bool'],
                    [data.pause]
                );
            }
            
            const tx = await this.contract.createProposal(
                title,
                description,
                this.proposalTypes[type],
                encodedData
            );
            
            const receipt = await tx.wait();
            
            // Parse proposal created event
            const proposalEvent = receipt.events?.find(
                event => event.event === 'ProposalCreated'
            );
            
            let proposalId = '0';
            if (proposalEvent) {
                proposalId = proposalEvent.args.proposalId.toString();
            }
            
            return {
                success: true,
                proposalId,
                transactionHash: receipt.transactionHash
            };
            
        } catch (error) {
            console.error('Failed to create proposal:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Vote on a governance proposal
     * @param {string} proposalId - Proposal ID
     * @param {boolean} support - Vote support (true/false)
     * @returns {Object} Voting result
     */
    async vote(proposalId, support) {
        try {
            if (!this.initialized) {
                throw new Error('Gas Pool DAO service not initialized');
            }
            
            const tx = await this.contract.vote(proposalId, support);
            const receipt = await tx.wait();
            
            return {
                success: true,
                proposalId,
                support,
                transactionHash: receipt.transactionHash
            };
            
        } catch (error) {
            console.error('Failed to vote on proposal:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Execute a governance proposal
     * @param {string} proposalId - Proposal ID
     * @returns {Object} Execution result
     */
    async executeProposal(proposalId) {
        try {
            if (!this.initialized) {
                throw new Error('Gas Pool DAO service not initialized');
            }
            
            const tx = await this.contract.executeProposal(proposalId);
            const receipt = await tx.wait();
            
            return {
                success: true,
                proposalId,
                transactionHash: receipt.transactionHash
            };
            
        } catch (error) {
            console.error('Failed to execute proposal:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get user staking information
     * @param {string} userAddress - User address
     * @returns {Object} Staking information
     */
    async getUserStakingInfo(userAddress) {
        try {
            const cacheKey = `staking_${userAddress}`;
            
            // Check cache
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return { success: true, ...cached.data };
                }
            }
            
            const [stakedAmount, rewardDebt, lastStakeTime, totalRewardsClaimed, isRelayer] = 
                await this.contract.stakers(userAddress);
            
            const pendingRewards = await this.contract.getPendingRewards(userAddress);
            const tokenBalance = await this.stakingTokenContract.balanceOf(userAddress);
            
            const result = {
                stakedAmount: ethers.utils.formatEther(stakedAmount),
                pendingRewards: ethers.utils.formatEther(pendingRewards),
                totalRewardsClaimed: ethers.utils.formatEther(totalRewardsClaimed),
                tokenBalance: ethers.utils.formatEther(tokenBalance),
                lastStakeTime: new Date(lastStakeTime.toNumber() * 1000),
                isRelayer
            };
            
            // Cache result
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });
            
            return { success: true, ...result };
            
        } catch (error) {
            console.error('Failed to get user staking info:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get relayer statistics
     * @param {string} relayerAddress - Relayer address
     * @returns {Object} Relayer statistics
     */
    async getRelayerStats(relayerAddress) {
        try {
            const cacheKey = `relayer_${relayerAddress}`;
            
            // Check cache
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return { success: true, ...cached.data };
                }
            }
            
            const [totalGasUsed, totalReimbursed, successfulTxs, failedTxs, isActive, successRate] = 
                await this.contract.getRelayerStats(relayerAddress);
            
            const result = {
                totalGasUsed: totalGasUsed.toString(),
                totalReimbursed: ethers.utils.formatEther(totalReimbursed),
                successfulTransactions: successfulTxs.toNumber(),
                failedTransactions: failedTxs.toNumber(),
                totalTransactions: successfulTxs.toNumber() + failedTxs.toNumber(),
                successRate: successRate.toNumber(),
                isActive
            };
            
            // Cache result
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });
            
            return { success: true, ...result };
            
        } catch (error) {
            console.error('Failed to get relayer stats:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get pool statistics
     * @returns {Object} Pool statistics
     */
    async getPoolStats() {
        try {
            const cacheKey = 'pool_stats';
            
            // Check cache
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return { success: true, ...cached.data };
                }
            }
            
            const [totalStakedAmount, totalStakers, totalRelayers, totalRewards, poolBalance] = 
                await this.contract.getPoolStats();
            
            const poolConfig = await this.contract.poolConfig();
            
            const result = {
                totalStaked: ethers.utils.formatEther(totalStakedAmount),
                totalStakers: totalStakers.toNumber(),
                totalRelayers: totalRelayers.toNumber(),
                totalRewardsDistributed: ethers.utils.formatEther(totalRewards),
                poolBalance: ethers.utils.formatEther(poolBalance),
                config: {
                    minimumStake: ethers.utils.formatEther(poolConfig[0]),
                    stakingRewardRate: poolConfig[1].toNumber(),
                    relayerRewardRate: poolConfig[2].toNumber(),
                    governanceThreshold: ethers.utils.formatEther(poolConfig[3]),
                    proposalThreshold: ethers.utils.formatEther(poolConfig[4]),
                    isActive: poolConfig[5]
                }
            };
            
            // Cache result
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });
            
            return { success: true, ...result };
            
        } catch (error) {
            console.error('Failed to get pool stats:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get all proposals
     * @returns {Object} All proposals
     */
    async getAllProposals() {
        try {
            const proposalCount = await this.contract.proposalCount();
            const proposals = [];
            
            for (let i = 0; i < proposalCount.toNumber(); i++) {
                const proposal = await this.getProposal(i.toString());
                if (proposal.success) {
                    proposals.push(proposal.proposal);
                }
            }
            
            return { success: true, proposals };
            
        } catch (error) {
            console.error('Failed to get all proposals:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get proposal details
     * @param {string} proposalId - Proposal ID
     * @returns {Object} Proposal details
     */
    async getProposal(proposalId) {
        try {
            const [
                id,
                proposer,
                title,
                description,
                startTime,
                endTime,
                forVotes,
                againstVotes,
                executed,
                proposalType,
                proposalData
            ] = await this.contract.proposals(proposalId);
            
            const proposal = {
                id: id.toString(),
                proposer,
                title,
                description,
                startTime: new Date(startTime.toNumber() * 1000),
                endTime: new Date(endTime.toNumber() * 1000),
                forVotes: ethers.utils.formatEther(forVotes),
                againstVotes: ethers.utils.formatEther(againstVotes),
                executed,
                proposalType: Object.keys(this.proposalTypes)[proposalType],
                proposalData,
                isActive: Date.now() < endTime.toNumber() * 1000,
                totalVotes: ethers.utils.formatEther(forVotes.add(againstVotes)),
                supportPercentage: forVotes.add(againstVotes).gt(0) ? 
                    forVotes.mul(100).div(forVotes.add(againstVotes)).toNumber() : 0
            };
            
            return { success: true, proposal };
            
        } catch (error) {
            console.error('Failed to get proposal:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Estimate gas costs for a transaction
     * @param {string} to - Transaction recipient
     * @param {string} data - Transaction data
     * @param {string} value - Transaction value
     * @returns {Object} Gas estimation
     */
    async estimateGasCosts(to, data = '0x', value = '0') {
        try {
            const gasLimit = await this.provider.estimateGas({
                to,
                data,
                value: ethers.utils.parseEther(value)
            });
            
            const gasPrice = await this.provider.getGasPrice();
            const gasCost = gasLimit.mul(gasPrice);
            
            // Get pool config for reimbursement calculation
            const poolStats = await this.getPoolStats();
            const reimbursementRate = poolStats.config?.relayerRewardRate || 0;
            const reimbursement = gasCost.mul(reimbursementRate).div(100);
            
            return {
                success: true,
                gasLimit: gasLimit.toString(),
                gasPrice: ethers.utils.formatUnits(gasPrice, 'gwei'),
                gasCost: ethers.utils.formatEther(gasCost),
                reimbursement: ethers.utils.formatEther(reimbursement),
                reimbursementRate
            };
            
        } catch (error) {
            console.error('Failed to estimate gas costs:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Clear user-specific cache
     * @param {string} userAddress - User address
     */
    clearUserCache(userAddress) {
        const keysToDelete = [];
        for (const key of this.cache.keys()) {
            if (key.includes(userAddress.toLowerCase())) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.cache.delete(key));
        
        // Also clear pool stats cache as it might be affected
        this.cache.delete('pool_stats');
    }
    
    /**
     * Clear all cache
     */
    clearCache() {
        this.cache.clear();
    }
    
    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            timeout: this.cacheTimeout
        };
    }
}

export default GasPoolDAOService;
