import React, { useState, useEffect } from 'react';
import { useAccount, useSigner } from 'wagmi';
import { ethers } from 'ethers';
import SynapseService from '../services/synapseService';
import './SynapseStorage.css';

const SynapseStorage = () => {
    const { address, isConnected } = useAccount();
    const { data: signer } = useSigner();
    
    const [synapseService, setSynapseService] = useState(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // Storage state
    const [uploadData, setUploadData] = useState('');
    const [uploadCategory, setUploadCategory] = useState('SWAP_RECEIPTS');
    const [uploadFilename, setUploadFilename] = useState('');
    const [uploadResult, setUploadResult] = useState(null);
    
    // Download state
    const [downloadCid, setDownloadCid] = useState('');
    const [downloadToken, setDownloadToken] = useState('');
    const [downloadResult, setDownloadResult] = useState(null);
    
    // Storage stats
    const [storageStats, setStorageStats] = useState(null);
    const [networkStatus, setNetworkStatus] = useState(null);
    const [usdcfBalance, setUsdcfBalance] = useState(null);
    const [storedFiles, setStoredFiles] = useState([]);
    const [paymentHistory, setPaymentHistory] = useState([]);
    
    // Subscription state
    const [subscriptionPlan, setSubscriptionPlan] = useState('basic');
    const [subscriptionDuration, setSubscriptionDuration] = useState(12);
    const [subscriptionResult, setSubscriptionResult] = useState(null);

    useEffect(() => {
        if (isConnected && signer && !isInitialized) {
            initializeSynapse();
        }
    }, [isConnected, signer, isInitialized]);

    const initializeSynapse = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const service = new SynapseService();
            const provider = signer.provider;
            
            const result = await service.initialize(provider, signer);
            
            if (result.success) {
                setSynapseService(service);
                setIsInitialized(true);
                
                // Load initial data
                await loadInitialData(service);
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const loadInitialData = async (service) => {
        try {
            // Load storage stats
            const stats = await service.synapseClient.network.getStorageStats();
            if (stats.success) setStorageStats(stats);
            
            // Load network status
            const status = await service.synapseClient.network.getStatus();
            if (status.success) setNetworkStatus(status);
            
            // Load USDFC balance
            const balance = await service.synapseClient.payments.getBalance(address);
            if (balance.success) setUsdcfBalance(balance);
            
            // Load stored files
            const files = await service.synapseClient.storage.list();
            if (files.success) setStoredFiles(files.files);
            
            // Load payment history
            const payments = service.getPaymentHistory();
            setPaymentHistory(payments);
            
        } catch (err) {
            console.error('Failed to load initial data:', err);
        }
    };

    const handleUpload = async () => {
        if (!synapseService || !uploadData || !uploadFilename) {
            setError('Please fill in all upload fields');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            
            // Parse upload data as JSON if possible
            let dataToUpload;
            try {
                dataToUpload = JSON.parse(uploadData);
            } catch {
                dataToUpload = { content: uploadData };
            }
            
            const result = await synapseService.synapseClient.storage.upload(
                dataToUpload,
                uploadCategory,
                uploadFilename,
                { 
                    uploader: address,
                    uploadType: 'manual',
                    description: 'Uploaded via ZKVault interface'
                }
            );
            
            if (result.success) {
                setUploadResult(result);
                setUploadData('');
                setUploadFilename('');
                
                // Refresh stored files list
                const files = await synapseService.synapseClient.storage.list();
                if (files.success) setStoredFiles(files.files);
                
                // Refresh payment history
                const payments = synapseService.getPaymentHistory();
                setPaymentHistory(payments);
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        if (!synapseService || !downloadCid) {
            setError('Please enter a CID to download');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            
            const result = await synapseService.synapseClient.storage.download(
                downloadCid,
                downloadToken || 'mock_token'
            );
            
            if (result.success) {
                setDownloadResult(result);
                setDownloadCid('');
                setDownloadToken('');
                
                // Refresh payment history
                const payments = synapseService.getPaymentHistory();
                setPaymentHistory(payments);
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubscribe = async () => {
        if (!synapseService) {
            setError('Synapse service not initialized');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            
            const result = await synapseService.subscribeToStorage(
                subscriptionPlan,
                subscriptionDuration
            );
            
            if (result.success) {
                setSubscriptionResult(result);
                
                // Refresh payment history
                const payments = synapseService.getPaymentHistory();
                setPaymentHistory(payments);
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const estimateUploadFee = async () => {
        if (!synapseService || !uploadData) return null;
        
        try {
            let dataToEstimate;
            try {
                dataToEstimate = JSON.parse(uploadData);
            } catch {
                dataToEstimate = { content: uploadData };
            }
            
            const estimate = await synapseService.estimateStorageFee(dataToEstimate);
            return estimate.success ? estimate : null;
        } catch {
            return null;
        }
    };

    if (!isConnected) {
        return (
            <div className="synapse-storage">
                <div className="synapse-header">
                    <h2>Synapse Filecoin Storage</h2>
                    <p>Please connect your wallet to use Filecoin warm storage</p>
                </div>
            </div>
        );
    }

    return (
        <div className="synapse-storage">
            <div className="synapse-header">
                <h2>Synapse Filecoin Storage</h2>
                <p>Decentralized warm storage with USDFC payments</p>
                
                {error && (
                    <div className="error-message">
                        <span>⚠️ {error}</span>
                        <button onClick={() => setError(null)}>×</button>
                    </div>
                )}
            </div>

            {/* Status Dashboard */}
            <div className="status-dashboard">
                <div className="status-card">
                    <h3>Network Status</h3>
                    {networkStatus ? (
                        <div className="status-info">
                            <p><strong>Network:</strong> {networkStatus.network}</p>
                            <p><strong>Status:</strong> 
                                <span className={`status-badge ${networkStatus.status}`}>
                                    {networkStatus.status}
                                </span>
                            </p>
                            <p><strong>Block Height:</strong> {networkStatus.blockHeight?.toLocaleString()}</p>
                            <p><strong>Storage Providers:</strong> {networkStatus.storageProviders}</p>
                        </div>
                    ) : (
                        <p>Loading...</p>
                    )}
                </div>

                <div className="status-card">
                    <h3>USDFC Balance</h3>
                    {usdcfBalance ? (
                        <div className="balance-info">
                            <p className="balance-amount">{usdcfBalance.balance} USDFC</p>
                            <p className="balance-address">{usdcfBalance.address?.substring(0, 10)}...</p>
                        </div>
                    ) : (
                        <p>Loading...</p>
                    )}
                </div>

                <div className="status-card">
                    <h3>Storage Stats</h3>
                    {storageStats ? (
                        <div className="stats-info">
                            <p><strong>Files Stored:</strong> {storageStats.totalFilesStored}</p>
                            <p><strong>Storage Used:</strong> {storageStats.totalStorageUsed}</p>
                            <p><strong>Total Fees:</strong> {storageStats.totalStorageFees}</p>
                            <p><strong>Retrievals:</strong> {storageStats.totalRetrievals}</p>
                        </div>
                    ) : (
                        <p>Loading...</p>
                    )}
                </div>
            </div>

            {/* Upload Section */}
            <div className="storage-section">
                <h3>Upload to Warm Storage</h3>
                <div className="upload-form">
                    <div className="form-group">
                        <label>Data to Upload (JSON format recommended):</label>
                        <textarea
                            value={uploadData}
                            onChange={(e) => setUploadData(e.target.value)}
                            placeholder='{"example": "data", "swap": {"amount": 100, "token": "ETH"}}'
                            rows={4}
                        />
                    </div>
                    
                    <div className="form-row">
                        <div className="form-group">
                            <label>Category:</label>
                            <select
                                value={uploadCategory}
                                onChange={(e) => setUploadCategory(e.target.value)}
                            >
                                <option value="SWAP_RECEIPTS">Swap Receipts</option>
                                <option value="ML_DATASETS">ML Datasets</option>
                                <option value="ANALYTICS_DATA">Analytics Data</option>
                                <option value="GOVERNANCE_DATA">Governance Data</option>
                                <option value="AUDIT_LOGS">Audit Logs</option>
                                <option value="USER_DATA">User Data</option>
                            </select>
                        </div>
                        
                        <div className="form-group">
                            <label>Filename:</label>
                            <input
                                type="text"
                                value={uploadFilename}
                                onChange={(e) => setUploadFilename(e.target.value)}
                                placeholder="my-data.json"
                            />
                        </div>
                    </div>
                    
                    <button
                        onClick={handleUpload}
                        disabled={loading || !uploadData || !uploadFilename}
                        className="action-button"
                    >
                        {loading ? 'Uploading...' : 'Upload to Filecoin'}
                    </button>
                </div>

                {uploadResult && (
                    <div className="result-card success">
                        <h4>Upload Successful!</h4>
                        <p><strong>CID:</strong> {uploadResult.cid}</p>
                        <p><strong>Filename:</strong> {uploadResult.filename}</p>
                        <p><strong>Size:</strong> {uploadResult.size} bytes</p>
                        <p><strong>Storage Fee:</strong> {uploadResult.storageFee} USDFC</p>
                        <p><strong>Payment Tx:</strong> {uploadResult.paymentTx}</p>
                        <div className="retrieval-info">
                            <p><strong>Retrieval URL:</strong></p>
                            <code>{uploadResult.retrievalInfo?.retrievalUrl}</code>
                        </div>
                    </div>
                )}
            </div>

            {/* Download Section */}
            <div className="storage-section">
                <h3>Download from Warm Storage</h3>
                <div className="download-form">
                    <div className="form-row">
                        <div className="form-group">
                            <label>Content ID (CID):</label>
                            <input
                                type="text"
                                value={downloadCid}
                                onChange={(e) => setDownloadCid(e.target.value)}
                                placeholder="bafybei..."
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>Access Token (optional):</label>
                            <input
                                type="text"
                                value={downloadToken}
                                onChange={(e) => setDownloadToken(e.target.value)}
                                placeholder="synapse_..."
                            />
                        </div>
                    </div>
                    
                    <button
                        onClick={handleDownload}
                        disabled={loading || !downloadCid}
                        className="action-button"
                    >
                        {loading ? 'Downloading...' : 'Download from Filecoin'}
                    </button>
                </div>

                {downloadResult && (
                    <div className="result-card success">
                        <h4>Download Successful!</h4>
                        <p><strong>CID:</strong> {downloadResult.cid}</p>
                        <p><strong>Retrieval Fee:</strong> {downloadResult.retrievalFee} USDFC</p>
                        <p><strong>Payment Tx:</strong> {downloadResult.paymentTx}</p>
                        <div className="data-preview">
                            <h5>Downloaded Data:</h5>
                            <pre>{JSON.stringify(downloadResult.data, null, 2)}</pre>
                        </div>
                        {downloadResult.metadata && (
                            <div className="metadata-info">
                                <h5>Metadata:</h5>
                                <pre>{JSON.stringify(downloadResult.metadata, null, 2)}</pre>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Subscription Section */}
            <div className="storage-section">
                <h3>Storage Subscription</h3>
                <div className="subscription-form">
                    <div className="form-row">
                        <div className="form-group">
                            <label>Plan:</label>
                            <select
                                value={subscriptionPlan}
                                onChange={(e) => setSubscriptionPlan(e.target.value)}
                            >
                                <option value="basic">Basic - $5/month (10GB)</option>
                                <option value="premium">Premium - $15/month (50GB)</option>
                                <option value="enterprise">Enterprise - $50/month (200GB)</option>
                            </select>
                        </div>
                        
                        <div className="form-group">
                            <label>Duration (months):</label>
                            <input
                                type="number"
                                value={subscriptionDuration}
                                onChange={(e) => setSubscriptionDuration(parseInt(e.target.value))}
                                min="1"
                                max="36"
                            />
                        </div>
                    </div>
                    
                    <button
                        onClick={handleSubscribe}
                        disabled={loading}
                        className="action-button"
                    >
                        {loading ? 'Processing...' : 'Subscribe with USDFC'}
                    </button>
                </div>

                {subscriptionResult && (
                    <div className="result-card success">
                        <h4>Subscription Successful!</h4>
                        <p><strong>Plan:</strong> {subscriptionResult.plan}</p>
                        <p><strong>Duration:</strong> {subscriptionResult.duration} months</p>
                        <p><strong>Total Amount:</strong> {subscriptionResult.totalAmount} USDFC</p>
                        <p><strong>Storage Allowance:</strong> {subscriptionResult.storageAllowance}</p>
                        <p><strong>Expires:</strong> {new Date(subscriptionResult.expiresAt).toLocaleDateString()}</p>
                        <p><strong>Payment Tx:</strong> {subscriptionResult.paymentTx}</p>
                    </div>
                )}
            </div>

            {/* Stored Files */}
            <div className="storage-section">
                <h3>Your Stored Files</h3>
                {storedFiles.length > 0 ? (
                    <div className="files-list">
                        {storedFiles.map((file, index) => (
                            <div key={index} className="file-item">
                                <div className="file-info">
                                    <h4>{file.filename}</h4>
                                    <p><strong>CID:</strong> {file.cid}</p>
                                    <p><strong>Category:</strong> {file.category}</p>
                                    <p><strong>Size:</strong> {file.size} bytes</p>
                                    <p><strong>Uploaded:</strong> {new Date(file.uploadedAt).toLocaleDateString()}</p>
                                    <p><strong>Storage Fee:</strong> {file.storageFee} USDFC</p>
                                </div>
                                <div className="file-actions">
                                    <button
                                        onClick={() => setDownloadCid(file.cid)}
                                        className="secondary-button"
                                    >
                                        Download
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p>No files stored yet</p>
                )}
            </div>

            {/* Payment History */}
            <div className="storage-section">
                <h3>Payment History</h3>
                {paymentHistory.length > 0 ? (
                    <div className="payments-list">
                        {paymentHistory.slice(-5).reverse().map((payment, index) => (
                            <div key={index} className="payment-item">
                                <div className="payment-info">
                                    <p><strong>Type:</strong> {payment.paymentType}</p>
                                    <p><strong>Amount:</strong> {payment.amount} USDFC</p>
                                    <p><strong>Date:</strong> {new Date(payment.timestamp).toLocaleString()}</p>
                                    <p><strong>Tx Hash:</strong> {payment.transactionHash?.substring(0, 20)}...</p>
                                    {payment.metadata && (
                                        <p><strong>Details:</strong> {JSON.stringify(payment.metadata)}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p>No payments yet</p>
                )}
            </div>
        </div>
    );
};

export default SynapseStorage;
