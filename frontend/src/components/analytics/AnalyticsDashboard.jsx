import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import AkaveService from '../../services/akaveService';
import './AnalyticsDashboard.css';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    Legend, 
    PieChart, 
    Pie, 
    Cell,
    LineChart,
    Line,
    ResponsiveContainer
} from 'recharts';
import { 
    Brain, 
    Database, 
    TrendingUp, 
    Upload, 
    Download, 
    BarChart3,
    PieChart as PieChartIcon,
    Activity,
    Zap,
    Target,
    FileText,
    Cloud
} from 'lucide-react';
import './AnalyticsDashboard.css';

const AnalyticsDashboard = () => {
    const { address, isConnected } = useAccount();
    
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [akaveService, setAkaveService] = useState(null);
    const [akaveStats, setAkaveStats] = useState(null);
    
    // State for analytics data
    const [storageStats, setStorageStats] = useState(null);
    const [datasets, setDatasets] = useState([]);
    const [insights, setInsights] = useState([]);
    const [performanceMetrics, setPerformanceMetrics] = useState(null);
    
    // Upload form state
    const [uploadForm, setUploadForm] = useState({
        category: 'TRADING_SIGNALS',
        filename: '',
        data: '',
        description: ''
    });
    
    // Credentials form state
    const [credentials, setCredentials] = useState({
        accessKeyId: '',
        secretAccessKey: ''
    });
    
    const categories = [
        { value: 'TRADING_SIGNALS', label: 'Trading Signals', icon: TrendingUp, color: '#4ade80' },
        { value: 'MARKET_DATA', label: 'Market Data', icon: BarChart3, color: '#3b82f6' },
        { value: 'ML_MODELS', label: 'ML Models', icon: Brain, color: '#8b5cf6' },
        { value: 'RISK_ANALYTICS', label: 'Risk Analytics', icon: Target, color: '#ef4444' },
        { value: 'PERFORMANCE_METRICS', label: 'Performance Metrics', icon: Activity, color: '#f59e0b' },
        { value: 'USER_BEHAVIOR', label: 'User Behavior', icon: Zap, color: '#10b981' },
        { value: 'COMPLIANCE_REPORTS', label: 'Compliance Reports', icon: FileText, color: '#6366f1' }
    ];
    
    const COLORS = ['#4ade80', '#3b82f6', '#8b5cf6', '#ef4444', '#f59e0b', '#10b981', '#6366f1'];
    
    useEffect(() => {
        // Try to load credentials from localStorage
        const savedCredentials = localStorage.getItem('akave_credentials');
        if (savedCredentials) {
            const parsed = JSON.parse(savedCredentials);
            setCredentials(parsed);
            initializeAkave(parsed.accessKeyId, parsed.secretAccessKey);
        } else {
            setLoading(false);
        }
    }, []);
    
    const initializeAkave = async (accessKeyId, secretAccessKey) => {
        try {
            setLoading(true);
            
            if (!akaveService) {
                const service = new AkaveService();
                setAkaveService(service);
            }
            const initResult = await akaveService.initialize();
            if (!initResult.success) {
                throw new Error(initResult.error);
            }
            
            // Load initial data
            await Promise.all([
                loadStorageStats(),
                loadDatasets(),
                generateInsights()
            ]);
            
        } catch (error) {
            console.error('Failed to initialize Akave:', error);
        } finally {
            setLoading(false);
        }
    };
    
    const handleCredentialsSubmit = async (e) => {
        e.preventDefault();
        
        // Save credentials to localStorage
        localStorage.setItem('akave_credentials', JSON.stringify(credentials));
        
        await initializeAkave(credentials.accessKeyId, credentials.secretAccessKey);
    };
    
    const loadStorageStats = async () => {
        try {
            const result = await akaveService.getStorageStats();
            if (result.success) {
                setStorageStats(result.stats);
            }
        } catch (error) {
            console.error('Failed to load storage stats:', error);
        }
    };
    
    const loadDatasets = async () => {
        try {
            const result = await akaveService.listDatasets('', 50);
            if (result.success) {
                setDatasets(result.datasets);
            }
        } catch (error) {
            console.error('Failed to load datasets:', error);
        }
    };
    
    const generateInsights = async () => {
        try {
            // Generate mock insights for demonstration
            const mockInsights = [
                {
                    title: 'Trading Signal Performance',
                    type: 'performance',
                    data: {
                        accuracy: 78.5,
                        totalSignals: 1247,
                        profitableSignals: 979
                    },
                    trend: 'up'
                },
                {
                    title: 'Market Volatility Analysis',
                    type: 'volatility',
                    data: {
                        currentVolatility: 23.4,
                        averageVolatility: 18.7,
                        trend: 'increasing'
                    },
                    trend: 'up'
                },
                {
                    title: 'Risk Metrics Summary',
                    type: 'risk',
                    data: {
                        sharpeRatio: 1.85,
                        maxDrawdown: -12.3,
                        var95: -5.2
                    },
                    trend: 'stable'
                }
            ];
            
            setInsights(mockInsights);
            
            // Generate performance metrics
            const mockPerformanceData = Array.from({ length: 30 }, (_, i) => ({
                date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString(),
                returns: (Math.random() - 0.5) * 10,
                volume: Math.random() * 1000000,
                signals: Math.floor(Math.random() * 50) + 10
            }));
            
            setPerformanceMetrics(mockPerformanceData);
            
        } catch (error) {
            console.error('Failed to generate insights:', error);
        }
    };
    
    const handleUpload = async (e) => {
        e.preventDefault();
        
        try {
            setLoading(true);
            
            // Parse the data
            const parsedData = JSON.parse(uploadForm.data);
            
            // Upload to Akave
            const result = await akaveService.uploadDataset(
                parsedData,
                uploadForm.category,
                uploadForm.filename,
                {
                    description: uploadForm.description,
                    uploadedBy: userAddress
                }
            );
            
            if (result.success) {
                alert('Dataset uploaded successfully!');
                setUploadForm({ category: 'TRADING_SIGNALS', filename: '', data: '', description: '' });
                await loadDatasets();
                await loadStorageStats();
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('Failed to upload dataset:', error);
            alert('Failed to upload dataset: ' + error.message);
        } finally {
            setLoading(false);
        }
    };
    
    const handleDownload = async (key) => {
        try {
            setLoading(true);
            
            const result = await akaveService.downloadDataset(key);
            if (result.success) {
                // Create download link
                const blob = new Blob([JSON.stringify(result.dataset, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = key.split('/').pop() || 'dataset.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('Failed to download dataset:', error);
            alert('Failed to download dataset: ' + error.message);
        } finally {
            setLoading(false);
        }
    };
    
    const handleDelete = async (key) => {
        if (!confirm('Are you sure you want to delete this dataset?')) {
            return;
        }
        
        try {
            setLoading(true);
            
            const result = await akaveService.deleteDataset(key);
            if (result.success) {
                alert('Dataset deleted successfully!');
                await loadDatasets();
                await loadStorageStats();
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('Failed to delete dataset:', error);
            alert('Failed to delete dataset: ' + error.message);
        } finally {
            setLoading(false);
        }
    };
    
    // Show credentials form if not initialized
    if (!akaveService.initialized && !loading) {
        return (
            <div className="analytics-dashboard">
                <div className="credentials-form">
                    <motion.div 
                        className="credentials-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <Cloud className="credentials-icon" />
                        <h2>Connect to Akave O3</h2>
                        <p>Enter your Akave credentials to access AI/ML analytics storage</p>
                        
                        <form onSubmit={handleCredentialsSubmit}>
                            <div className="form-group">
                                <label>Access Key ID</label>
                                <input
                                    type="text"
                                    value={credentials.accessKeyId}
                                    onChange={(e) => setCredentials({
                                        ...credentials,
                                        accessKeyId: e.target.value
                                    })}
                                    placeholder="Your Akave access key ID"
                                    required
                                />
                            </div>
                            
                            <div className="form-group">
                                <label>Secret Access Key</label>
                                <input
                                    type="password"
                                    value={credentials.secretAccessKey}
                                    onChange={(e) => setCredentials({
                                        ...credentials,
                                        secretAccessKey: e.target.value
                                    })}
                                    placeholder="Your Akave secret access key"
                                    required
                                />
                            </div>
                            
                            <button type="submit" className="connect-button">
                                <Cloud size={20} />
                                Connect to Akave
                            </button>
                        </form>
                        
                        <div className="credentials-help">
                            <p>Don't have Akave credentials? <a href="https://akave.ai" target="_blank" rel="noopener noreferrer">Sign up here</a></p>
                        </div>
                    </motion.div>
                </div>
            </div>
        );
    }
    
    if (loading && !storageStats) {
        return (
            <div className="analytics-loading">
                <div className="loading-spinner"></div>
                <p>Loading Analytics Dashboard...</p>
            </div>
        );
    }
    
    return (
        <div className="analytics-dashboard">
            <motion.div 
                className="analytics-header"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <div className="header-content">
                    <div className="title-section">
                        <Brain className="header-icon" />
                        <div>
                            <h1>AI/ML Analytics</h1>
                            <p>Powered by Akave O3 decentralized storage</p>
                        </div>
                    </div>
                    
                    {storageStats && (
                        <div className="stats-overview">
                            <div className="stat-card">
                                <Database className="stat-icon" />
                                <div>
                                    <span className="stat-value">{storageStats.totalDatasets}</span>
                                    <span className="stat-label">Total Datasets</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <Cloud className="stat-icon" />
                                <div>
                                    <span className="stat-value">{(storageStats.totalSize / 1024 / 1024).toFixed(2)} MB</span>
                                    <span className="stat-label">Storage Used</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <Activity className="stat-icon" />
                                <div>
                                    <span className="stat-value">{Object.keys(storageStats.categoryCounts).length}</span>
                                    <span className="stat-label">Categories</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
            
            <div className="analytics-tabs">
                <button 
                    className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    <BarChart3 size={20} />
                    Overview
                </button>
                <button 
                    className={`tab-button ${activeTab === 'datasets' ? 'active' : ''}`}
                    onClick={() => setActiveTab('datasets')}
                >
                    <Database size={20} />
                    Datasets
                </button>
                <button 
                    className={`tab-button ${activeTab === 'insights' ? 'active' : ''}`}
                    onClick={() => setActiveTab('insights')}
                >
                    <Brain size={20} />
                    Insights
                </button>
                <button 
                    className={`tab-button ${activeTab === 'upload' ? 'active' : ''}`}
                    onClick={() => setActiveTab('upload')}
                >
                    <Upload size={20} />
                    Upload
                </button>
            </div>
            
            <div className="analytics-content">
                {activeTab === 'overview' && (
                    <motion.div 
                        className="overview-section"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="overview-grid">
                            <div className="chart-card">
                                <h3>Dataset Distribution</h3>
                                {storageStats && (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie
                                                data={Object.entries(storageStats.categoryCounts).map(([category, count]) => ({
                                                    name: category.replace('_', ' '),
                                                    value: count
                                                }))}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                                outerRadius={80}
                                                fill="#8884d8"
                                                dataKey="value"
                                            >
                                                {Object.entries(storageStats.categoryCounts).map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                            
                            <div className="chart-card">
                                <h3>Performance Trends</h3>
                                {performanceMetrics && (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <LineChart data={performanceMetrics}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="date" />
                                            <YAxis />
                                            <Tooltip />
                                            <Legend />
                                            <Line type="monotone" dataKey="returns" stroke="#4ade80" name="Returns %" />
                                            <Line type="monotone" dataKey="signals" stroke="#3b82f6" name="Signals" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>
                        
                        <div className="insights-grid">
                            {insights.map((insight, index) => (
                                <div key={index} className="insight-card">
                                    <div className="insight-header">
                                        <h4>{insight.title}</h4>
                                        <span className={`trend-indicator ${insight.trend}`}>
                                            <TrendingUp size={16} />
                                        </span>
                                    </div>
                                    <div className="insight-metrics">
                                        {Object.entries(insight.data).map(([key, value]) => (
                                            <div key={key} className="metric-item">
                                                <span className="metric-label">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
                                                <span className="metric-value">
                                                    {typeof value === 'number' ? value.toFixed(2) : value}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
                
                {activeTab === 'datasets' && (
                    <motion.div 
                        className="datasets-section"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="datasets-header">
                            <h3>Stored Datasets</h3>
                            <button 
                                className="refresh-button"
                                onClick={() => {
                                    loadDatasets();
                                    loadStorageStats();
                                }}
                                disabled={loading}
                            >
                                <Activity size={16} />
                                Refresh
                            </button>
                        </div>
                        
                        <div className="datasets-grid">
                            {datasets.map((dataset, index) => (
                                <div key={dataset.key} className="dataset-card">
                                    <div className="dataset-header">
                                        <div className="dataset-info">
                                            <h4>{dataset.filename}</h4>
                                            <span className="dataset-category">{dataset.category}</span>
                                        </div>
                                        <div className="dataset-actions">
                                            <button 
                                                className="action-button download"
                                                onClick={() => handleDownload(dataset.key)}
                                                disabled={loading}
                                            >
                                                <Download size={16} />
                                            </button>
                                            <button 
                                                className="action-button delete"
                                                onClick={() => handleDelete(dataset.key)}
                                                disabled={loading}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="dataset-details">
                                        <div className="detail-item">
                                            <span>Size:</span>
                                            <span>{(dataset.size / 1024).toFixed(2)} KB</span>
                                        </div>
                                        <div className="detail-item">
                                            <span>Modified:</span>
                                            <span>{new Date(dataset.lastModified).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {datasets.length === 0 && (
                            <div className="no-datasets">
                                <Database size={48} />
                                <p>No datasets found</p>
                                <p>Upload your first dataset to get started</p>
                            </div>
                        )}
                    </motion.div>
                )}
                
                {activeTab === 'insights' && (
                    <motion.div 
                        className="insights-section"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="insights-header">
                            <h3>AI/ML Insights</h3>
                            <button 
                                className="generate-button"
                                onClick={generateInsights}
                                disabled={loading}
                            >
                                <Brain size={16} />
                                Generate Insights
                            </button>
                        </div>
                        
                        <div className="insights-detailed">
                            {insights.map((insight, index) => (
                                <div key={index} className="insight-detailed-card">
                                    <div className="insight-detailed-header">
                                        <h4>{insight.title}</h4>
                                        <span className={`insight-type ${insight.type}`}>
                                            {insight.type}
                                        </span>
                                    </div>
                                    
                                    <div className="insight-visualization">
                                        {insight.type === 'performance' && (
                                            <ResponsiveContainer width="100%" height={200}>
                                                <BarChart data={[
                                                    { name: 'Accuracy', value: insight.data.accuracy },
                                                    { name: 'Total Signals', value: insight.data.totalSignals / 10 },
                                                    { name: 'Profitable', value: insight.data.profitableSignals / 10 }
                                                ]}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="name" />
                                                    <YAxis />
                                                    <Tooltip />
                                                    <Bar dataKey="value" fill="#4ade80" />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        )}
                                        
                                        {insight.type !== 'performance' && (
                                            <div className="insight-metrics-grid">
                                                {Object.entries(insight.data).map(([key, value]) => (
                                                    <div key={key} className="metric-card">
                                                        <span className="metric-label">{key}</span>
                                                        <span className="metric-value">{value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
                
                {activeTab === 'upload' && (
                    <motion.div 
                        className="upload-section"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="upload-grid">
                            <div className="upload-form">
                                <h3>Upload Dataset</h3>
                                <form onSubmit={handleUpload}>
                                    <div className="form-group">
                                        <label>Category</label>
                                        <select 
                                            value={uploadForm.category}
                                            onChange={(e) => setUploadForm({
                                                ...uploadForm,
                                                category: e.target.value
                                            })}
                                        >
                                            {categories.map(category => (
                                                <option key={category.value} value={category.value}>
                                                    {category.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    
                                    <div className="form-group">
                                        <label>Filename</label>
                                        <input
                                            type="text"
                                            value={uploadForm.filename}
                                            onChange={(e) => setUploadForm({
                                                ...uploadForm,
                                                filename: e.target.value
                                            })}
                                            placeholder="dataset.json"
                                            required
                                        />
                                    </div>
                                    
                                    <div className="form-group">
                                        <label>Data (JSON Format)</label>
                                        <textarea
                                            value={uploadForm.data}
                                            onChange={(e) => setUploadForm({
                                                ...uploadForm,
                                                data: e.target.value
                                            })}
                                            placeholder='{"signals": [{"type": "buy", "price": 100, "confidence": 0.8}]}'
                                            rows={8}
                                            required
                                        />
                                    </div>
                                    
                                    <div className="form-group">
                                        <label>Description</label>
                                        <input
                                            type="text"
                                            value={uploadForm.description}
                                            onChange={(e) => setUploadForm({
                                                ...uploadForm,
                                                description: e.target.value
                                            })}
                                            placeholder="Brief description of the dataset"
                                        />
                                    </div>
                                    
                                    <button 
                                        type="submit" 
                                        className="upload-button"
                                        disabled={loading}
                                    >
                                        <Upload size={20} />
                                        {loading ? 'Uploading...' : 'Upload Dataset'}
                                    </button>
                                </form>
                            </div>
                            
                            <div className="categories-info">
                                <h3>Dataset Categories</h3>
                                <div className="categories-list">
                                    {categories.map(category => {
                                        const IconComponent = category.icon;
                                        return (
                                            <div key={category.value} className="category-card">
                                                <IconComponent 
                                                    className="category-icon" 
                                                    style={{ color: category.color }}
                                                />
                                                <div>
                                                    <h4>{category.label}</h4>
                                                    <p>
                                                        {category.value === 'TRADING_SIGNALS' && 'AI-generated trading signals and predictions'}
                                                        {category.value === 'MARKET_DATA' && 'Historical and real-time market data'}
                                                        {category.value === 'ML_MODELS' && 'Trained machine learning models and weights'}
                                                        {category.value === 'RISK_ANALYTICS' && 'Risk assessment and portfolio analytics'}
                                                        {category.value === 'PERFORMANCE_METRICS' && 'Trading performance and backtesting results'}
                                                        {category.value === 'USER_BEHAVIOR' && 'User interaction and behavior patterns'}
                                                        {category.value === 'COMPLIANCE_REPORTS' && 'Regulatory compliance and audit reports'}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
