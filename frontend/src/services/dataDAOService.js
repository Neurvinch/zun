import { ethers } from 'ethers';
import { lighthouse } from '@lighthouse-web3/sdk';
import { publicClientToProvider, walletClientToSigner } from '../utils/viem-ethers-adapter';

const DATADAO_ABI = [
    "function contributeData(string memory dataType, string memory dataHash) external",
    "function getContribution(uint256 contributionId) external view returns (address, string, string, uint256, uint256)",
    "function getUserContributions(address user) external view returns (uint256[])",
    "function createProposal(string memory title, string memory description) external",
    "function vote(uint256 proposalId, bool support) external",
    "function getProposal(uint256 proposalId) external view returns (address, string, string, uint256, uint256, uint256, bool)"
];

/**
 * DataDAO Frontend Service
 * Handles data contributions, rewards, and governance operations
 */
class DataDAOService {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.contract = null;
        this.initialized = false;
        this.contractAddress = import.meta.env.VITE_DATADAO_CONTRACT_ADDRESS;
        this.lighthouseApiKey = import.meta.env.VITE_LIGHTHOUSE_API_KEY;
    }
    
    /**
     * Initialize the DataDAO service
     */
    async initialize(publicClient, walletClient) {
        try {
            if (!publicClient || !walletClient) {
                throw new Error('Clients not provided');
            }
            this.provider = publicClientToProvider(publicClient);
            this.signer = walletClientToSigner(walletClient);

            if (!this.contractAddress) {
                throw new Error('DataDAO contract address not configured');
            }

            this.contract = new ethers.Contract(
                this.contractAddress,
                DATADAO_ABI,
                this.signer
            );

            this.initialized = true;
            console.log('DataDAO service initialized');
            return { success: true };
        } catch (error) {
            console.error('Failed to initialize DataDAO service:', error);
            return { success: false, error: error.message };
        }
    }
    
    
    /**
     * Submit data contribution
     */
    async contributeData(dataType, data, userAddress) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }
            
            // Upload data to Lighthouse
            const uploadResult = await this.uploadDataToLighthouse(data, dataType);
            
            if (!uploadResult.success) {
                throw new Error('Failed to upload data to IPFS');
            }
            
            // Create contribution record
            const contributionId = Date.now().toString();
            const contribution = {
                id: contributionId,
                contributor: userAddress,
                dataType,
                dataHash: uploadResult.hash,
                rewardAmount: this.calculateReward(dataType, data),
                timestamp: Date.now(),
                status: 'pending'
            };
            
            this.dataContributions.set(contributionId, contribution);
            
            // Update user stats
            this.updateUserStats(userAddress, contribution);
            
            return {
                success: true,
                contributionId,
                dataHash: uploadResult.hash,
                estimatedReward: contribution.rewardAmount
            };
            
        } catch (error) {
            console.error('Data contribution failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Upload data to Lighthouse IPFS
     */
    async uploadDataToLighthouse(data, dataType) {
        try {
            if (!this.lighthouseApiKey) {
                // Mock upload for demo
                return {
                    success: true,
                    hash: `Qm${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
                    mock: true
                };
            }
            
            const filename = `${dataType}_${Date.now()}.json`;
            const dataBlob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            
            const uploadResponse = await lighthouse.upload(dataBlob, this.lighthouseApiKey);
            
            return {
                success: true,
                hash: uploadResponse.data.Hash,
                filename
            };
            
        } catch (error) {
            console.error('Lighthouse upload failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Calculate reward based on data type and quality
     */
    calculateReward(dataType, data) {
        const baseRewards = {
            'price_feed': 5.0,
            'sentiment_data': 8.0,
            'market_analysis': 12.0,
            'defi_metrics': 10.0,
            'governance_data': 15.0
        };
        
        const baseReward = baseRewards[dataType] || 5.0;
        const qualityMultiplier = Math.random() * 0.5 + 0.75; // 0.75 to 1.25
        
        return (baseReward * qualityMultiplier).toFixed(2);
    }
    
    /**
     * Update user statistics
     */
    updateUserStats(userAddress, contribution) {
        let stats = this.userStats.get(userAddress) || {
            totalContributions: 0,
            totalRewards: '0',
            reputation: 50,
            dataQualityScore: 50
        };
        
        stats.totalContributions += 1;
        stats.totalRewards = (parseFloat(stats.totalRewards) + parseFloat(contribution.rewardAmount)).toFixed(2);
        stats.reputation = Math.min(100, stats.reputation + 2);
        stats.dataQualityScore = Math.min(100, stats.dataQualityScore + 1);
        
        this.userStats.set(userAddress, stats);
    }
    
    /**
     * Get user contributions
     */
    getUserContributions(userAddress) {
        const contributions = Array.from(this.dataContributions.values())
            .filter(c => c.contributor.toLowerCase() === userAddress.toLowerCase())
            .sort((a, b) => b.timestamp - a.timestamp);
            
        return {
            success: true,
            contributions,
            total: contributions.length
        };
    }
    
    /**
     * Get user statistics
     */
    getUserStats(userAddress) {
        const stats = this.userStats.get(userAddress) || {
            totalContributions: 0,
            totalRewards: '0',
            reputation: 50,
            dataQualityScore: 50
        };
        
        return {
            success: true,
            stats
        };
    }
    
    /**
     * Create governance proposal
     */
    async createProposal(title, description, userAddress) {
        try {
            const proposalId = Date.now().toString();
            const proposal = {
                id: proposalId,
                proposer: userAddress,
                title,
                description,
                votesFor: 0,
                votesAgainst: 0,
                status: 'active',
                createdAt: Date.now(),
                endTime: Date.now() + 604800000 // 7 days
            };
            
            this.proposals.set(proposalId, proposal);
            
            return {
                success: true,
                proposalId,
                proposal
            };
            
        } catch (error) {
            console.error('Proposal creation failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Vote on proposal
     */
    async voteOnProposal(proposalId, vote, userAddress) {
        try {
            const proposal = this.proposals.get(proposalId);
            
            if (!proposal) {
                throw new Error('Proposal not found');
            }
            
            if (proposal.status !== 'active') {
                throw new Error('Proposal is not active');
            }
            
            if (Date.now() > proposal.endTime) {
                throw new Error('Voting period has ended');
            }
            
            // Update vote counts
            if (vote === 'for') {
                proposal.votesFor += 1;
            } else {
                proposal.votesAgainst += 1;
            }
            
            this.proposals.set(proposalId, proposal);
            
            return {
                success: true,
                proposal
            };
            
        } catch (error) {
            console.error('Voting failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get all proposals
     */
    getAllProposals() {
        const proposals = Array.from(this.proposals.values())
            .sort((a, b) => b.createdAt - a.createdAt);
            
        return {
            success: true,
            proposals
        };
    }
    
    /**
     * Get DAO statistics
     */
    getDAOStats() {
        const totalContributions = this.dataContributions.size;
        const totalRewards = Array.from(this.dataContributions.values())
            .reduce((sum, c) => sum + parseFloat(c.rewardAmount), 0);
        const activeProposals = Array.from(this.proposals.values())
            .filter(p => p.status === 'active').length;
        const totalUsers = this.userStats.size;
        
        return {
            success: true,
            stats: {
                totalContributions,
                totalRewards: totalRewards.toFixed(2),
                activeProposals,
                totalUsers,
                averageReward: totalContributions > 0 ? (totalRewards / totalContributions).toFixed(2) : '0'
            }
        };
    }
    
    /**
     * Get recent activity
     */
    getRecentActivity(limit = 10) {
        const activities = [];
        
        // Add contributions
        Array.from(this.dataContributions.values()).forEach(c => {
            activities.push({
                type: 'contribution',
                timestamp: c.timestamp,
                data: c
            });
        });
        
        // Add proposals
        Array.from(this.proposals.values()).forEach(p => {
            activities.push({
                type: 'proposal',
                timestamp: p.createdAt,
                data: p
            });
        });
        
        // Sort by timestamp and limit
        const recentActivities = activities
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
            
        return {
            success: true,
            activities: recentActivities
        };
    }
}

export default new DataDAOService();
