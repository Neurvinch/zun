import { ethers } from 'ethers';
import { logger } from '../utils/logger.js';
import { db } from '../database/index.js';
import { redis } from '../cache/redis.js';
import { lighthouse } from 'lighthouse-web3';
import { encrypt, decrypt } from 'crypto-js/aes.js';
import { enc } from 'crypto-js';

/**
 * DataDAO Backend Service
 * Handles data contributions, rewards, and governance operations
 */
export class DataDAOService {
    constructor() {
        this.provider = null;
        this.contract = null;
        this.initialized = false;
        this.contractAddress = process.env.DATADAO_CONTRACT_ADDRESS;
        this.encryptionKey = process.env.DATADAO_ENCRYPTION_KEY;
        this.lighthouseApiKey = process.env.LIGHTHOUSE_API_KEY;
    }
    
    /**
     * Initialize the DataDAO service
     */
    async initialize() {
        try {
            logger.info('Initializing DataDAO service...');
            
            // Initialize blockchain connection
            this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
            
            // Initialize contract
            const contractABI = await this.loadContractABI();
            this.contract = new ethers.Contract(
                this.contractAddress,
                contractABI,
                this.provider
            );
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize database tables
            await this.initializeDatabase();
            
            this.initialized = true;
            logger.info('DataDAO service initialized successfully');
            
        } catch (error) {
            logger.error('Failed to initialize DataDAO service:', error);
            throw error;
        }
    }
    
    /**
     * Set up blockchain event listeners
     */
    setupEventListeners() {
        // Listen for data contributions
        this.contract.on('DataContributed', async (contributionId, contributor, dataHash, dataType, rewardAmount, event) => {
            try {
                await this.handleDataContributed({
                    contributionId: contributionId.toString(),
                    contributor,
                    dataHash,
                    dataType: dataType.toString(),
                    rewardAmount: ethers.formatEther(rewardAmount),
                    blockNumber: event.blockNumber,
                    transactionHash: event.transactionHash
                });
            } catch (error) {
                logger.error('Error handling DataContributed event:', error);
            }
        });
        
        // Listen for reward claims
        this.contract.on('RewardClaimed', async (contributor, amount, event) => {
            try {
                await this.handleRewardClaimed({
                    contributor,
                    amount: ethers.formatEther(amount),
                    blockNumber: event.blockNumber,
                    transactionHash: event.transactionHash
                });
            } catch (error) {
                logger.error('Error handling RewardClaimed event:', error);
            }
        });
        
        // Listen for proposals
        this.contract.on('ProposalCreated', async (proposalId, proposer, title, event) => {
            try {
                await this.handleProposalCreated({
                    proposalId: proposalId.toString(),
                    proposer,
                    title,
                    blockNumber: event.blockNumber,
                    transactionHash: event.transactionHash
                });
            } catch (error) {
                logger.error('Error handling ProposalCreated event:', error);
            }
        });
        
        logger.info('DataDAO event listeners set up');
    }
    
    /**
     * Handle data contribution event
     */
    async handleDataContributed(eventData) {
        try {
            // Store contribution in database
            const query = `
                INSERT INTO data_contributions 
                (contribution_id, contributor, data_hash, data_type, reward_amount, block_number, transaction_hash, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                ON CONFLICT (contribution_id) DO NOTHING
            `;
            
            await db.query(query, [
                eventData.contributionId,
                eventData.contributor,
                eventData.dataHash,
                eventData.dataType,
                eventData.rewardAmount,
                eventData.blockNumber,
                eventData.transactionHash
            ]);
            
            // Update contributor stats
            await this.updateContributorStats(eventData.contributor);
            
            // Cache invalidation
            await redis.del(`contributor:${eventData.contributor}`);
            await redis.del('datadao:stats');
            
            logger.info(`Data contribution recorded: ${eventData.contributionId}`);
            
        } catch (error) {
            logger.error('Error handling data contributed event:', error);
            throw error;
        }
    }
    
    /**
     * Handle reward claimed event
     */
    async handleRewardClaimed(eventData) {
        try {
            // Store reward claim in database
            const query = `
                INSERT INTO reward_claims 
                (contributor, amount, block_number, transaction_hash, created_at)
                VALUES ($1, $2, $3, $4, NOW())
            `;
            
            await db.query(query, [
                eventData.contributor,
                eventData.amount,
                eventData.blockNumber,
                eventData.transactionHash
            ]);
            
            // Update contributor stats
            await this.updateContributorStats(eventData.contributor);
            
            // Cache invalidation
            await redis.del(`contributor:${eventData.contributor}`);
            
            logger.info(`Reward claim recorded: ${eventData.contributor} - ${eventData.amount}`);
            
        } catch (error) {
            logger.error('Error handling reward claimed event:', error);
            throw error;
        }
    }
    
    /**
     * Handle proposal created event
     */
    async handleProposalCreated(eventData) {
        try {
            // Get proposal details from contract
            const proposalDetails = await this.contract.getProposal(eventData.proposalId);
            
            // Store proposal in database
            const query = `
                INSERT INTO dao_proposals 
                (proposal_id, proposer, title, description, start_time, end_time, block_number, transaction_hash, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                ON CONFLICT (proposal_id) DO NOTHING
            `;
            
            await db.query(query, [
                eventData.proposalId,
                eventData.proposer,
                eventData.title,
                proposalDetails.description,
                new Date(proposalDetails.startTime * 1000),
                new Date(proposalDetails.endTime * 1000),
                eventData.blockNumber,
                eventData.transactionHash
            ]);
            
            // Cache invalidation
            await redis.del('datadao:proposals');
            
            logger.info(`Proposal created: ${eventData.proposalId}`);
            
        } catch (error) {
            logger.error('Error handling proposal created event:', error);
            throw error;
        }
    }
    
    /**
     * Process and anonymize data contribution
     */
    async processDataContribution(contributionData) {
        try {
            const { data, contributor, dataType } = contributionData;
            
            // Anonymize the data
            const anonymizedData = await this.anonymizeData(data, contributor);
            
            // Encrypt the data
            const encryptedData = this.encryptData(anonymizedData);
            
            // Upload to IPFS via Lighthouse
            const ipfsHash = await this.uploadToIPFS(encryptedData);
            
            // Generate data quality score
            const qualityScore = await this.calculateDataQuality(anonymizedData, dataType);
            
            // Store processed data
            const query = `
                INSERT INTO processed_data 
                (contributor, data_type, ipfs_hash, quality_score, processed_at)
                VALUES ($1, $2, $3, $4, NOW())
                RETURNING id
            `;
            
            const result = await db.query(query, [
                contributor,
                dataType,
                ipfsHash,
                qualityScore
            ]);
            
            return {
                success: true,
                processedId: result.rows[0].id,
                ipfsHash,
                qualityScore
            };
            
        } catch (error) {
            logger.error('Error processing data contribution:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Anonymize sensitive data
     */
    async anonymizeData(data, contributor) {
        try {
            const anonymized = { ...data };
            
            // Remove direct identifiers
            delete anonymized.userAddress;
            delete anonymized.walletAddress;
            delete anonymized.email;
            delete anonymized.phone;
            
            // Hash contributor address
            anonymized.contributorHash = ethers.keccak256(
                ethers.toUtf8Bytes(contributor)
            );
            
            // Generalize timestamps (round to nearest hour)
            if (anonymized.timestamp) {
                const date = new Date(anonymized.timestamp);
                date.setMinutes(0, 0, 0);
                anonymized.timestamp = date.getTime();
            }
            
            // Add noise to numerical values
            if (anonymized.amount && typeof anonymized.amount === 'number') {
                const noise = (Math.random() - 0.5) * 0.01; // ±0.5% noise
                anonymized.amount = anonymized.amount * (1 + noise);
            }
            
            // Add anonymization metadata
            anonymized.anonymizedAt = Date.now();
            anonymized.anonymizationVersion = '1.0';
            
            return anonymized;
            
        } catch (error) {
            logger.error('Error anonymizing data:', error);
            throw error;
        }
    }
    
    /**
     * Encrypt data using AES
     */
    encryptData(data) {
        try {
            const dataString = JSON.stringify(data);
            const encrypted = encrypt(dataString, this.encryptionKey);
            return encrypted.toString();
        } catch (error) {
            logger.error('Error encrypting data:', error);
            throw error;
        }
    }
    
    /**
     * Decrypt data using AES
     */
    decryptData(encryptedData) {
        try {
            const decrypted = decrypt(encryptedData, this.encryptionKey);
            return JSON.parse(decrypted.toString(enc.Utf8));
        } catch (error) {
            logger.error('Error decrypting data:', error);
            throw error;
        }
    }
    
    /**
     * Upload data to IPFS via Lighthouse
     */
    async uploadToIPFS(data) {
        try {
            const blob = new Blob([data], { type: 'application/json' });
            const file = new File([blob], 'data.json', { type: 'application/json' });
            
            const response = await lighthouse.upload([file], this.lighthouseApiKey);
            
            if (response.data && response.data.Hash) {
                return response.data.Hash;
            }
            
            throw new Error('Failed to get IPFS hash from Lighthouse');
            
        } catch (error) {
            logger.error('Error uploading to IPFS:', error);
            throw error;
        }
    }
    
    /**
     * Calculate data quality score
     */
    async calculateDataQuality(data, dataType) {
        try {
            let score = 0;
            
            // Completeness check (40% of score)
            const completeness = this.checkCompleteness(data, dataType);
            score += completeness * 0.4;
            
            // Accuracy check (30% of score)
            const accuracy = this.checkAccuracy(data, dataType);
            score += accuracy * 0.3;
            
            // Timeliness check (20% of score)
            const timeliness = this.checkTimeliness(data);
            score += timeliness * 0.2;
            
            // Uniqueness check (10% of score)
            const uniqueness = await this.checkUniqueness(data);
            score += uniqueness * 0.1;
            
            return Math.round(score * 100); // Return as percentage
            
        } catch (error) {
            logger.error('Error calculating data quality:', error);
            return 50; // Default score
        }
    }
    
    /**
     * Check data completeness
     */
    checkCompleteness(data, dataType) {
        const requiredFields = {
            'TRADING_DATA': ['amount', 'token', 'timestamp'],
            'MARKET_SIGNALS': ['signal', 'confidence', 'timestamp'],
            'RISK_METRICS': ['riskScore', 'timestamp'],
            'COMPLIANCE_DATA': ['complianceCheck', 'timestamp'],
            'ML_DATASET': ['features', 'labels', 'timestamp']
        };
        
        const required = requiredFields[dataType] || [];
        const present = required.filter(field => data[field] !== undefined);
        
        return present.length / required.length;
    }
    
    /**
     * Check data accuracy
     */
    checkAccuracy(data, dataType) {
        // Basic accuracy checks
        let score = 1.0;
        
        // Check for reasonable timestamp
        if (data.timestamp) {
            const now = Date.now();
            const dataTime = new Date(data.timestamp).getTime();
            if (dataTime > now || dataTime < now - 365 * 24 * 60 * 60 * 1000) {
                score -= 0.2; // Unreasonable timestamp
            }
        }
        
        // Check for reasonable numerical values
        if (data.amount && (data.amount < 0 || data.amount > 1e12)) {
            score -= 0.3; // Unreasonable amount
        }
        
        return Math.max(0, score);
    }
    
    /**
     * Check data timeliness
     */
    checkTimeliness(data) {
        if (!data.timestamp) return 0.5; // No timestamp
        
        const now = Date.now();
        const dataTime = new Date(data.timestamp).getTime();
        const ageHours = (now - dataTime) / (1000 * 60 * 60);
        
        // Fresher data gets higher score
        if (ageHours < 1) return 1.0;
        if (ageHours < 24) return 0.8;
        if (ageHours < 168) return 0.6; // 1 week
        if (ageHours < 720) return 0.4; // 1 month
        return 0.2;
    }
    
    /**
     * Check data uniqueness
     */
    async checkUniqueness(data) {
        try {
            const dataHash = ethers.keccak256(
                ethers.toUtf8Bytes(JSON.stringify(data))
            );
            
            const query = 'SELECT COUNT(*) FROM processed_data WHERE data_hash = $1';
            const result = await db.query(query, [dataHash]);
            
            const count = parseInt(result.rows[0].count);
            return count === 0 ? 1.0 : 1.0 / (count + 1);
            
        } catch (error) {
            logger.error('Error checking uniqueness:', error);
            return 0.5;
        }
    }
    
    /**
     * Update contributor statistics
     */
    async updateContributorStats(contributor) {
        try {
            const query = `
                INSERT INTO contributor_stats (contributor, total_contributions, total_rewards, last_contribution)
                VALUES ($1, 1, 0, NOW())
                ON CONFLICT (contributor) 
                DO UPDATE SET 
                    total_contributions = contributor_stats.total_contributions + 1,
                    last_contribution = NOW()
            `;
            
            await db.query(query, [contributor]);
            
        } catch (error) {
            logger.error('Error updating contributor stats:', error);
        }
    }
    
    /**
     * Get contributor analytics
     */
    async getContributorAnalytics(contributor) {
        try {
            // Check cache first
            const cacheKey = `contributor:${contributor}`;
            const cached = await redis.get(cacheKey);
            
            if (cached) {
                return JSON.parse(cached);
            }
            
            // Get from database
            const query = `
                SELECT 
                    cs.*,
                    COUNT(dc.id) as contribution_count,
                    AVG(pd.quality_score) as avg_quality_score,
                    SUM(CAST(dc.reward_amount AS DECIMAL)) as total_earned
                FROM contributor_stats cs
                LEFT JOIN data_contributions dc ON cs.contributor = dc.contributor
                LEFT JOIN processed_data pd ON cs.contributor = pd.contributor
                WHERE cs.contributor = $1
                GROUP BY cs.contributor, cs.total_contributions, cs.total_rewards, cs.last_contribution
            `;
            
            const result = await db.query(query, [contributor]);
            
            const analytics = result.rows[0] || {
                contributor,
                contribution_count: 0,
                avg_quality_score: 0,
                total_earned: 0
            };
            
            // Cache for 5 minutes
            await redis.setex(cacheKey, 300, JSON.stringify(analytics));
            
            return analytics;
            
        } catch (error) {
            logger.error('Error getting contributor analytics:', error);
            throw error;
        }
    }
    
    /**
     * Get DAO statistics
     */
    async getDAOStatistics() {
        try {
            // Check cache first
            const cacheKey = 'datadao:stats';
            const cached = await redis.get(cacheKey);
            
            if (cached) {
                return JSON.parse(cached);
            }
            
            // Get from database
            const query = `
                SELECT 
                    COUNT(DISTINCT dc.contributor) as total_contributors,
                    COUNT(dc.id) as total_contributions,
                    SUM(CAST(dc.reward_amount AS DECIMAL)) as total_rewards,
                    AVG(pd.quality_score) as avg_quality_score,
                    COUNT(DISTINCT dp.id) as total_proposals
                FROM data_contributions dc
                LEFT JOIN processed_data pd ON dc.contributor = pd.contributor
                LEFT JOIN dao_proposals dp ON true
            `;
            
            const result = await db.query(query);
            const stats = result.rows[0];
            
            // Cache for 10 minutes
            await redis.setex(cacheKey, 600, JSON.stringify(stats));
            
            return stats;
            
        } catch (error) {
            logger.error('Error getting DAO statistics:', error);
            throw error;
        }
    }
    
    /**
     * Initialize database tables
     */
    async initializeDatabase() {
        try {
            // Create tables if they don't exist
            await db.query(`
                CREATE TABLE IF NOT EXISTS data_contributions (
                    id SERIAL PRIMARY KEY,
                    contribution_id VARCHAR(255) UNIQUE NOT NULL,
                    contributor VARCHAR(255) NOT NULL,
                    data_hash VARCHAR(255) NOT NULL,
                    data_type VARCHAR(50) NOT NULL,
                    reward_amount VARCHAR(255) NOT NULL,
                    block_number BIGINT NOT NULL,
                    transaction_hash VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);
            
            await db.query(`
                CREATE TABLE IF NOT EXISTS processed_data (
                    id SERIAL PRIMARY KEY,
                    contributor VARCHAR(255) NOT NULL,
                    data_type VARCHAR(50) NOT NULL,
                    data_hash VARCHAR(255),
                    ipfs_hash VARCHAR(255) NOT NULL,
                    quality_score INTEGER DEFAULT 0,
                    processed_at TIMESTAMP DEFAULT NOW()
                )
            `);
            
            await db.query(`
                CREATE TABLE IF NOT EXISTS contributor_stats (
                    contributor VARCHAR(255) PRIMARY KEY,
                    total_contributions INTEGER DEFAULT 0,
                    total_rewards VARCHAR(255) DEFAULT '0',
                    last_contribution TIMESTAMP
                )
            `);
            
            await db.query(`
                CREATE TABLE IF NOT EXISTS dao_proposals (
                    id SERIAL PRIMARY KEY,
                    proposal_id VARCHAR(255) UNIQUE NOT NULL,
                    proposer VARCHAR(255) NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    start_time TIMESTAMP,
                    end_time TIMESTAMP,
                    block_number BIGINT NOT NULL,
                    transaction_hash VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);
            
            await db.query(`
                CREATE TABLE IF NOT EXISTS reward_claims (
                    id SERIAL PRIMARY KEY,
                    contributor VARCHAR(255) NOT NULL,
                    amount VARCHAR(255) NOT NULL,
                    block_number BIGINT NOT NULL,
                    transaction_hash VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);
            
            logger.info('DataDAO database tables initialized');
            
        } catch (error) {
            logger.error('Error initializing database:', error);
            throw error;
        }
    }
    
    /**
     * Load contract ABI
     */
    async loadContractABI() {
        // Return the DataDAO contract ABI
        return [
            "event DataContributed(uint256 indexed contributionId, address indexed contributor, string dataHash, uint8 dataType, uint256 rewardAmount)",
            "event RewardClaimed(address indexed contributor, uint256 amount)",
            "event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string title)",
            "function getProposal(uint256 proposalId) external view returns (uint256, address, string memory, string memory, uint256, uint256, uint256, uint256, bool)"
        ];
    }
    
    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            if (this.contract) {
                this.contract.removeAllListeners();
            }
            logger.info('DataDAO service cleaned up');
        } catch (error) {
            logger.error('Error cleaning up DataDAO service:', error);
        }
    }
}
