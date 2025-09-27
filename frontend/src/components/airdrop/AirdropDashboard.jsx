import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
    Gift, 
    Shield, 
    Star, 
    Trophy, 
    Clock, 
    Users, 
    CheckCircle,
    AlertCircle,
    XCircle,
    Coins,
    Award,
    Target,
    TrendingUp,
    Calendar,
    Percent
} from 'lucide-react';
import AirdropGatingService from '../../services/airdrop/airdropGatingService';
import './AirdropDashboard.css';

const AirdropDashboard = ({ provider, signer, userAddress }) => {
    const [airdropService] = useState(() => new AirdropGatingService());
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('campaigns');
    
    // State for different sections
    const [activeCampaigns, setActiveCampaigns] = useState([]);
    const [claimedCampaigns, setClaimedCampaigns] = useState([]);
    const [userReputation, setUserReputation] = useState(null);
    const [eligibilityResults, setEligibilityResults] = useState({});
    
    // Campaign creation form (for demo purposes)
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [createForm, setCreateForm] = useState({
        name: '',
        description: '',
        airdropType: 'TOKEN',
        rewardAmount: '',
        totalSupply: '',
        duration: 7 // days
    });
    
    const airdropTypes = [
        { value: 'TOKEN', label: 'Token Reward', icon: Coins, description: 'ERC20 token rewards' },
        { value: 'NFT', label: 'NFT Reward', icon: Award, description: 'Unique NFT collectibles' },
        { value: 'SBT', label: 'Soul Bound Token', icon: Shield, description: 'Non-transferable credentials' },
        { value: 'REPUTATION_POINTS', label: 'Reputation Points', icon: Star, description: 'Platform reputation score' }
    ];
    
    const reputationLevels = [
        { level: 'Newcomer', minScore: 0, color: '#6b7280', icon: Users },
        { level: 'Beginner', minScore: 50, color: '#84cc16', icon: Target },
        { level: 'Intermediate', minScore: 200, color: '#3b82f6', icon: TrendingUp },
        { level: 'Advanced', minScore: 400, color: '#8b5cf6', icon: Award },
        { level: 'Expert', minScore: 600, color: '#f59e0b', icon: Trophy },
        { level: 'Legend', minScore: 800, color: '#ef4444', icon: Star }
    ];
    
    useEffect(() => {
        if (provider && signer && userAddress) {
            initializeAirdrop();
        }
    }, [provider, signer, userAddress]);
    
    const initializeAirdrop = async () => {
        try {
            setLoading(true);
            
            // Initialize airdrop service
            const initResult = await airdropService.initialize(provider, signer);
            if (!initResult.success) {
                throw new Error(initResult.error);
            }
            
            // Load initial data
            await Promise.all([
                loadActiveCampaigns(),
                loadClaimedCampaigns(),
                loadUserReputation()
            ]);
            
        } catch (error) {
            console.error('Failed to initialize airdrop dashboard:', error);
        } finally {
            setLoading(false);
        }
    };
    
    const loadActiveCampaigns = async () => {
        try {
            const result = await airdropService.getActiveCampaigns();
            if (result.success) {
                setActiveCampaigns(result.campaigns);
                
                // Check eligibility for each campaign
                const eligibilityPromises = result.campaigns.map(async (campaign) => {
                    const eligibilityResult = await airdropService.checkEligibility(
                        userAddress,
                        campaign.id
                    );
                    return { campaignId: campaign.id, ...eligibilityResult };
                });
                
                const eligibilityResults = await Promise.all(eligibilityPromises);
                const eligibilityMap = {};
                eligibilityResults.forEach(result => {
                    if (result.success) {
                        eligibilityMap[result.campaignId] = result;
                    }
                });
                setEligibilityResults(eligibilityMap);
            }
        } catch (error) {
            console.error('Failed to load active campaigns:', error);
        }
    };
    
    const loadClaimedCampaigns = async () => {
        try {
            const result = await airdropService.getUserClaimedCampaigns(userAddress);
            if (result.success) {
                setClaimedCampaigns(result.campaigns);
            }
        } catch (error) {
            console.error('Failed to load claimed campaigns:', error);
        }
    };
    
    const loadUserReputation = async () => {
        try {
            const reputation = await airdropService.getUserReputation(userAddress);
            setUserReputation(reputation);
        } catch (error) {
            console.error('Failed to load user reputation:', error);
        }
    };
    
    const handleClaimAirdrop = async (campaignId) => {
        try {
            setLoading(true);
            
            // For demo purposes, assume user is verified
            const mockSelfProof = {
                isVerified: true,
                timestamp: Date.now()
            };
            
            const result = await airdropService.claimAirdrop(campaignId, mockSelfProof);
            
            if (result.success) {
                alert(`Airdrop claimed successfully! Amount: ${result.amount}`);
                
                // Refresh data
                await Promise.all([
                    loadActiveCampaigns(),
                    loadClaimedCampaigns(),
                    loadUserReputation()
                ]);
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('Failed to claim airdrop:', error);
            alert('Failed to claim airdrop: ' + error.message);
        } finally {
            setLoading(false);
        }
    };
    
    const handleCreateCampaign = async (e) => {
        e.preventDefault();
        
        try {
            setLoading(true);
            
            const now = Date.now();
            const campaignData = {
                name: createForm.name,
                description: createForm.description,
                airdropType: createForm.airdropType,
                tokenContract: '0x0000000000000000000000000000000000000000', // Mock address
                rewardAmount: parseFloat(createForm.rewardAmount),
                totalSupply: parseInt(createForm.totalSupply),
                startTime: now,
                endTime: now + (createForm.duration * 24 * 60 * 60 * 1000),
                criteria: {
                    requiresHumanVerification: true,
                    requiresUniqueIdentity: true,
                    minimumTradingVolume: 0,
                    minimumStakeAmount: 0
                }
            };
            
            const result = await airdropService.createCampaign(campaignData);
            
            if (result.success) {
                alert(`Campaign created successfully! ID: ${result.campaignId}`);
                setShowCreateForm(false);
                setCreateForm({
                    name: '',
                    description: '',
                    airdropType: 'TOKEN',
                    rewardAmount: '',
                    totalSupply: '',
                    duration: 7
                });
                
                await loadActiveCampaigns();
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('Failed to create campaign:', error);
            alert('Failed to create campaign: ' + error.message);
        } finally {
            setLoading(false);
        }
    };
    
    const getStatusIcon = (eligible, hasClaimed) => {
        if (hasClaimed) return <CheckCircle className="status-icon claimed" />;
        if (eligible) return <CheckCircle className="status-icon eligible" />;
        return <XCircle className="status-icon ineligible" />;
    };
    
    const getStatusText = (eligible, hasClaimed) => {
        if (hasClaimed) return 'Claimed';
        if (eligible) return 'Eligible';
        return 'Not Eligible';
    };
    
    const getReputationLevelInfo = (score) => {
        for (let i = reputationLevels.length - 1; i >= 0; i--) {
            if (score >= reputationLevels[i].minScore) {
                return reputationLevels[i];
            }
        }
        return reputationLevels[0];
    };
    
    if (loading && activeCampaigns.length === 0) {
        return (
            <div className="airdrop-loading">
                <div className="loading-spinner"></div>
                <p>Loading Airdrop Dashboard...</p>
            </div>
        );
    }
    
    return (
        <div className="airdrop-dashboard">
            <motion.div 
                className="airdrop-header"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <div className="header-content">
                    <div className="title-section">
                        <Gift className="header-icon" />
                        <div>
                            <h1>Airdrop Center</h1>
                            <p>Claim rewards and build your reputation with verified identity</p>
                        </div>
                    </div>
                    
                    {userReputation && (
                        <div className="reputation-card">
                            <div className="reputation-level">
                                {React.createElement(getReputationLevelInfo(userReputation.totalScore).icon, {
                                    className: "level-icon",
                                    style: { color: getReputationLevelInfo(userReputation.totalScore).color }
                                })}
                                <div>
                                    <span className="level-name">
                                        {getReputationLevelInfo(userReputation.totalScore).level}
                                    </span>
                                    <span className="level-score">{userReputation.totalScore} points</span>
                                </div>
                            </div>
                            
                            <div className="reputation-breakdown">
                                <div className="score-item">
                                    <span>Trading</span>
                                    <span>{userReputation.tradingScore}</span>
                                </div>
                                <div className="score-item">
                                    <span>Data</span>
                                    <span>{userReputation.dataContributionScore}</span>
                                </div>
                                <div className="score-item">
                                    <span>Governance</span>
                                    <span>{userReputation.governanceScore}</span>
                                </div>
                                <div className="score-item">
                                    <span>Verification</span>
                                    <span>{userReputation.verificationScore}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
            
            <div className="airdrop-tabs">
                <button 
                    className={`tab-button ${activeTab === 'campaigns' ? 'active' : ''}`}
                    onClick={() => setActiveTab('campaigns')}
                >
                    <Gift size={20} />
                    Active Campaigns
                </button>
                <button 
                    className={`tab-button ${activeTab === 'claimed' ? 'active' : ''}`}
                    onClick={() => setActiveTab('claimed')}
                >
                    <CheckCircle size={20} />
                    Claimed Rewards
                </button>
                <button 
                    className={`tab-button ${activeTab === 'reputation' ? 'active' : ''}`}
                    onClick={() => setActiveTab('reputation')}
                >
                    <Star size={20} />
                    Reputation
                </button>
                <button 
                    className={`tab-button ${activeTab === 'create' ? 'active' : ''}`}
                    onClick={() => setActiveTab('create')}
                >
                    <Award size={20} />
                    Create Campaign
                </button>
            </div>
            
            <div className="airdrop-content">
                {activeTab === 'campaigns' && (
                    <motion.div 
                        className="campaigns-section"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="campaigns-header">
                            <h3>Active Airdrop Campaigns</h3>
                            <span className="campaigns-count">{activeCampaigns.length} campaigns available</span>
                        </div>
                        
                        <div className="campaigns-grid">
                            {activeCampaigns.map((campaign, index) => {
                                const eligibility = eligibilityResults[campaign.id];
                                const typeInfo = airdropTypes.find(t => t.value === campaign.airdropType);
                                
                                return (
                                    <div key={campaign.id} className="campaign-card">
                                        <div className="campaign-header">
                                            <div className="campaign-info">
                                                <div className="campaign-type">
                                                    {React.createElement(typeInfo?.icon || Gift, {
                                                        className: "type-icon"
                                                    })}
                                                    <span>{typeInfo?.label || campaign.airdropType}</span>
                                                </div>
                                                <h4>{campaign.name}</h4>
                                            </div>
                                            
                                            <div className="campaign-status">
                                                {eligibility && getStatusIcon(eligibility.eligible, eligibility.hasClaimed)}
                                                <span className={`status-text ${
                                                    eligibility?.hasClaimed ? 'claimed' : 
                                                    eligibility?.eligible ? 'eligible' : 'ineligible'
                                                }`}>
                                                    {eligibility ? getStatusText(eligibility.eligible, eligibility.hasClaimed) : 'Checking...'}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <p className="campaign-description">{campaign.description}</p>
                                        
                                        <div className="campaign-details">
                                            <div className="detail-row">
                                                <Coins className="detail-icon" />
                                                <span>Reward: {campaign.rewardAmount} {campaign.airdropType === 'TOKEN' ? 'tokens' : 'points'}</span>
                                            </div>
                                            <div className="detail-row">
                                                <Users className="detail-icon" />
                                                <span>Claimed: {campaign.claimed}/{campaign.totalSupply}</span>
                                            </div>
                                            <div className="detail-row">
                                                <Calendar className="detail-icon" />
                                                <span>Ends: {campaign.endTime.toLocaleDateString()}</span>
                                            </div>
                                            <div className="detail-row">
                                                <Percent className="detail-icon" />
                                                <span>Progress: {campaign.progress.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                        
                                        <div className="progress-bar">
                                            <div 
                                                className="progress-fill"
                                                style={{ width: `${campaign.progress}%` }}
                                            ></div>
                                        </div>
                                        
                                        {eligibility && eligibility.reasons && (
                                            <div className="eligibility-reasons">
                                                {eligibility.reasons.map((reason, idx) => (
                                                    <div key={idx} className={`reason ${reason.type}`}>
                                                        {reason.type === 'success' && <CheckCircle size={16} />}
                                                        {reason.type === 'warning' && <AlertCircle size={16} />}
                                                        {reason.type === 'error' && <XCircle size={16} />}
                                                        <span>{reason.message}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        
                                        <button 
                                            className={`claim-button ${
                                                !eligibility?.eligible || eligibility?.hasClaimed ? 'disabled' : ''
                                            }`}
                                            onClick={() => handleClaimAirdrop(campaign.id)}
                                            disabled={!eligibility?.eligible || eligibility?.hasClaimed || loading}
                                        >
                                            {eligibility?.hasClaimed ? 'Already Claimed' : 
                                             eligibility?.eligible ? 'Claim Reward' : 'Not Eligible'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                        
                        {activeCampaigns.length === 0 && (
                            <div className="no-campaigns">
                                <Gift size={48} />
                                <p>No active campaigns available</p>
                                <p>Check back later for new airdrop opportunities</p>
                            </div>
                        )}
                    </motion.div>
                )}
                
                {activeTab === 'claimed' && (
                    <motion.div 
                        className="claimed-section"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="claimed-header">
                            <h3>Claimed Rewards</h3>
                            <span className="claimed-count">{claimedCampaigns.length} rewards claimed</span>
                        </div>
                        
                        <div className="claimed-grid">
                            {claimedCampaigns.map((campaign, index) => {
                                const typeInfo = airdropTypes.find(t => t.value === campaign.airdropType);
                                
                                return (
                                    <div key={campaign.id} className="claimed-card">
                                        <div className="claimed-header-card">
                                            <div className="claimed-type">
                                                {React.createElement(typeInfo?.icon || Gift, {
                                                    className: "type-icon"
                                                })}
                                                <span>{typeInfo?.label || campaign.airdropType}</span>
                                            </div>
                                            <CheckCircle className="claimed-icon" />
                                        </div>
                                        
                                        <h4>{campaign.name}</h4>
                                        <p className="claimed-description">{campaign.description}</p>
                                        
                                        <div className="claimed-reward">
                                            <span className="reward-label">Reward Received:</span>
                                            <span className="reward-amount">
                                                {campaign.rewardAmount} {campaign.airdropType === 'TOKEN' ? 'tokens' : 'points'}
                                            </span>
                                        </div>
                                        
                                        <div className="claimed-date">
                                            <Clock size={16} />
                                            <span>Claimed on {campaign.endTime.toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        
                        {claimedCampaigns.length === 0 && (
                            <div className="no-claimed">
                                <CheckCircle size={48} />
                                <p>No rewards claimed yet</p>
                                <p>Start participating in campaigns to earn rewards</p>
                            </div>
                        )}
                    </motion.div>
                )}
                
                {activeTab === 'reputation' && (
                    <motion.div 
                        className="reputation-section"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        {userReputation && (
                            <div className="reputation-overview">
                                <div className="reputation-main-card">
                                    <div className="reputation-header-main">
                                        <h3>Your Reputation Score</h3>
                                        <div className="current-level">
                                            {React.createElement(getReputationLevelInfo(userReputation.totalScore).icon, {
                                                className: "current-level-icon",
                                                style: { color: getReputationLevelInfo(userReputation.totalScore).color }
                                            })}
                                            <span className="current-level-name">
                                                {getReputationLevelInfo(userReputation.totalScore).level}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="reputation-score-display">
                                        <div className="score-circle">
                                            <span className="score-number">{userReputation.totalScore}</span>
                                            <span className="score-max">/ 1000</span>
                                        </div>
                                    </div>
                                    
                                    <div className="reputation-categories">
                                        <div className="category-item">
                                            <TrendingUp className="category-icon" />
                                            <div>
                                                <span className="category-name">Trading Activity</span>
                                                <span className="category-score">{userReputation.tradingScore}/250</span>
                                            </div>
                                        </div>
                                        
                                        <div className="category-item">
                                            <Gift className="category-icon" />
                                            <div>
                                                <span className="category-name">Data Contribution</span>
                                                <span className="category-score">{userReputation.dataContributionScore}/250</span>
                                            </div>
                                        </div>
                                        
                                        <div className="category-item">
                                            <Users className="category-icon" />
                                            <div>
                                                <span className="category-name">Governance</span>
                                                <span className="category-score">{userReputation.governanceScore}/250</span>
                                            </div>
                                        </div>
                                        
                                        <div className="category-item">
                                            <Shield className="category-icon" />
                                            <div>
                                                <span className="category-name">Verification</span>
                                                <span className="category-score">{userReputation.verificationScore}/250</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="reputation-levels-card">
                                    <h4>Reputation Levels</h4>
                                    <div className="levels-list">
                                        {reputationLevels.map((level, index) => {
                                            const isCurrentLevel = userReputation.totalScore >= level.minScore &&
                                                                 (index === reputationLevels.length - 1 || 
                                                                  userReputation.totalScore < reputationLevels[index + 1].minScore);
                                            
                                            return (
                                                <div key={level.level} className={`level-item ${isCurrentLevel ? 'current' : ''}`}>
                                                    {React.createElement(level.icon, {
                                                        className: "level-item-icon",
                                                        style: { color: level.color }
                                                    })}
                                                    <div className="level-info">
                                                        <span className="level-name">{level.level}</span>
                                                        <span className="level-requirement">{level.minScore}+ points</span>
                                                    </div>
                                                    {isCurrentLevel && <span className="current-badge">Current</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
                
                {activeTab === 'create' && (
                    <motion.div 
                        className="create-section"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="create-header">
                            <h3>Create Airdrop Campaign</h3>
                            <p>Launch your own airdrop campaign with custom eligibility criteria</p>
                        </div>
                        
                        <form onSubmit={handleCreateCampaign} className="create-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Campaign Name</label>
                                    <input
                                        type="text"
                                        value={createForm.name}
                                        onChange={(e) => setCreateForm({
                                            ...createForm,
                                            name: e.target.value
                                        })}
                                        placeholder="Enter campaign name"
                                        required
                                    />
                                </div>
                                
                                <div className="form-group">
                                    <label>Airdrop Type</label>
                                    <select
                                        value={createForm.airdropType}
                                        onChange={(e) => setCreateForm({
                                            ...createForm,
                                            airdropType: e.target.value
                                        })}
                                    >
                                        {airdropTypes.map(type => (
                                            <option key={type.value} value={type.value}>
                                                {type.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            
                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    value={createForm.description}
                                    onChange={(e) => setCreateForm({
                                        ...createForm,
                                        description: e.target.value
                                    })}
                                    placeholder="Describe your airdrop campaign"
                                    rows={3}
                                    required
                                />
                            </div>
                            
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Reward Amount</label>
                                    <input
                                        type="number"
                                        value={createForm.rewardAmount}
                                        onChange={(e) => setCreateForm({
                                            ...createForm,
                                            rewardAmount: e.target.value
                                        })}
                                        placeholder="Amount per claim"
                                        step="0.01"
                                        min="0"
                                        required
                                    />
                                </div>
                                
                                <div className="form-group">
                                    <label>Total Supply</label>
                                    <input
                                        type="number"
                                        value={createForm.totalSupply}
                                        onChange={(e) => setCreateForm({
                                            ...createForm,
                                            totalSupply: e.target.value
                                        })}
                                        placeholder="Maximum claims"
                                        min="1"
                                        required
                                    />
                                </div>
                                
                                <div className="form-group">
                                    <label>Duration (Days)</label>
                                    <input
                                        type="number"
                                        value={createForm.duration}
                                        onChange={(e) => setCreateForm({
                                            ...createForm,
                                            duration: parseInt(e.target.value)
                                        })}
                                        placeholder="Campaign duration"
                                        min="1"
                                        max="365"
                                        required
                                    />
                                </div>
                            </div>
                            
                            <button 
                                type="submit" 
                                className="create-button"
                                disabled={loading}
                            >
                                <Award size={20} />
                                {loading ? 'Creating...' : 'Create Campaign'}
                            </button>
                        </form>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default AirdropDashboard;
