import { ethers } from 'ethers';
import { encrypt, decrypt } from 'crypto-js/aes';
import { enc } from 'crypto-js';
import { MerkleTree } from 'merkletreejs';

/**
 * Privacy Audit Service
 * Manages privacy-preserving audit logs and compliance reporting
 */
class PrivacyAuditService {
    constructor() {
        this.contract = null;
        this.provider = null;
        this.signer = null;
        this.contractAddress = import.meta.env.VITE_PRIVACY_AUDIT_CONTRACT_ADDRESS;
        this.initialized = false;
        
        // Event types
        this.eventTypes = {
            SWAP_INITIATED: 0,
            SWAP_COMPLETED: 1,
            PROOF_VERIFIED: 2,
            IDENTITY_VERIFIED: 3,
            DATA_CONTRIBUTED: 4,
            REWARD_CLAIMED: 5,
            GOVERNANCE_VOTE: 6,
            COMPLIANCE_CHECK: 7
        };
        
        // Encryption key for audit data
        this.encryptionKey = import.meta.env.VITE_AUDIT_ENCRYPTION_KEY || 'default-audit-key';
        
        // Cache for audit logs
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }
    
    /**
     * Initialize the privacy audit service
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
            console.log('Privacy audit service initialized successfully');
            
            return { success: true };
        } catch (error) {
            console.error('Failed to initialize privacy audit service:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Initialize smart contract
     */
    async initializeContract() {
        const contractABI = [
            "function createAuditLog(address user, uint8 eventType, bytes32 dataHash, bytes32 nullifierHash, bytes memory encryptedData, bytes32 merkleRoot, string memory ipfsHash) external",
            "function flagAuditLog(uint256 logId, string memory reason) external",
            "function generateComplianceReport(uint256 startTime, uint256 endTime, bytes32 reportHash, string memory ipfsHash) external",
            "function verifyDataIntegrity(uint256 logId, bytes memory data, bytes32[] memory proof) external view returns (bool)",
            "function isNullifierUsed(bytes32 nullifierHash) external view returns (bool)",
            "function getUserAuditLogs(address user) external view returns (uint256[] memory)",
            "function getAuditLog(uint256 logId) external view returns (uint256, address, uint8, bytes32, bytes32, uint256, uint256, bytes32, bool, string memory)",
            "function getEncryptedAuditData(uint256 logId) external view returns (bytes memory)",
            "function getComplianceReport(uint256 reportId) external view returns (uint256, address, uint256, uint256, uint256, uint256, uint256, bytes32, string memory, bool)",
            "function getPrivacyMetrics() external view returns (uint256, uint256, uint256, uint256, uint256)",
            "function getAuditLogsByEventType(uint8 eventType, uint256 startTime, uint256 endTime) external view returns (uint256[] memory)",
            "function auditLogCounter() external view returns (uint256)",
            "function complianceReportCounter() external view returns (uint256)",
            "event AuditLogCreated(uint256 indexed logId, address indexed user, uint8 eventType, bytes32 dataHash)",
            "event ComplianceReportGenerated(uint256 indexed reportId, address indexed auditor, uint256 totalEvents, uint256 flaggedEvents)",
            "event NullifierUsed(bytes32 indexed nullifier, address indexed user, uint256 timestamp)",
            "event ComplianceViolation(uint256 indexed logId, address indexed user, string reason)"
        ];
        
        this.contract = new ethers.Contract(
            this.contractAddress,
            contractABI,
            this.signer
        );
    }
    
    /**
     * Create an audit log entry
     * @param {Object} auditData - Audit data to log
     * @returns {Object} Audit log creation result
     */
    async createAuditLog(auditData) {
        try {
            if (!this.initialized) {
                throw new Error('Privacy audit service not initialized');
            }
            
            const {
                user,
                eventType,
                data,
                nullifier,
                ipfsHash = ''
            } = auditData;
            
            // Generate data hash
            const dataHash = ethers.utils.keccak256(
                ethers.utils.toUtf8Bytes(JSON.stringify(data))
            );
            
            // Generate nullifier hash
            const nullifierHash = ethers.utils.keccak256(
                ethers.utils.toUtf8Bytes(nullifier || `${user}_${Date.now()}`)
            );
            
            // Check if nullifier is already used
            const isUsed = await this.contract.isNullifierUsed(nullifierHash);
            if (isUsed) {
                throw new Error('Nullifier already used - potential double-spend detected');
            }
            
            // Encrypt sensitive audit data
            const encryptedData = this.encryptAuditData(data);
            
            // Generate merkle tree for data integrity
            const merkleTree = this.generateMerkleTree([data]);
            const merkleRoot = merkleTree.getHexRoot();
            
            // Create audit log on-chain
            const tx = await this.contract.createAuditLog(
                user,
                this.eventTypes[eventType],
                dataHash,
                nullifierHash,
                encryptedData,
                merkleRoot,
                ipfsHash
            );
            
            const receipt = await tx.wait();
            
            // Parse audit log created event
            const auditEvent = receipt.events?.find(
                event => event.event === 'AuditLogCreated'
            );
            
            if (auditEvent) {
                const { logId } = auditEvent.args;
                
                // Clear cache
                this.clearUserCache(user);
                
                return {
                    success: true,
                    logId: logId.toString(),
                    dataHash,
                    nullifierHash,
                    merkleRoot,
                    transactionHash: receipt.transactionHash
                };
            }
            
            throw new Error('Audit log creation event not found');
            
        } catch (error) {
            console.error('Failed to create audit log:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Flag an audit log as non-compliant
     * @param {string} logId - Audit log ID
     * @param {string} reason - Reason for flagging
     * @returns {Object} Flagging result
     */
    async flagAuditLog(logId, reason) {
        try {
            if (!this.initialized) {
                throw new Error('Privacy audit service not initialized');
            }
            
            const tx = await this.contract.flagAuditLog(logId, reason);
            const receipt = await tx.wait();
            
            // Clear cache
            this.clearCache();
            
            return {
                success: true,
                logId,
                reason,
                transactionHash: receipt.transactionHash
            };
            
        } catch (error) {
            console.error('Failed to flag audit log:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Generate a compliance report
     * @param {Object} reportData - Report parameters
     * @returns {Object} Report generation result
     */
    async generateComplianceReport(reportData) {
        try {
            if (!this.initialized) {
                throw new Error('Privacy audit service not initialized');
            }
            
            const { startTime, endTime, reportData: data, ipfsHash = '' } = reportData;
            
            // Generate report hash
            const reportHash = ethers.utils.keccak256(
                ethers.utils.toUtf8Bytes(JSON.stringify(data))
            );
            
            const tx = await this.contract.generateComplianceReport(
                Math.floor(startTime / 1000),
                Math.floor(endTime / 1000),
                reportHash,
                ipfsHash
            );
            
            const receipt = await tx.wait();
            
            // Parse compliance report event
            const reportEvent = receipt.events?.find(
                event => event.event === 'ComplianceReportGenerated'
            );
            
            if (reportEvent) {
                const { reportId, totalEvents, flaggedEvents } = reportEvent.args;
                
                return {
                    success: true,
                    reportId: reportId.toString(),
                    totalEvents: totalEvents.toString(),
                    flaggedEvents: flaggedEvents.toString(),
                    reportHash,
                    transactionHash: receipt.transactionHash
                };
            }
            
            throw new Error('Compliance report event not found');
            
        } catch (error) {
            console.error('Failed to generate compliance report:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get audit logs for a user
     * @param {string} userAddress - User address
     * @returns {Object} User audit logs
     */
    async getUserAuditLogs(userAddress) {
        try {
            const cacheKey = `user_logs_${userAddress}`;
            
            // Check cache
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return { success: true, logs: cached.data };
                }
            }
            
            const logIds = await this.contract.getUserAuditLogs(userAddress);
            const logs = [];
            
            for (const logId of logIds) {
                const log = await this.getAuditLog(logId.toString());
                if (log.success) {
                    logs.push(log.log);
                }
            }
            
            // Cache result
            this.cache.set(cacheKey, {
                data: logs,
                timestamp: Date.now()
            });
            
            return { success: true, logs };
            
        } catch (error) {
            console.error('Failed to get user audit logs:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get audit log details
     * @param {string} logId - Audit log ID
     * @returns {Object} Audit log details
     */
    async getAuditLog(logId) {
        try {
            const [
                id,
                user,
                eventType,
                dataHash,
                nullifierHash,
                timestamp,
                blockNumber,
                merkleRoot,
                isCompliant,
                ipfsHash
            ] = await this.contract.getAuditLog(logId);
            
            const log = {
                id: id.toString(),
                user,
                eventType: Object.keys(this.eventTypes)[eventType],
                dataHash,
                nullifierHash,
                timestamp: new Date(timestamp.toNumber() * 1000),
                blockNumber: blockNumber.toString(),
                merkleRoot,
                isCompliant,
                ipfsHash
            };
            
            return { success: true, log };
            
        } catch (error) {
            console.error('Failed to get audit log:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get encrypted audit data (for authorized users only)
     * @param {string} logId - Audit log ID
     * @returns {Object} Decrypted audit data
     */
    async getDecryptedAuditData(logId) {
        try {
            if (!this.initialized) {
                throw new Error('Privacy audit service not initialized');
            }
            
            const encryptedData = await this.contract.getEncryptedAuditData(logId);
            const decryptedData = this.decryptAuditData(encryptedData);
            
            return { success: true, data: decryptedData };
            
        } catch (error) {
            console.error('Failed to get decrypted audit data:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get compliance report
     * @param {string} reportId - Report ID
     * @returns {Object} Compliance report
     */
    async getComplianceReport(reportId) {
        try {
            const [
                id,
                auditor,
                startTime,
                endTime,
                totalEvents,
                compliantEvents,
                flaggedEvents,
                reportHash,
                ipfsHash,
                isFinalized
            ] = await this.contract.getComplianceReport(reportId);
            
            const report = {
                id: id.toString(),
                auditor,
                startTime: new Date(startTime.toNumber() * 1000),
                endTime: new Date(endTime.toNumber() * 1000),
                totalEvents: totalEvents.toString(),
                compliantEvents: compliantEvents.toString(),
                flaggedEvents: flaggedEvents.toString(),
                reportHash,
                ipfsHash,
                isFinalized,
                complianceRate: totalEvents.gt(0) ? 
                    compliantEvents.mul(100).div(totalEvents).toNumber() : 100
            };
            
            return { success: true, report };
            
        } catch (error) {
            console.error('Failed to get compliance report:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get privacy metrics
     * @returns {Object} Privacy metrics
     */
    async getPrivacyMetrics() {
        try {
            const cacheKey = 'privacy_metrics';
            
            // Check cache
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return { success: true, metrics: cached.data };
                }
            }
            
            const [
                totalAuditLogs,
                totalComplianceReports,
                totalNullifiers,
                flaggedTransactions,
                lastAuditTime
            ] = await this.contract.getPrivacyMetrics();
            
            const metrics = {
                totalAuditLogs: totalAuditLogs.toString(),
                totalComplianceReports: totalComplianceReports.toString(),
                totalNullifiers: totalNullifiers.toString(),
                flaggedTransactions: flaggedTransactions.toString(),
                lastAuditTime: new Date(lastAuditTime.toNumber() * 1000),
                complianceRate: totalAuditLogs.gt(0) ? 
                    totalAuditLogs.sub(flaggedTransactions).mul(100).div(totalAuditLogs).toNumber() : 100
            };
            
            // Cache result
            this.cache.set(cacheKey, {
                data: metrics,
                timestamp: Date.now()
            });
            
            return { success: true, metrics };
            
        } catch (error) {
            console.error('Failed to get privacy metrics:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get audit logs by event type
     * @param {string} eventType - Event type
     * @param {Date} startTime - Start time
     * @param {Date} endTime - End time
     * @returns {Object} Filtered audit logs
     */
    async getAuditLogsByEventType(eventType, startTime, endTime) {
        try {
            const logIds = await this.contract.getAuditLogsByEventType(
                this.eventTypes[eventType],
                Math.floor(startTime.getTime() / 1000),
                Math.floor(endTime.getTime() / 1000)
            );
            
            const logs = [];
            for (const logId of logIds) {
                const log = await this.getAuditLog(logId.toString());
                if (log.success) {
                    logs.push(log.log);
                }
            }
            
            return { success: true, logs };
            
        } catch (error) {
            console.error('Failed to get audit logs by event type:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Verify data integrity
     * @param {string} logId - Audit log ID
     * @param {Object} originalData - Original data to verify
     * @returns {Object} Verification result
     */
    async verifyDataIntegrity(logId, originalData) {
        try {
            // Generate merkle tree and proof
            const merkleTree = this.generateMerkleTree([originalData]);
            const leaf = ethers.utils.keccak256(
                ethers.utils.toUtf8Bytes(JSON.stringify(originalData))
            );
            const proof = merkleTree.getHexProof(leaf);
            
            // Convert to bytes format
            const dataBytes = ethers.utils.toUtf8Bytes(JSON.stringify(originalData));
            
            const isValid = await this.contract.verifyDataIntegrity(
                logId,
                dataBytes,
                proof
            );
            
            return { success: true, isValid };
            
        } catch (error) {
            console.error('Failed to verify data integrity:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Check if nullifier is used (double-spend check)
     * @param {string} nullifier - Nullifier to check
     * @returns {Object} Nullifier status
     */
    async checkNullifier(nullifier) {
        try {
            const nullifierHash = ethers.utils.keccak256(
                ethers.utils.toUtf8Bytes(nullifier)
            );
            
            const isUsed = await this.contract.isNullifierUsed(nullifierHash);
            
            return { success: true, isUsed, nullifierHash };
            
        } catch (error) {
            console.error('Failed to check nullifier:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get all compliance reports
     * @returns {Object} All compliance reports
     */
    async getAllComplianceReports() {
        try {
            const reportCount = await this.contract.complianceReportCounter();
            const reports = [];
            
            for (let i = 0; i < reportCount.toNumber(); i++) {
                const report = await this.getComplianceReport(i.toString());
                if (report.success) {
                    reports.push(report.report);
                }
            }
            
            return { success: true, reports };
            
        } catch (error) {
            console.error('Failed to get all compliance reports:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Encrypt audit data
     * @param {Object} data - Data to encrypt
     * @returns {string} Encrypted data
     */
    encryptAuditData(data) {
        const dataString = JSON.stringify(data);
        const encrypted = encrypt(dataString, this.encryptionKey);
        return ethers.utils.hexlify(ethers.utils.toUtf8Bytes(encrypted.toString()));
    }
    
    /**
     * Decrypt audit data
     * @param {string} encryptedData - Encrypted data
     * @returns {Object} Decrypted data
     */
    decryptAuditData(encryptedData) {
        try {
            const encryptedString = ethers.utils.toUtf8String(encryptedData);
            const decrypted = decrypt(encryptedString, this.encryptionKey);
            return JSON.parse(decrypted.toString(enc.Utf8));
        } catch (error) {
            console.error('Failed to decrypt audit data:', error);
            return null;
        }
    }
    
    /**
     * Generate merkle tree for data integrity
     * @param {Array} dataArray - Array of data items
     * @returns {MerkleTree} Merkle tree
     */
    generateMerkleTree(dataArray) {
        const leaves = dataArray.map(data => 
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes(JSON.stringify(data)))
        );
        return new MerkleTree(leaves, ethers.utils.keccak256, { sortPairs: true });
    }
    
    /**
     * Generate audit statistics
     * @param {Date} startTime - Start time for statistics
     * @param {Date} endTime - End time for statistics
     * @returns {Object} Audit statistics
     */
    async generateAuditStatistics(startTime, endTime) {
        try {
            const statistics = {
                totalEvents: 0,
                eventsByType: {},
                complianceRate: 0,
                flaggedEvents: 0,
                uniqueUsers: new Set(),
                timeRange: {
                    start: startTime,
                    end: endTime
                }
            };
            
            // Get events for each type
            for (const eventType of Object.keys(this.eventTypes)) {
                const logs = await this.getAuditLogsByEventType(eventType, startTime, endTime);
                if (logs.success) {
                    statistics.eventsByType[eventType] = logs.logs.length;
                    statistics.totalEvents += logs.logs.length;
                    
                    logs.logs.forEach(log => {
                        statistics.uniqueUsers.add(log.user);
                        if (!log.isCompliant) {
                            statistics.flaggedEvents++;
                        }
                    });
                }
            }
            
            statistics.uniqueUsers = statistics.uniqueUsers.size;
            statistics.complianceRate = statistics.totalEvents > 0 ? 
                ((statistics.totalEvents - statistics.flaggedEvents) / statistics.totalEvents) * 100 : 100;
            
            return { success: true, statistics };
            
        } catch (error) {
            console.error('Failed to generate audit statistics:', error);
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

export default PrivacyAuditService;
