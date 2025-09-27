import { ethers } from 'ethers';
import { encrypt, decrypt } from 'crypto-js/aes';
import { enc } from 'crypto-js';
// Lazy-load lighthouse SDK within methods to avoid bundling Node polyfills in browser

/**
 * DataDAO Service
 * Handles data contributions, rewards, and governance for the DataDAO
 */
class DataDAOService {
    constructor() {
        this.dataDAOContract = null;
        this.dataCoinContract = null;
        this.provider = null;
        this.signer = null;
        this.contractAddresses = {
            dataDAO: import.meta.env.VITE_DATADAO_CONTRACT_ADDRESS,
            dataCoin: import.meta.env.VITE_DATACOIN_CONTRACT_ADDRESS
        };
        
        // Data type mappings
        this.dataTypes = {
            TRADING_DATA: 0,
            MARKET_SIGNALS: 1,
            RISK_METRICS: 2,
            COMPLIANCE_DATA: 3,
            ML_DATASET: 4
        };
        
        this.initialized = false;
    }
    
    /**
     * Initialize the DataDAO service
     * @param {Object} provider - Ethereum provider
     * @param {Object} signer - Ethereum signer
     */
    async initialize(provider, signer) {
        try {
            this.provider = provider;
            this.signer = signer;
            
            // Initialize contracts
            await this.initializeContracts();
            
            this.initialized = true;
            console.log('DataDAO service initialized successfully');
            
            return { success: true };
        } catch (error) {
            console.error('Failed to initialize DataDAO service:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Initialize smart contracts
     */
    async initializeContracts() {
        const dataDAOABI = [
            "function contributeData(string memory dataHash, uint8 dataType, bytes32 merkleRoot) external",
            "function claimRewards() external",
            "function stake(uint256 amount) external",
            "function unstake(uint256 amount) external",
            "function createProposal(string memory title, string memory description) external",
            "function vote(uint256 proposalId, bool support) external",
            "function getContributorStats(address contributor) external view returns (uint256, uint256, bool)",
            "function getProposal(uint256 proposalId) external view returns (uint256, address, string memory, string memory, uint256, uint256, uint256, uint256, bool)",
            "function totalContributions() external view returns (uint256)",
            "function proposalCount() external view returns (uint256)",
            "event DataContributed(uint256 indexed contributionId, address indexed contributor, string dataHash, uint8 dataType, uint256 rewardAmount)",
            "event RewardClaimed(address indexed contributor, uint256 amount)",
            "event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string title)",
            "event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight)"
        ];
        
        const dataCoinABI = [
            "function balanceOf(address account) external view returns (uint256)",
            "function transfer(address to, uint256 amount) external returns (bool)",
            "function approve(address spender, uint256 amount) external returns (bool)",
            "function allowance(address owner, address spender) external view returns (uint256)",
            "function getCurrentVotes(address account) external view returns (uint256)",
            "function delegate(address delegatee) external",
            "function totalSupply() external view returns (uint256)"
        ];
        
        this.dataDAOContract = new ethers.Contract(
            this.contractAddresses.dataDAO,
            dataDAOABI,
            this.signer
        );
        
        this.dataCoinContract = new ethers.Contract(
            this.contractAddresses.dataCoin,
            dataCoinABI,
            this.signer
        );
    }
    
    /**
     * Contribute anonymized data to the DAO
     * @param {Object} dataPayload - The data to contribute
     * @param {string} dataType - Type of data (TRADING_DATA, MARKET_SIGNALS, etc.)
     * @param {string} encryptionKey - Key for encrypting the data
     * @returns {Object} Contribution result
     */
    async contributeData(dataPayload, dataType, encryptionKey) {
        try {
            if (!this.initialized) {
                throw new Error('DataDAO service not initialized');
            }
            
            // 1. Anonymize and encrypt the data
            const anonymizedData = await this.anonymizeData(dataPayload);
            const encryptedData = this.encryptData(anonymizedData, encryptionKey);
            
            // 2. Upload to IPFS via Lighthouse
            const ipfsHash = await this.uploadToIPFS(encryptedData);
            
            // 3. Generate merkle proof for data integrity
            const merkleRoot = await this.generateMerkleRoot(encryptedData);
            
            // 4. Submit to DataDAO contract
            const dataTypeEnum = this.dataTypes[dataType];
            const tx = await this.dataDAOContract.contributeData(
                ipfsHash,
                dataTypeEnum,
                merkleRoot
            );
            
            const receipt = await tx.wait();
            
            // 5. Parse events for contribution details
            const contributionEvent = receipt.events?.find(
                event => event.event === 'DataContributed'
            );
            
            if (contributionEvent) {
                const { contributionId, rewardAmount } = contributionEvent.args;
                
                return {
                    success: true,
                    contributionId: contributionId.toString(),
                    ipfsHash,
                    rewardAmount: ethers.utils.formatEther(rewardAmount),
                    transactionHash: receipt.transactionHash
                };
            }
            
            throw new Error('Contribution event not found');
            
        } catch (error) {
            console.error('Failed to contribute data:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Anonymize sensitive data before contribution
     * @param {Object} data - Raw data to anonymize
     * @returns {Object} Anonymized data
     */
    async anonymizeData(data) {
        const anonymized = { ...data };
        
        // Remove or hash personally identifiable information
        if (anonymized.userAddress) {
            anonymized.userHash = ethers.utils.keccak256(
                ethers.utils.toUtf8Bytes(anonymized.userAddress)
            );
            delete anonymized.userAddress;
        }
        
        // Generalize timestamps to hour precision
        if (anonymized.timestamp) {
            const date = new Date(anonymized.timestamp);
            date.setMinutes(0, 0, 0);
            anonymized.timestamp = date.getTime();
        }
        
        // Round amounts to remove exact values
        if (anonymized.amount) {
            anonymized.amount = Math.round(anonymized.amount / 1000) * 1000;
        }
        
        // Add noise to prevent correlation attacks
        anonymized.nonce = Math.random().toString(36).substring(7);
        
        return anonymized;
    }
    
    /**
     * Encrypt data using AES-GCM
     * @param {Object} data - Data to encrypt
     * @param {string} key - Encryption key
     * @returns {string} Encrypted data
     */
    encryptData(data, key) {
        const dataString = JSON.stringify(data);
        const encrypted = encrypt(dataString, key);
        return encrypted.toString();
    }
    
    /**
     * Decrypt data using AES-GCM
     * @param {string} encryptedData - Encrypted data
     * @param {string} key - Decryption key
     * @returns {Object} Decrypted data
     */
    decryptData(encryptedData, key) {
        const decrypted = decrypt(encryptedData, key);
        return JSON.parse(decrypted.toString(enc.Utf8));
    }
    
    /**
     * Upload encrypted data to IPFS via Lighthouse
     * @param {string} encryptedData - Encrypted data to upload
     * @returns {string} IPFS hash
     */
    async uploadToIPFS(encryptedData) {
        try {
            const apiKey = import.meta.env.VITE_LIGHTHOUSE_API_KEY;
            const { lighthouse } = await import('@lighthouse-web3/sdk');
            
            // Create a blob from the encrypted data
            const blob = new Blob([encryptedData], { type: 'application/json' });
            const file = new File([blob], 'data.json', { type: 'application/json' });
            
            // Upload to Lighthouse
            const response = await lighthouse.upload([file], apiKey);
            
            if (response.data && response.data.Hash) {
                return response.data.Hash;
            }
            
            throw new Error('Failed to get IPFS hash from Lighthouse');
            
        } catch (error) {
            console.error('IPFS upload failed:', error);
            throw error;
        }
    }
    
    /**
     * Generate merkle root for data integrity
     * @param {string} data - Data to generate merkle root for
     * @returns {string} Merkle root
     */
    async generateMerkleRoot(data) {
        // Simple hash for now - in production, use proper merkle tree
        return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(data));
    }
    
    /**
     * Claim accumulated rewards
     * @returns {Object} Claim result
     */
    async claimRewards() {
        try {
            const tx = await this.dataDAOContract.claimRewards();
            const receipt = await tx.wait();
            
            const claimEvent = receipt.events?.find(
                event => event.event === 'RewardClaimed'
            );
            
            if (claimEvent) {
                const { amount } = claimEvent.args;
                return {
                    success: true,
                    amount: ethers.utils.formatEther(amount),
                    transactionHash: receipt.transactionHash
                };
            }
            
            return { success: true, transactionHash: receipt.transactionHash };
            
        } catch (error) {
            console.error('Failed to claim rewards:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Stake DataCoins for governance voting power
     * @param {string} amount - Amount to stake (in ether units)
     * @returns {Object} Staking result
     */
    async stakeTokens(amount) {
        try {
            const amountWei = ethers.utils.parseEther(amount);
            
            // First approve the DataDAO contract to spend tokens
            const approveTx = await this.dataCoinContract.approve(
                this.contractAddresses.dataDAO,
                amountWei
            );
            await approveTx.wait();
            
            // Then stake the tokens
            const stakeTx = await this.dataDAOContract.stake(amountWei);
            const receipt = await stakeTx.wait();
            
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
     * Unstake DataCoins
     * @param {string} amount - Amount to unstake (in ether units)
     * @returns {Object} Unstaking result
     */
    async unstakeTokens(amount) {
        try {
            const amountWei = ethers.utils.parseEther(amount);
            const tx = await this.dataDAOContract.unstake(amountWei);
            const receipt = await tx.wait();
            
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
     * Create a governance proposal
     * @param {string} title - Proposal title
     * @param {string} description - Proposal description
     * @returns {Object} Proposal creation result
     */
    async createProposal(title, description) {
        try {
            const tx = await this.dataDAOContract.createProposal(title, description);
            const receipt = await tx.wait();
            
            const proposalEvent = receipt.events?.find(
                event => event.event === 'ProposalCreated'
            );
            
            if (proposalEvent) {
                const { proposalId } = proposalEvent.args;
                return {
                    success: true,
                    proposalId: proposalId.toString(),
                    transactionHash: receipt.transactionHash
                };
            }
            
            return { success: true, transactionHash: receipt.transactionHash };
            
        } catch (error) {
            console.error('Failed to create proposal:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Vote on a governance proposal
     * @param {string} proposalId - ID of the proposal to vote on
     * @param {boolean} support - True for yes, false for no
     * @returns {Object} Voting result
     */
    async voteOnProposal(proposalId, support) {
        try {
            const tx = await this.dataDAOContract.vote(proposalId, support);
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
     * Get contributor statistics
     * @param {string} address - Contributor address
     * @returns {Object} Contributor stats
     */
    async getContributorStats(address) {
        try {
            const [totalRewards, stakedAmount, isVerified] = 
                await this.dataDAOContract.getContributorStats(address);
            
            const dataCoinBalance = await this.dataCoinContract.balanceOf(address);
            const votingPower = await this.dataCoinContract.getCurrentVotes(address);
            
            return {
                success: true,
                stats: {
                    totalRewards: ethers.utils.formatEther(totalRewards),
                    stakedAmount: ethers.utils.formatEther(stakedAmount),
                    dataCoinBalance: ethers.utils.formatEther(dataCoinBalance),
                    votingPower: ethers.utils.formatEther(votingPower),
                    isVerified
                }
            };
            
        } catch (error) {
            console.error('Failed to get contributor stats:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get proposal details
     * @param {string} proposalId - ID of the proposal
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
                executed
            ] = await this.dataDAOContract.getProposal(proposalId);
            
            return {
                success: true,
                proposal: {
                    id: id.toString(),
                    proposer,
                    title,
                    description,
                    startTime: new Date(startTime.toNumber() * 1000),
                    endTime: new Date(endTime.toNumber() * 1000),
                    forVotes: ethers.utils.formatEther(forVotes),
                    againstVotes: ethers.utils.formatEther(againstVotes),
                    executed,
                    isActive: Date.now() < endTime.toNumber() * 1000
                }
            };
            
        } catch (error) {
            console.error('Failed to get proposal:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get all proposals
     * @returns {Object} All proposals
     */
    async getAllProposals() {
        try {
            const proposalCount = await this.dataDAOContract.proposalCount();
            const proposals = [];
            
            for (let i = 0; i < proposalCount.toNumber(); i++) {
                const proposalResult = await this.getProposal(i);
                if (proposalResult.success) {
                    proposals.push(proposalResult.proposal);
                }
            }
            
            return { success: true, proposals };
            
        } catch (error) {
            console.error('Failed to get all proposals:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get DAO statistics
     * @returns {Object} DAO statistics
     */
    async getDAOStats() {
        try {
            const totalContributions = await this.dataDAOContract.totalContributions();
            const proposalCount = await this.dataDAOContract.proposalCount();
            const totalSupply = await this.dataCoinContract.totalSupply();
            
            return {
                success: true,
                stats: {
                    totalContributions: totalContributions.toString(),
                    totalProposals: proposalCount.toString(),
                    totalDataCoins: ethers.utils.formatEther(totalSupply)
                }
            };
            
        } catch (error) {
            console.error('Failed to get DAO stats:', error);
            return { success: false, error: error.message };
        }
    }
}

export default DataDAOService;

