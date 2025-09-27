import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import filecoinStorageService from '../services/filecoinStorageService';
import './FilecoinStorage.css';

const FilecoinStorage = ({ onStorageComplete, onRetrievalComplete, onError }) => {
    const { address, isConnected } = useAccount();

    const [isInitialized, setIsInitialized] = useState(false);
    const [storageStats, setStorageStats] = useState(null);
    const [userRecords, setUserRecords] = useState([]);
    const [activeTab, setActiveTab] = useState('store');

    const [storageType, setStorageType] = useState('receipt');
    const [dataToStore, setDataToStore] = useState('');
    const [encryptionKey, setEncryptionKey] = useState('');
    const [isStoring, setIsStoring] = useState(false);

    const [cidToRetrieve, setCidToRetrieve] = useState('');
    const [retrievalKey, setRetrievalKey] = useState('');
    const [isRetrieving, setIsRetrieving] = useState(false);
    const [retrievedData, setRetrievedData] = useState(null);

    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    useEffect(() => {
        const init = async () => {
            try {
                const ok = await filecoinStorageService.initialize();
                setIsInitialized(ok);
                if (ok && address) {
                    setUserRecords(filecoinStorageService.getUserStorageRecords(address));
                    setStorageStats(filecoinStorageService.getStorageStats(address));
                }
            } catch (e) {
                console.error(e);
                setError(`Storage initialization failed: ${e.message}`);
            }
        };
        init();
    }, [address]);

    useEffect(() => {
        if (isInitialized && address) {
            setUserRecords(filecoinStorageService.getUserStorageRecords(address));
            setStorageStats(filecoinStorageService.getStorageStats(address));
        }
    }, [address, isInitialized]);

    const storeData = async () => {
        if (!dataToStore || !encryptionKey || !address) {
            setError('Please fill all required fields');
            return;
        }
        setIsStoring(true);
        setError(null);
        setSuccessMessage(null);
        try {
            let parsed;
            try { parsed = JSON.parse(dataToStore); } catch { parsed = { content: dataToStore, type: 'text' }; }

            let result;
            if (storageType === 'receipt') {
                const mockReceipt = {
                    transactionHash: parsed.transactionHash || ethers.id(dataToStore),
                    blockNumber: parsed.blockNumber || Date.now(),
                    gasUsed: parsed.gasUsed || '21000',
                    status: parsed.status || 1,
                    chainId: parsed.chainId || 1,
                    ...parsed
                };
                result = await filecoinStorageService.storeTransactionReceipt(mockReceipt, address, encryptionKey);
            } else if (storageType === 'proof') {
                const mockProof = {
                    proof: parsed.proof || ['0x1234'],
                    publicSignals: parsed.publicSignals || ['0x5678'],
                    proofType: parsed.proofType || 'swap_eligibility',
                    ...parsed
                };
                result = await filecoinStorageService.storeZKProof(mockProof, address, encryptionKey);
            } else {
                const mockSwapData = {
                    fromToken: parsed.fromToken || ethers.ZeroAddress,
                    toToken: parsed.toToken || ethers.ZeroAddress,
                    fromAmount: parsed.fromAmount || '1000000000000000000',
                    toAmount: parsed.toAmount || '2000000000000000000',
                    ...parsed
                };
                result = await filecoinStorageService.storeSwapMetadata(mockSwapData, address, encryptionKey);
            }

            setSuccessMessage(`Data stored! CIDs: ${result.cids.join(', ')}`);
            setUserRecords(filecoinStorageService.getUserStorageRecords(address));
            setStorageStats(filecoinStorageService.getStorageStats(address));
            setDataToStore('');
            setEncryptionKey('');
            if (onStorageComplete) onStorageComplete(result);
        } catch (e) {
            console.error(e);
            setError(`Storage failed: ${e.message}`);
            if (onError) onError(e);
        } finally {
            setIsStoring(false);
        }
    };

    const retrieveData = async () => {
        if (!cidToRetrieve || !retrievalKey) {
            setError('Please provide CID and decryption key');
            return;
        }
        setIsRetrieving(true);
        setError(null);
        setRetrievedData(null);
        try {
            const result = await filecoinStorageService.retrieveData(cidToRetrieve, retrievalKey);
            setRetrievedData(result.data);
            setSuccessMessage('Data retrieved successfully!');
            if (onRetrievalComplete) onRetrievalComplete(result);
        } catch (e) {
            console.error(e);
            setError(`Retrieval failed: ${e.message}`);
            if (onError) onError(e);
        } finally {
            setIsRetrieving(false);
        }
    };

    const generateEncryptionKey = () => {
        const randomKey = ethers.hexlify(ethers.randomBytes(32));
        setEncryptionKey(randomKey);
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    };

    const formatTimestamp = (ts) => new Date(ts).toLocaleString();

    if (!isConnected) {
        return (
            <div className="filecoin-storage">
                <h3>Filecoin Storage</h3>
                <p>Please connect your wallet to use decentralized storage</p>
            </div>
        );
    }

    return (
        <div className="filecoin-storage">
            <div className="storage-header">
                <h3>📁 Filecoin Storage</h3>
                <div className="service-status">
                    {isInitialized ? (
                        <span className="status-ready">🟢 Ready</span>
                    ) : (
                        <span className="status-loading">🔄 Loading...</span>
                    )}
                </div>
            </div>

            {storageStats && (
                <div className="storage-stats">
                    <h4>Storage Statistics</h4>
                    <div className="stats-grid">
                        <div className="stat-item"><span className="label">Total Records:</span><span className="value">{storageStats.totalRecords}</span></div>
                        <div className="stat-item"><span className="label">Total Size:</span><span className="value">{formatFileSize(storageStats.totalSize)}</span></div>
                        <div className="stat-item"><span className="label">Receipts:</span><span className="value">{storageStats.byType?.transaction_receipt || 0}</span></div>
                        <div className="stat-item"><span className="label">ZK Proofs:</span><span className="value">{storageStats.byType?.zk_proof || 0}</span></div>
                    </div>
                </div>
            )}

            <div className="tab-navigation">
                <button onClick={() => setActiveTab('store')} className={`tab-button ${activeTab === 'store' ? 'active' : ''}`}>Store Data</button>
                <button onClick={() => setActiveTab('retrieve')} className={`tab-button ${activeTab === 'retrieve' ? 'active' : ''}`}>Retrieve Data</button>
                <button onClick={() => setActiveTab('records')} className={`tab-button ${activeTab === 'records' ? 'active' : ''}`}>My Records</button>
            </div>

            {activeTab === 'store' && (
                <div className="tab-content">
                    <h4>Store Data to Filecoin/IPFS</h4>
                    <div className="form-group">
                        <label>Data Type:</label>
                        <select value={storageType} onChange={(e) => setStorageType(e.target.value)}>
                            <option value="receipt">Transaction Receipt</option>
                            <option value="proof">ZK Proof</option>
                            <option value="metadata">Swap Metadata</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Data to Store (JSON format):</label>
                        <textarea value={dataToStore} onChange={(e) => setDataToStore(e.target.value)} rows={8} placeholder={`Enter ${storageType} data in JSON format...`} />
                    </div>
                    <div className="form-group">
                        <label>Encryption Key:</label>
                        <div className="key-input-group">
                            <input type="password" value={encryptionKey} onChange={(e) => setEncryptionKey(e.target.value)} placeholder="Enter encryption key (keep this safe!)" />
                            <button onClick={generateEncryptionKey} className="generate-key-btn">Generate Random Key</button>
                        </div>
                    </div>
                    <div className="action-buttons">
                        <button onClick={storeData} disabled={!dataToStore || !encryptionKey || isStoring} className="store-btn">{isStoring ? 'Storing...' : 'Store to Filecoin'}</button>
                    </div>
                </div>
            )}

            {activeTab === 'retrieve' && (
                <div className="tab-content">
                    <h4>Retrieve Data from Filecoin/IPFS</h4>
                    <div className="form-group">
                        <label>Content ID (CID):</label>
                        <input type="text" value={cidToRetrieve} onChange={(e) => setCidToRetrieve(e.target.value)} placeholder="Enter IPFS CID (e.g., Qm...)" />
                    </div>
                    <div className="form-group">
                        <label>Decryption Key:</label>
                        <input type="password" value={retrievalKey} onChange={(e) => setRetrievalKey(e.target.value)} placeholder="Enter decryption key" />
                    </div>
                    <div className="action-buttons">
                        <button onClick={retrieveData} disabled={!cidToRetrieve || !retrievalKey || isRetrieving} className="retrieve-btn">{isRetrieving ? 'Retrieving...' : 'Retrieve Data'}</button>
                    </div>
                    {retrievedData && (
                        <div className="retrieved-data">
                            <h5>Retrieved Data:</h5>
                            <pre className="data-display">{JSON.stringify(retrievedData, null, 2)}</pre>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'records' && (
                <div className="tab-content">
                    <h4>My Storage Records</h4>
                    {userRecords.length === 0 ? (
                        <div className="no-records"><p>No storage records found. Start by storing some data!</p></div>
                    ) : (
                        <div className="records-list">
                            {userRecords.map((record, idx) => (
                                <div key={idx} className="record-item">
                                    <div className="record-header">
                                        <span className="record-type">{record.type}</span>
                                        <span className="record-timestamp">{formatTimestamp(record.timestamp)}</span>
                                    </div>
                                    <div className="record-details">
                                        <div className="detail-item">
                                            <span className="label">CIDs:</span>
                                            <div className="cid-list">
                                                {record.cids.map((cid, i) => (
                                                    <span key={i} className="cid-item">{cid.substring(0, 20)}...</span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="detail-item"><span className="label">Providers:</span><span className="value">{record.providers.join(', ')}</span></div>
                                        <div className="detail-item"><span className="label">Size:</span><span className="value">{formatFileSize(record.size || 0)}</span></div>
                                        {record.transactionHash && (
                                            <div className="detail-item"><span className="label">Tx Hash:</span><span className="value">{record.transactionHash}</span></div>
                                        )}
                                    </div>
                                    <div className="record-actions">
                                        <button onClick={() => { setCidToRetrieve(record.cids[0]); setActiveTab('retrieve'); }} className="quick-retrieve-btn">Quick Retrieve</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {successMessage && (
                <div className="success-section">
                    <p className="success-message">{successMessage}</p>
                    <button onClick={() => setSuccessMessage(null)} className="dismiss-button">Dismiss</button>
                </div>
            )}

            {error && (
                <div className="error-section">
                    <h4>Error</h4>
                    <p className="error-message">{error}</p>
                    <button onClick={() => setError(null)} className="dismiss-button">Dismiss</button>
                </div>
            )}
        </div>
    );
};

export default FilecoinStorage;
