// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title PrivacyAuditSystem
 * @dev Manages privacy-preserving audit logs for compliance and double-spend prevention
 * Stores encrypted audit trails while maintaining zero-knowledge privacy
 */
contract PrivacyAuditSystem is AccessControl, ReentrancyGuard {
    
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    
    // Audit event types
    enum AuditEventType {
        SWAP_INITIATED,
        SWAP_COMPLETED,
        PROOF_VERIFIED,
        IDENTITY_VERIFIED,
        DATA_CONTRIBUTED,
        REWARD_CLAIMED,
        GOVERNANCE_VOTE,
        COMPLIANCE_CHECK
    }
    
    // Audit log entry
    struct AuditLog {
        uint256 id;
        address user;
        AuditEventType eventType;
        bytes32 dataHash;
        bytes32 nullifierHash;
        uint256 timestamp;
        uint256 blockNumber;
        bytes encryptedData;
        bytes32 merkleRoot;
        bool isCompliant;
        string ipfsHash;
    }
    
    // Compliance report
    struct ComplianceReport {
        uint256 id;
        address auditor;
        uint256 startTime;
        uint256 endTime;
        uint256 totalEvents;
        uint256 compliantEvents;
        uint256 flaggedEvents;
        bytes32 reportHash;
        string ipfsHash;
        bool isFinalized;
    }
    
    // Double-spend prevention
    struct NullifierRecord {
        bytes32 nullifier;
        uint256 timestamp;
        address user;
        bool isUsed;
    }
    
    // Privacy metrics
    struct PrivacyMetrics {
        uint256 totalAuditLogs;
        uint256 totalComplianceReports;
        uint256 totalNullifiers;
        uint256 flaggedTransactions;
        uint256 lastAuditTime;
    }
    
    // Storage
    mapping(uint256 => AuditLog) public auditLogs;
    mapping(bytes32 => NullifierRecord) public nullifiers;
    mapping(uint256 => ComplianceReport) public complianceReports;
    mapping(address => uint256[]) public userAuditLogs;
    mapping(address => bool) public authorizedAuditors;
    
    uint256 public auditLogCounter;
    uint256 public complianceReportCounter;
    PrivacyMetrics public privacyMetrics;
    
    // Configuration
    uint256 public constant MAX_AUDIT_RETENTION = 365 days;
    uint256 public constant COMPLIANCE_REPORT_PERIOD = 30 days;
    
    // Events
    event AuditLogCreated(
        uint256 indexed logId,
        address indexed user,
        AuditEventType eventType,
        bytes32 dataHash
    );
    
    event ComplianceReportGenerated(
        uint256 indexed reportId,
        address indexed auditor,
        uint256 totalEvents,
        uint256 flaggedEvents
    );
    
    event NullifierUsed(
        bytes32 indexed nullifier,
        address indexed user,
        uint256 timestamp
    );
    
    event ComplianceViolation(
        uint256 indexed logId,
        address indexed user,
        string reason
    );
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(AUDITOR_ROLE, msg.sender);
        _grantRole(COMPLIANCE_ROLE, msg.sender);
    }
    
    /**
     * @dev Create an audit log entry
     * @param user User address
     * @param eventType Type of audit event
     * @param dataHash Hash of the event data
     * @param nullifierHash Nullifier hash for double-spend prevention
     * @param encryptedData Encrypted audit data
     * @param merkleRoot Merkle root for data integrity
     * @param ipfsHash IPFS hash for additional data storage
     */
    function createAuditLog(
        address user,
        AuditEventType eventType,
        bytes32 dataHash,
        bytes32 nullifierHash,
        bytes memory encryptedData,
        bytes32 merkleRoot,
        string memory ipfsHash
    ) external onlyRole(RELAYER_ROLE) {
        
        // Check for double-spend
        require(!nullifiers[nullifierHash].isUsed, "Nullifier already used");
        
        uint256 logId = auditLogCounter++;
        
        // Create audit log
        auditLogs[logId] = AuditLog({
            id: logId,
            user: user,
            eventType: eventType,
            dataHash: dataHash,
            nullifierHash: nullifierHash,
            timestamp: block.timestamp,
            blockNumber: block.number,
            encryptedData: encryptedData,
            merkleRoot: merkleRoot,
            isCompliant: true, // Default to compliant, can be updated by auditors
            ipfsHash: ipfsHash
        });
        
        // Record nullifier
        nullifiers[nullifierHash] = NullifierRecord({
            nullifier: nullifierHash,
            timestamp: block.timestamp,
            user: user,
            isUsed: true
        });
        
        // Update user audit logs
        userAuditLogs[user].push(logId);
        
        // Update metrics
        privacyMetrics.totalAuditLogs++;
        privacyMetrics.totalNullifiers++;
        privacyMetrics.lastAuditTime = block.timestamp;
        
        emit AuditLogCreated(logId, user, eventType, dataHash);
        emit NullifierUsed(nullifierHash, user, block.timestamp);
    }
    
    /**
     * @dev Flag an audit log as non-compliant
     * @param logId Audit log ID
     * @param reason Reason for flagging
     */
    function flagAuditLog(uint256 logId, string memory reason) external onlyRole(AUDITOR_ROLE) {
        require(logId < auditLogCounter, "Invalid audit log ID");
        
        AuditLog storage log = auditLogs[logId];
        require(log.isCompliant, "Already flagged");
        
        log.isCompliant = false;
        privacyMetrics.flaggedTransactions++;
        
        emit ComplianceViolation(logId, log.user, reason);
    }
    
    /**
     * @dev Generate a compliance report
     * @param startTime Start time for the report period
     * @param endTime End time for the report period
     * @param reportHash Hash of the report data
     * @param ipfsHash IPFS hash of the detailed report
     */
    function generateComplianceReport(
        uint256 startTime,
        uint256 endTime,
        bytes32 reportHash,
        string memory ipfsHash
    ) external onlyRole(COMPLIANCE_ROLE) {
        require(startTime < endTime, "Invalid time range");
        require(endTime <= block.timestamp, "End time in future");
        
        uint256 reportId = complianceReportCounter++;
        
        // Count events in the period
        (uint256 totalEvents, uint256 compliantEvents, uint256 flaggedEvents) = 
            _countEventsInPeriod(startTime, endTime);
        
        complianceReports[reportId] = ComplianceReport({
            id: reportId,
            auditor: msg.sender,
            startTime: startTime,
            endTime: endTime,
            totalEvents: totalEvents,
            compliantEvents: compliantEvents,
            flaggedEvents: flaggedEvents,
            reportHash: reportHash,
            ipfsHash: ipfsHash,
            isFinalized: true
        });
        
        privacyMetrics.totalComplianceReports++;
        
        emit ComplianceReportGenerated(reportId, msg.sender, totalEvents, flaggedEvents);
    }
    
    /**
     * @dev Verify data integrity using merkle proof
     * @param logId Audit log ID
     * @param data Original data
     * @param proof Merkle proof
     * @return Whether the data is valid
     */
    function verifyDataIntegrity(
        uint256 logId,
        bytes memory data,
        bytes32[] memory proof
    ) external view returns (bool) {
        require(logId < auditLogCounter, "Invalid audit log ID");
        
        AuditLog memory log = auditLogs[logId];
        bytes32 leaf = keccak256(data);
        
        return MerkleProof.verify(proof, log.merkleRoot, leaf);
    }
    
    /**
     * @dev Check if a nullifier has been used
     * @param nullifierHash Nullifier hash to check
     * @return Whether the nullifier has been used
     */
    function isNullifierUsed(bytes32 nullifierHash) external view returns (bool) {
        return nullifiers[nullifierHash].isUsed;
    }
    
    /**
     * @dev Get audit logs for a user
     * @param user User address
     * @return Array of audit log IDs
     */
    function getUserAuditLogs(address user) external view returns (uint256[] memory) {
        return userAuditLogs[user];
    }
    
    /**
     * @dev Get audit log details
     * @param logId Audit log ID
     * @return Audit log details (excluding encrypted data)
     */
    function getAuditLog(uint256 logId) external view returns (
        uint256 id,
        address user,
        AuditEventType eventType,
        bytes32 dataHash,
        bytes32 nullifierHash,
        uint256 timestamp,
        uint256 blockNumber,
        bytes32 merkleRoot,
        bool isCompliant,
        string memory ipfsHash
    ) {
        require(logId < auditLogCounter, "Invalid audit log ID");
        
        AuditLog memory log = auditLogs[logId];
        return (
            log.id,
            log.user,
            log.eventType,
            log.dataHash,
            log.nullifierHash,
            log.timestamp,
            log.blockNumber,
            log.merkleRoot,
            log.isCompliant,
            log.ipfsHash
        );
    }
    
    /**
     * @dev Get encrypted audit data (only for authorized auditors)
     * @param logId Audit log ID
     * @return Encrypted audit data
     */
    function getEncryptedAuditData(uint256 logId) external view onlyRole(AUDITOR_ROLE) returns (bytes memory) {
        require(logId < auditLogCounter, "Invalid audit log ID");
        return auditLogs[logId].encryptedData;
    }
    
    /**
     * @dev Get compliance report
     * @param reportId Report ID
     * @return Compliance report details
     */
    function getComplianceReport(uint256 reportId) external view returns (
        uint256 id,
        address auditor,
        uint256 startTime,
        uint256 endTime,
        uint256 totalEvents,
        uint256 compliantEvents,
        uint256 flaggedEvents,
        bytes32 reportHash,
        string memory ipfsHash,
        bool isFinalized
    ) {
        require(reportId < complianceReportCounter, "Invalid report ID");
        
        ComplianceReport memory report = complianceReports[reportId];
        return (
            report.id,
            report.auditor,
            report.startTime,
            report.endTime,
            report.totalEvents,
            report.compliantEvents,
            report.flaggedEvents,
            report.reportHash,
            report.ipfsHash,
            report.isFinalized
        );
    }
    
    /**
     * @dev Get privacy metrics
     * @return Privacy metrics
     */
    function getPrivacyMetrics() external view returns (
        uint256 totalAuditLogs,
        uint256 totalComplianceReports,
        uint256 totalNullifiers,
        uint256 flaggedTransactions,
        uint256 lastAuditTime
    ) {
        return (
            privacyMetrics.totalAuditLogs,
            privacyMetrics.totalComplianceReports,
            privacyMetrics.totalNullifiers,
            privacyMetrics.flaggedTransactions,
            privacyMetrics.lastAuditTime
        );
    }
    
    /**
     * @dev Get audit logs by event type
     * @param eventType Event type to filter by
     * @param startTime Start time for filtering
     * @param endTime End time for filtering
     * @return Array of audit log IDs
     */
    function getAuditLogsByEventType(
        AuditEventType eventType,
        uint256 startTime,
        uint256 endTime
    ) external view returns (uint256[] memory) {
        uint256[] memory matchingLogs = new uint256[](auditLogCounter);
        uint256 count = 0;
        
        for (uint256 i = 0; i < auditLogCounter; i++) {
            AuditLog memory log = auditLogs[i];
            if (log.eventType == eventType && 
                log.timestamp >= startTime && 
                log.timestamp <= endTime) {
                matchingLogs[count] = i;
                count++;
            }
        }
        
        // Resize array to actual count
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = matchingLogs[i];
        }
        
        return result;
    }
    
    /**
     * @dev Internal function to count events in a period
     * @param startTime Start time
     * @param endTime End time
     * @return totalEvents Total events in period
     * @return compliantEvents Compliant events in period
     * @return flaggedEvents Flagged events in period
     */
    function _countEventsInPeriod(uint256 startTime, uint256 endTime) internal view returns (
        uint256 totalEvents,
        uint256 compliantEvents,
        uint256 flaggedEvents
    ) {
        for (uint256 i = 0; i < auditLogCounter; i++) {
            AuditLog memory log = auditLogs[i];
            if (log.timestamp >= startTime && log.timestamp <= endTime) {
                totalEvents++;
                if (log.isCompliant) {
                    compliantEvents++;
                } else {
                    flaggedEvents++;
                }
            }
        }
    }
    
    /**
     * @dev Add authorized auditor
     * @param auditor Auditor address
     */
    function addAuditor(address auditor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(AUDITOR_ROLE, auditor);
        authorizedAuditors[auditor] = true;
    }
    
    /**
     * @dev Remove authorized auditor
     * @param auditor Auditor address
     */
    function removeAuditor(address auditor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(AUDITOR_ROLE, auditor);
        authorizedAuditors[auditor] = false;
    }
    
    /**
     * @dev Add relayer role
     * @param relayer Relayer address
     */
    function addRelayer(address relayer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(RELAYER_ROLE, relayer);
    }
    
    /**
     * @dev Remove relayer role
     * @param relayer Relayer address
     */
    function removeRelayer(address relayer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(RELAYER_ROLE, relayer);
    }
    
    /**
     * @dev Clean up old audit logs (for storage optimization)
     * @param maxAge Maximum age of logs to keep
     */
    function cleanupOldLogs(uint256 maxAge) external onlyRole(AUDITOR_ROLE) {
        uint256 cutoffTime = block.timestamp - maxAge;
        
        // Note: In a production system, this would need to be implemented
        // with pagination to avoid gas limit issues
        for (uint256 i = 0; i < auditLogCounter; i++) {
            if (auditLogs[i].timestamp < cutoffTime) {
                delete auditLogs[i];
                // Also clean up nullifier if needed
                delete nullifiers[auditLogs[i].nullifierHash];
            }
        }
    }
    
    /**
     * @dev Emergency pause function
     */
    function emergencyPause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        // Implementation would pause critical functions
        // This is a placeholder for emergency functionality
    }
}
