import { ethers } from 'ethers';
import { lighthouse } from '@lighthouse-web3/sdk';
import { publicClientToProvider, walletClientToSigner } from '../utils/viem-ethers-adapter';

const DATADAO_ABI = [
    "function contributeData(string memory dataType, string memory dataHash) external",
    "function getContribution(uint256 contributionId) external view returns (address, string, string, uint256, uint256)",
    "function getUserContributions(address user) external view returns (uint256[])",
    "function createProposal(string memory title, string memory description) external",
    "function vote(uint256 proposalId, bool support) external",
    "function getProposal(uint256 proposalId) external view returns (address, string, string, uint256, uint256, uint256, bool)",
    "function proposalCount() external view returns (uint256)"
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
    async contributeData(dataType, data) {
        try {
            if (!this.initialized) throw new Error('Service not initialized');

            // 1. Upload data to Lighthouse to get a data hash
            const uploadResult = await this.uploadDataToLighthouse(data, dataType);
            if (!uploadResult.success) {
                throw new Error(uploadResult.error || 'Failed to upload data to IPFS');
            }

            // 2. Call the smart contract to record the contribution
            const tx = await this.contract.contributeData(dataType, uploadResult.hash);
            const receipt = await tx.wait();

            return {
                success: true,
                transactionHash: receipt.transactionHash,
                dataHash: uploadResult.hash
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
    
    
    
    async getUserContributions(userAddress) {
        try {
            if (!this.initialized) throw new Error('Service not initialized');

            const contributionIds = await this.contract.getUserContributions(userAddress);
            
            const contributions = await Promise.all(
                contributionIds.map(async (id) => {
                    const c = await this.contract.getContribution(id);
                    return {
                        id: id.toString(),
                        contributor: c[0],
                        dataType: c[1],
                        dataHash: c[2],
                        rewardAmount: ethers.formatEther(c[3]),
                        timestamp: Number(c[4]) * 1000
                    };
                })
            );

            return { success: true, contributions: contributions.reverse() };
        } catch (error) {
            console.error('Failed to get user contributions:', error);
            return { success: false, error: error.message };
        }
    }
    
    
    async createProposal(title, description) {
        try {
            if (!this.initialized) throw new Error('Service not initialized');

            const tx = await this.contract.createProposal(title, description);
            const receipt = await tx.wait();

            return {
                success: true,
                transactionHash: receipt.transactionHash
            };
        } catch (error) {
            console.error('Proposal creation failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    async voteOnProposal(proposalId, support) {
        try {
            if (!this.initialized) throw new Error('Service not initialized');

            const tx = await this.contract.vote(proposalId, support);
            const receipt = await tx.wait();

            return {
                success: true,
                transactionHash: receipt.transactionHash
            };
        } catch (error) {
            console.error('Voting failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    async getAllProposals() {
        try {
            if (!this.initialized) throw new Error('Service not initialized');

            const proposalCount = await this.contract.proposalCount();
            const proposals = [];

            for (let i = 0; i < proposalCount; i++) {
                const p = await this.contract.getProposal(i);
                proposals.push({
                    id: i.toString(),
                    proposer: p[0],
                    title: p[1],
                    description: p[2],
                    votesFor: p[3].toString(),
                    votesAgainst: p[4].toString(),
                    endTime: new Date(Number(p[5]) * 1000),
                    executed: p[6]
                });
            }

            return { success: true, proposals: proposals.reverse() };
        } catch (error) {
            console.error('Failed to get all proposals:', error);
            return { success: false, error: error.message };
        }
    }
    
}

export default new DataDAOService();
