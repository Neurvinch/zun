import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
    Database, 
    Coins, 
    Vote, 
    TrendingUp, 
    Users, 
    FileText,
    Award,
    Shield,
    Upload,
    Download
} from 'lucide-react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import dataDAOService from '../../services/dataDAOService';
import './DataDAODashboard.css';

const DataDAODashboard = () => {
    const { address: userAddress } = useAccount();
    const publicClient = usePublicClient();
    const { data: walletClient } = useWalletClient();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    
    // State for different sections
    const [contributorStats, setContributorStats] = useState(null);
    const [daoStats, setDAOStats] = useState(null);
    const [proposals, setProposals] = useState([]);
    const [contributions, setContributions] = useState([]);
    
    // Form states
    const [dataContribution, setDataContribution] = useState({
        type: 'TRADING_DATA',
        data: '',
        description: ''
    });
    const [proposalForm, setProposalForm] = useState({
        title: '',
        description: ''
    });
    const [stakeAmount, setStakeAmount] = useState('');
    
    const dataTypes = [
        { value: 'TRADING_DATA', label: 'Trading Data', reward: '100 DATA' },
        { value: 'MARKET_SIGNALS', label: 'Market Signals', reward: '150 DATA' },
        { value: 'RISK_METRICS', label: 'Risk Metrics', reward: '120 DATA' },
        { value: 'COMPLIANCE_DATA', label: 'Compliance Data', reward: '200 DATA' },
        { value: 'ML_DATASET', label: 'ML Dataset', reward: '300 DATA' }
    ];
    
    useEffect(() => {
        if (publicClient && walletClient && userAddress) {
            initializeDataDAO();
        }
    }, [publicClient, walletClient, userAddress]);
    
    const initializeDataDAO = async () => {
        try {
            setLoading(true);
            
            // Initialize DataDAO service
            const initResult = await dataDAOService.initialize(publicClient, walletClient);
            if (!initResult.success) {
                throw new Error(initResult.error);
            }
            
            // Load initial data
            await loadProposals();
            
        } catch (error) {
            console.error('Failed to initialize DataDAO:', error);
        } finally {
            setLoading(false);
        }
    };
    
    
    const loadProposals = async () => {
        try {
            const result = await dataDAOService.getAllProposals();
            if (result.success) {
                setProposals(result.proposals);
            }
        } catch (error) {
            console.error('Failed to load proposals:', error);
        }
    };
    
    const handleDataContribution = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const parsedData = JSON.parse(dataContribution.data);
            const result = await dataDAOService.contributeData(dataContribution.type, parsedData);
            if (result.success) {
                alert(`Data contributed successfully! Tx: ${result.transactionHash}`);
                setDataContribution({ type: 'TRADING_DATA', data: '', description: '' });
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Failed to contribute data:', error);
            alert('Failed to contribute data: ' + error.message);
        } finally {
            setLoading(false);
        }
    };
    
    
    
    const handleCreateProposal = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const result = await dataDAOService.createProposal(proposalForm.title, proposalForm.description);
            if (result.success) {
                alert(`Proposal created successfully! Tx: ${result.transactionHash}`);
                setProposalForm({ title: '', description: '' });
                await loadProposals();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Failed to create proposal:', error);
            alert('Failed to create proposal: ' + error.message);
        } finally {
            setLoading(false);
        }
    };
    
    const handleVote = async (proposalId, support) => {
        try {
            setLoading(true);
            
            const result = await dataDAOService.voteOnProposal(proposalId, support);
            if (result.success) {
                alert(`Vote cast successfully! ${support ? 'YES' : 'NO'}`);
                await loadProposals();
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('Failed to vote:', error);
            alert('Failed to vote: ' + error.message);
        } finally {
            setLoading(false);
        }
    };
    
    if (loading && !contributorStats) {
        return (
            <div className="datadao-loading">
                <div className="loading-spinner"></div>
                <p>Loading DataDAO Dashboard...</p>
            </div>
        );
    }
    
    return (
        <div className="datadao-dashboard">
            <motion.div 
                className="datadao-header"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <div className="header-content">
                    <div className="title-section">
                        <Database className="header-icon" />
                        <div>
                            <h1>DataDAO Dashboard</h1>
                            <p>Contribute data, earn rewards, and participate in governance</p>
                        </div>
                    </div>
                    
                    {/* {contributorStats && (
                        <div className="stats-overview">
                            <div className="stat-card">
                                <Coins className="stat-icon" />
                                <div>
                                    <span className="stat-value">{contributorStats.dataCoinBalance}</span>
                                    <span className="stat-label">DATA Balance</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <Award className="stat-icon" />
                                <div>
                                    <span className="stat-value">{contributorStats.totalRewards}</span>
                                    <span className="stat-label">Total Rewards</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <Vote className="stat-icon" />
                                <div>
                                    <span className="stat-value">{contributorStats.votingPower}</span>
                                    <span className="stat-label">Voting Power</span>
                                </div>
                            </div>
                        </div>
                    )} */}
                </div>
            </motion.div>
            
            <div className="datadao-tabs">
                <button 
                    className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    <TrendingUp size={20} />
                    Overview
                </button>
                <button 
                    className={`tab-button ${activeTab === 'contribute' ? 'active' : ''}`}
                    onClick={() => setActiveTab('contribute')}
                >
                    <Upload size={20} />
                    Contribute Data
                </button>
                <button 
                    className={`tab-button ${activeTab === 'governance' ? 'active' : ''}`}
                    onClick={() => setActiveTab('governance')}
                >
                    <Vote size={20} />
                    Governance
                </button>
                <button 
                    className={`tab-button ${activeTab === 'rewards' ? 'active' : ''}`}
                    onClick={() => setActiveTab('rewards')}
                >
                    <Coins size={20} />
                    Rewards
                </button>
            </div>
            
            <div className="datadao-content">
                {activeTab === 'overview' && (
                    <motion.div 
                        className="overview-section"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="overview-grid">
                            <div className="overview-card">
                                <h3><Users className="card-icon" /> DAO Statistics</h3>
                                {/* {daoStats && (
                                    <div className="dao-stats">
                                        <div className="stat-row">
                                            <span>Total Contributions:</span>
                                            <span>{daoStats.totalContributions}</span>
                                        </div>
                                        <div className="stat-row">
                                            <span>Total Proposals:</span>
                                            <span>{daoStats.totalProposals}</span>
                                        </div>
                                        <div className="stat-row">
                                            <span>Total DATA Supply:</span>
                                            <span>{daoStats.totalDataCoins}</span>
                                        </div>
                                    </div>
                                )} */}
                            </div>
                            
                            <div className="overview-card">
                                <h3><Shield className="card-icon" /> Your Status</h3>
                                {/* {contributorStats && (
                                    <div className="contributor-status">
                                        <div className="status-item">
                                            <span className={`status-badge ${contributorStats.isVerified ? 'verified' : 'unverified'}`}>
                                                {contributorStats.isVerified ? 'Verified' : 'Unverified'}
                                            </span>
                                        </div>
                                        <div className="stat-row">
                                            <span>Staked Amount:</span>
                                            <span>{contributorStats.stakedAmount} DATA</span>
                                        </div>
                                        <div className="stat-row">
                                            <span>Pending Rewards:</span>
                                            <span>{contributorStats.totalRewards} DATA</span>
                                        </div>
                                    </div>
                                )} */}
                            </div>
                        </div>
                    </motion.div>
                )}
                
                {activeTab === 'contribute' && (
                    <motion.div 
                        className="contribute-section"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="contribute-grid">
                            <div className="contribute-form">
                                <h3>Contribute Data</h3>
                                <form onSubmit={handleDataContribution}>
                                    <div className="form-group">
                                        <label>Data Type</label>
                                        <select 
                                            value={dataContribution.type}
                                            onChange={(e) => setDataContribution({
                                                ...dataContribution,
                                                type: e.target.value
                                            })}
                                        >
                                            {dataTypes.map(type => (
                                                <option key={type.value} value={type.value}>
                                                    {type.label} (Reward: {type.reward})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    
                                    <div className="form-group">
                                        <label>Data (JSON Format)</label>
                                        <textarea
                                            value={dataContribution.data}
                                            onChange={(e) => setDataContribution({
                                                ...dataContribution,
                                                data: e.target.value
                                            })}
                                            placeholder='{"amount": 1000, "token": "ETH", "timestamp": 1640995200000}'
                                            rows={6}
                                            required
                                        />
                                    </div>
                                    
                                    <div className="form-group">
                                        <label>Description</label>
                                        <input
                                            type="text"
                                            value={dataContribution.description}
                                            onChange={(e) => setDataContribution({
                                                ...dataContribution,
                                                description: e.target.value
                                            })}
                                            placeholder="Brief description of the data"
                                        />
                                    </div>
                                    
                                    <button 
                                        type="submit" 
                                        className="submit-button"
                                        disabled={loading}
                                    >
                                        <Upload size={20} />
                                        {loading ? 'Contributing...' : 'Contribute Data'}
                                    </button>
                                </form>
                            </div>
                            
                            <div className="data-types-info">
                                <h3>Data Types & Rewards</h3>
                                <div className="data-types-list">
                                    {dataTypes.map(type => (
                                        <div key={type.value} className="data-type-card">
                                            <div className="type-header">
                                                <span className="type-name">{type.label}</span>
                                                <span className="type-reward">{type.reward}</span>
                                            </div>
                                            <div className="type-description">
                                                {type.value === 'TRADING_DATA' && 'Anonymized trading patterns and volume data'}
                                                {type.value === 'MARKET_SIGNALS' && 'Market sentiment and price prediction signals'}
                                                {type.value === 'RISK_METRICS' && 'Risk assessment and portfolio metrics'}
                                                {type.value === 'COMPLIANCE_DATA' && 'Regulatory compliance and audit data'}
                                                {type.value === 'ML_DATASET' && 'Machine learning training datasets'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
                
                {activeTab === 'governance' && (
                    <motion.div 
                        className="governance-section"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="governance-grid">
                            <div className="proposal-form">
                                <h3>Create Proposal</h3>
                                <form onSubmit={handleCreateProposal}>
                                    <div className="form-group">
                                        <label>Title</label>
                                        <input
                                            type="text"
                                            value={proposalForm.title}
                                            onChange={(e) => setProposalForm({
                                                ...proposalForm,
                                                title: e.target.value
                                            })}
                                            placeholder="Proposal title"
                                            required
                                        />
                                    </div>
                                    
                                    <div className="form-group">
                                        <label>Description</label>
                                        <textarea
                                            value={proposalForm.description}
                                            onChange={(e) => setProposalForm({
                                                ...proposalForm,
                                                description: e.target.value
                                            })}
                                            placeholder="Detailed proposal description"
                                            rows={4}
                                            required
                                        />
                                    </div>
                                    
                                    <button 
                                        type="submit" 
                                        className="submit-button"
                                        disabled={loading}
                                    >
                                        <FileText size={20} />
                                        {loading ? 'Creating...' : 'Create Proposal'}
                                    </button>
                                </form>
                            </div>
                            
                            <div className="stake-form">
                                <h3>Stake Tokens</h3>
                                <form onSubmit={handleStake}>
                                    <div className="form-group">
                                        <label>Amount (DATA)</label>
                                        <input
                                            type="number"
                                            value={stakeAmount}
                                            onChange={(e) => setStakeAmount(e.target.value)}
                                            placeholder="Amount to stake"
                                            step="0.01"
                                            min="0"
                                            required
                                        />
                                    </div>
                                    
                                    <button 
                                        type="submit" 
                                        className="submit-button"
                                        disabled={loading}
                                    >
                                        <Coins size={20} />
                                        {loading ? 'Staking...' : 'Stake Tokens'}
                                    </button>
                                </form>
                                
                                <div className="stake-info">
                                    <p>Staking DATA tokens gives you voting power in governance decisions.</p>
                                    <p>Minimum stake for creating proposals: 1,000 DATA</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="proposals-list">
                            <h3>Active Proposals</h3>
                            {proposals.length > 0 ? (
                                <div className="proposals-grid">
                                    {proposals.map(proposal => (
                                        <div key={proposal.id} className="proposal-card">
                                            <div className="proposal-header">
                                                <h4>{proposal.title}</h4>
                                                <span className={`proposal-status ${proposal.isActive ? 'active' : 'ended'}`}>
                                                    {proposal.isActive ? 'Active' : 'Ended'}
                                                </span>
                                            </div>
                                            
                                            <p className="proposal-description">{proposal.description}</p>
                                            
                                            <div className="proposal-votes">
                                                <div className="vote-bar">
                                                    <div className="vote-for" style={{
                                                        width: `${(parseFloat(proposal.forVotes) / (parseFloat(proposal.forVotes) + parseFloat(proposal.againstVotes)) * 100) || 0}%`
                                                    }}></div>
                                                </div>
                                                <div className="vote-stats">
                                                    <span>For: {proposal.forVotes} DATA</span>
                                                    <span>Against: {proposal.againstVotes} DATA</span>
                                                </div>
                                            </div>
                                            
                                            {proposal.isActive && (
                                                <div className="vote-buttons">
                                                    <button 
                                                        className="vote-yes"
                                                        onClick={() => handleVote(proposal.id, true)}
                                                        disabled={loading}
                                                    >
                                                        Vote Yes
                                                    </button>
                                                    <button 
                                                        className="vote-no"
                                                        onClick={() => handleVote(proposal.id, false)}
                                                        disabled={loading}
                                                    >
                                                        Vote No
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="no-proposals">No proposals available</p>
                            )}
                        </div>
                    </motion.div>
                )}
                
                {activeTab === 'rewards' && (
                    <motion.div 
                        className="rewards-section"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="rewards-grid">
                            <div className="rewards-summary">
                                <h3>Rewards Summary</h3>
                                {/* {contributorStats && (
                                    <div className="rewards-stats">
                                        <div className="reward-card">
                                            <div className="reward-amount">
                                                {contributorStats.totalRewards}
                                            </div>
                                            <div className="reward-label">Pending Rewards (DATA)</div>
                                            <button 
                                                className="claim-button"
                                                onClick={handleClaimRewards}
                                                disabled={loading || parseFloat(contributorStats.totalRewards) === 0}
                                            >
                                                <Download size={20} />
                                                Claim Rewards
                                            </button>
                                        </div>
                                        
                                        <div className="reward-breakdown">
                                            <h4>Reward Breakdown</h4>
                                            <div className="breakdown-item">
                                                <span>Data Contributions:</span>
                                                <span>{contributorStats.totalRewards} DATA</span>
                                            </div>
                                            <div className="breakdown-item">
                                                <span>Verification Bonus:</span>
                                                <span>{contributorStats.isVerified ? '+20%' : '0%'}</span>
                                            </div>
                                        </div>
                                    </div>
                                )} */}
                            </div>
                            
                            <div className="rewards-info">
                                <h3>How to Earn More</h3>
                                <div className="earning-tips">
                                    <div className="tip-card">
                                        <Upload className="tip-icon" />
                                        <div>
                                            <h4>Contribute Quality Data</h4>
                                            <p>Submit high-quality, anonymized datasets to earn DATA tokens</p>
                                        </div>
                                    </div>
                                    
                                    <div className="tip-card">
                                        <Shield className="tip-icon" />
                                        <div>
                                            <h4>Get Verified</h4>
                                            <p>Verified contributors earn 20% bonus on all rewards</p>
                                        </div>
                                    </div>
                                    
                                    <div className="tip-card">
                                        <TrendingUp className="tip-icon" />
                                        <div>
                                            <h4>Contribute Regularly</h4>
                                            <p>Regular contributors may receive additional bonuses</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default DataDAODashboard;
