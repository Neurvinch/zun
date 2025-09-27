import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import filecoinStorageService from '../services/filecoinStorageService';
import './ReceiptManager.css';

const ReceiptManager = ({ onReceiptLoad, onError }) => {
    const { address, chain, isConnected } = useAccount();
    
    // State management
    const [isInitialized, setIsInitialized] = useState(false);
    const [receipts, setReceipts] = useState([]);
    const [filteredReceipts, setFilteredReceipts] = useState([]);
    const [activeTab, setActiveTab] = useState('all');
    
    // Search and filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [sortBy, setSortBy] = useState('timestamp');
    const [sortOrder, setSortOrder] = useState('desc');
    
    // Decryption state
    const [decryptionKeys, setDecryptionKeys] = useState({});
    const [decryptedData, setDecryptedData] = useState({});
    const [isDecrypting, setIsDecrypting] = useState({});
    
    // UI state
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const [showDecryptModal, setShowDecryptModal] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // Initialize service and load receipts
    useEffect(() => {
        const initializeService = async () => {
            if (!isConnected || !address) return;

            try {
                const initialized = await filecoinStorageService.initialize();
                setIsInitialized(initialized);
                
                if (initialized) {
                    await loadUserReceipts();
                }
                
            } catch (error) {
                console.error('Receipt manager initialization failed:', error);
                setError(`Initialization failed: ${error.message}`);
            }
        };

        initializeService();
    }, [isConnected, address]);

    // Load user's stored receipts
    const loadUserReceipts = async () => {
        try {
            const records = filecoinStorageService.getUserStorageRecords(address);
            const receiptRecords = records.filter(record => 
                record.type === 'transaction_receipt' || 
                record.type === 'zk_proof' || 
                record.type === 'swap_metadata'
            );
            
            setReceipts(receiptRecords);
            setFilteredReceipts(receiptRecords);
            
        } catch (error) {
            console.error('Failed to load receipts:', error);
            setError(`Failed to load receipts: ${error.message}`);
        }
    };

    // Filter and search receipts
    useEffect(() => {
        let filtered = [...receipts];

        // Apply type filter
        if (typeFilter !== 'all') {
            filtered = filtered.filter(receipt => receipt.type === typeFilter);
        }

        // Apply date filter
        if (dateFilter !== 'all') {
            const now = Date.now();
            const filterTime = {
                'today': 24 * 60 * 60 * 1000,
                'week': 7 * 24 * 60 * 60 * 1000,
                'month': 30 * 24 * 60 * 60 * 1000
            };
            
            if (filterTime[dateFilter]) {
                filtered = filtered.filter(receipt => 
                    now - receipt.timestamp < filterTime[dateFilter]
                );
            }
        }

        // Apply search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(receipt => 
                receipt.type.toLowerCase().includes(query) ||
                receipt.transactionHash?.toLowerCase().includes(query) ||
                receipt.cids.some(cid => cid.toLowerCase().includes(query))
            );
        }

        // Apply sorting
        filtered.sort((a, b) => {
            let aValue = a[sortBy];
            let bValue = b[sortBy];
            
            if (sortBy === 'timestamp') {
                aValue = new Date(aValue);
                bValue = new Date(bValue);
            }
            
            if (sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        setFilteredReceipts(filtered);
    }, [receipts, typeFilter, dateFilter, searchQuery, sortBy, sortOrder]);

    // Decrypt receipt data
    const decryptReceipt = async (receipt, decryptionKey) => {
        if (!decryptionKey) {
            setError('Please provide decryption key');
            return;
        }

        const receiptId = receipt.cids[0];
        setIsDecrypting(prev => ({ ...prev, [receiptId]: true }));
        setError(null);

        try {
            const result = await filecoinStorageService.retrieveData(receipt.cids[0], decryptionKey);
            
            setDecryptedData(prev => ({
                ...prev,
                [receiptId]: result.data
            }));
            
            setDecryptionKeys(prev => ({
                ...prev,
                [receiptId]: decryptionKey
            }));
            
            setSuccessMessage('Receipt decrypted successfully!');
            
            if (onReceiptLoad) {
                onReceiptLoad({
                    receipt: receipt,
                    decryptedData: result.data,
                    cid: receipt.cids[0]
                });
            }

        } catch (error) {
            console.error('Decryption failed:', error);
            setError(`Decryption failed: ${error.message}`);
            
            if (onError) {
                onError(error);
            }
        } finally {
            setIsDecrypting(prev => ({ ...prev, [receiptId]: false }));
        }
    };

    // Auto-decrypt with stored key
    const autoDecrypt = async (receipt) => {
        const receiptId = receipt.cids[0];
        const storedKey = decryptionKeys[receiptId];
        
        if (storedKey && !decryptedData[receiptId]) {
            await decryptReceipt(receipt, storedKey);
        }
    };

    // Format timestamp
    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleString();
    };

    // Format file size
    const formatFileSize = (bytes) => {
        if (!bytes) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    };

    // Get receipt type icon
    const getReceiptIcon = (type) => {
        const icons = {
            'transaction_receipt': '🧾',
            'zk_proof': '🔐',
            'swap_metadata': '🔄'
        };
        return icons[type] || '📄';
    };

    // Get receipt type color
    const getReceiptColor = (type) => {
        const colors = {
            'transaction_receipt': '#3b82f6',
            'zk_proof': '#8b5cf6',
            'swap_metadata': '#22c55e'
        };
        return colors[type] || '#64748b';
    };

    if (!isConnected) {
        return (
            <div className="receipt-manager">
                <h3>Receipt Manager</h3>
                <p>Please connect your wallet to view your receipts</p>
            </div>
        );
    }

    return (
        <div className="receipt-manager">
            <div className="manager-header">
                <h3>📋 Receipt Manager</h3>
                <div className="service-status">
                    {isInitialized ? (
                        <span className="status-ready">🟢 Ready</span>
                    ) : (
                        <span className="status-loading">🔄 Loading...</span>
                    )}
                </div>
            </div>

            {/* Statistics */}
            <div className="receipt-stats">
                <div className="stat-card">
                    <span className="stat-number">{receipts.length}</span>
                    <span className="stat-label">Total Receipts</span>
                </div>
                <div className="stat-card">
                    <span className="stat-number">
                        {receipts.filter(r => r.type === 'transaction_receipt').length}
                    </span>
                    <span className="stat-label">Transactions</span>
                </div>
                <div className="stat-card">
                    <span className="stat-number">
                        {receipts.filter(r => r.type === 'zk_proof').length}
                    </span>
                    <span className="stat-label">ZK Proofs</span>
                </div>
                <div className="stat-card">
                    <span className="stat-number">
                        {Object.keys(decryptedData).length}
                    </span>
                    <span className="stat-label">Decrypted</span>
                </div>
            </div>

            {/* Filters and Search */}
            <div className="receipt-controls">
                <div className="search-section">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search receipts..."
                        className="search-input"
                    />
                </div>
                
                <div className="filter-section">
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="filter-select"
                    >
                        <option value="all">All Types</option>
                        <option value="transaction_receipt">Transaction Receipts</option>
                        <option value="zk_proof">ZK Proofs</option>
                        <option value="swap_metadata">Swap Metadata</option>
                    </select>
                    
                    <select
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="filter-select"
                    >
                        <option value="all">All Time</option>
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                    </select>
                    
                    <select
                        value={`${sortBy}-${sortOrder}`}
                        onChange={(e) => {
                            const [field, order] = e.target.value.split('-');
                            setSortBy(field);
                            setSortOrder(order);
                        }}
                        className="filter-select"
                    >
                        <option value="timestamp-desc">Newest First</option>
                        <option value="timestamp-asc">Oldest First</option>
                        <option value="type-asc">Type A-Z</option>
                        <option value="size-desc">Largest First</option>
                    </select>
                </div>
            </div>

            {/* Receipt List */}
            <div className="receipt-list">
                {filteredReceipts.length === 0 ? (
                    <div className="no-receipts">
                        <p>No receipts found matching your criteria</p>
                        <button onClick={loadUserReceipts} className="refresh-btn">
                            Refresh
                        </button>
                    </div>
                ) : (
                    filteredReceipts.map((receipt, index) => {
                        const receiptId = receipt.cids[0];
                        const isDecrypted = !!decryptedData[receiptId];
                        const isDecryptingThis = isDecrypting[receiptId];
                        
                        return (
                            <div key={index} className="receipt-item">
                                <div className="receipt-header">
                                    <div className="receipt-type">
                                        <span className="receipt-icon">
                                            {getReceiptIcon(receipt.type)}
                                        </span>
                                        <span 
                                            className="receipt-type-label"
                                            style={{ color: getReceiptColor(receipt.type) }}
                                        >
                                            {receipt.type.replace('_', ' ').toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="receipt-timestamp">
                                        {formatTimestamp(receipt.timestamp)}
                                    </div>
                                </div>

                                <div className="receipt-details">
                                    <div className="detail-row">
                                        <span className="detail-label">CID:</span>
                                        <span className="detail-value cid-value">
                                            {receiptId.substring(0, 20)}...
                                        </span>
                                    </div>
                                    
                                    <div className="detail-row">
                                        <span className="detail-label">Size:</span>
                                        <span className="detail-value">
                                            {formatFileSize(receipt.size)}
                                        </span>
                                    </div>
                                    
                                    <div className="detail-row">
                                        <span className="detail-label">Providers:</span>
                                        <span className="detail-value">
                                            {receipt.providers.join(', ')}
                                        </span>
                                    </div>
                                    
                                    {receipt.transactionHash && (
                                        <div className="detail-row">
                                            <span className="detail-label">Tx Hash:</span>
                                            <span className="detail-value tx-hash">
                                                {receipt.transactionHash.substring(0, 20)}...
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="receipt-actions">
                                    {!isDecrypted ? (
                                        <button
                                            onClick={() => {
                                                setSelectedReceipt(receipt);
                                                setShowDecryptModal(true);
                                            }}
                                            disabled={isDecryptingThis}
                                            className="decrypt-btn"
                                        >
                                            {isDecryptingThis ? 'Decrypting...' : 'Decrypt'}
                                        </button>
                                    ) : (
                                        <div className="decrypted-actions">
                                            <span className="decrypted-indicator">✅ Decrypted</span>
                                            <button
                                                onClick={() => setSelectedReceipt(receipt)}
                                                className="view-btn"
                                            >
                                                View Data
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Decrypted Data Preview */}
                                {isDecrypted && selectedReceipt?.cids[0] === receiptId && (
                                    <div className="decrypted-preview">
                                        <h5>Decrypted Data:</h5>
                                        <pre className="data-preview">
                                            {JSON.stringify(decryptedData[receiptId], null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Decrypt Modal */}
            {showDecryptModal && selectedReceipt && (
                <div className="modal-overlay">
                    <div className="decrypt-modal">
                        <div className="modal-header">
                            <h4>Decrypt Receipt</h4>
                            <button
                                onClick={() => setShowDecryptModal(false)}
                                className="close-btn"
                            >
                                ×
                            </button>
                        </div>
                        
                        <div className="modal-content">
                            <div className="receipt-info">
                                <p><strong>Type:</strong> {selectedReceipt.type}</p>
                                <p><strong>CID:</strong> {selectedReceipt.cids[0]}</p>
                                <p><strong>Date:</strong> {formatTimestamp(selectedReceipt.timestamp)}</p>
                            </div>
                            
                            <div className="decrypt-form">
                                <label>Decryption Key:</label>
                                <input
                                    type="password"
                                    placeholder="Enter your decryption key"
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            decryptReceipt(selectedReceipt, e.target.value);
                                            setShowDecryptModal(false);
                                        }
                                    }}
                                    className="key-input"
                                    autoFocus
                                />
                            </div>
                        </div>
                        
                        <div className="modal-actions">
                            <button
                                onClick={() => setShowDecryptModal(false)}
                                className="cancel-btn"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    const keyInput = document.querySelector('.key-input');
                                    if (keyInput.value) {
                                        decryptReceipt(selectedReceipt, keyInput.value);
                                        setShowDecryptModal(false);
                                    }
                                }}
                                className="decrypt-confirm-btn"
                            >
                                Decrypt
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Message */}
            {successMessage && (
                <div className="success-section">
                    <p className="success-message">{successMessage}</p>
                    <button onClick={() => setSuccessMessage(null)} className="dismiss-button">
                        Dismiss
                    </button>
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="error-section">
                    <h4>Error</h4>
                    <p className="error-message">{error}</p>
                    <button onClick={() => setError(null)} className="dismiss-button">
                        Dismiss
                    </button>
                </div>
            )}
        </div>
    );
};

export default ReceiptManager;
