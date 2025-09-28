import React, { useState, useEffect, useRef } from 'react';
import NET from 'vanta/dist/vanta.net.min.js';
import * as THREE from 'three';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Home, 
    Database, 
    BarChart3, 
    Wifi, 
    Gift, 
    Coins, 
    Shield, 
    Settings,
    Menu,
    X
} from 'lucide-react';

// Import all the new components
import UserWallet from './components/UserWallet';
import DataDAODashboard from './components/datadao/DataDAODashboard';
import AnalyticsDashboard from './components/analytics/AnalyticsDashboard';
import DataFeedsDashboard from './components/feeds/DataFeedsDashboard';
import AirdropDashboard from './components/airdrop/AirdropDashboard';
import './EnhancedApp.css';

const EnhancedApp = () => {
    const vantaRef = useRef(null);
    // Add wallet error handling
    useEffect(() => {
        const handleWalletError = (error) => {
            console.warn('Wallet extension error (handled):', error);
            // Suppress wallet extension errors that don't affect functionality
        };

        // Listen for wallet-related errors
        if (typeof window !== 'undefined' && window.ethereum) {
            window.ethereum.on('error', handleWalletError);
            
            // Handle specific wallet extension errors
            const originalConsoleError = console.error;
            console.error = (...args) => {
                const message = args.join(' ');
                if (message.includes('isDefaultWallet') || 
                    message.includes('Cannot read properties of undefined')) {
                    // Suppress these specific wallet extension errors
                    return;
                }
                originalConsoleError.apply(console, args);
            };

            return () => {
                if (window.ethereum) {
                    window.ethereum.removeListener('error', handleWalletError);
                }
                console.error = originalConsoleError;
            };
        }
    }, []);

    useEffect(() => {
        let vantaEffect = null;
        if (vantaRef.current) {
            vantaEffect = NET({
                el: vantaRef.current,
                THREE: THREE,
                mouseControls: true,
                touchControls: true,
                gyroControls: false,
                minHeight: 200.00,
                minWidth: 200.00,
                scale: 1.00,
                scaleMobile: 1.00,
                color: 0x3f3fff,
                backgroundColor: 0x0,
                points: 10.00,
                maxDistance: 25.00,
                spacing: 20.00
            });
        }
        return () => {
            if (vantaEffect) vantaEffect.destroy();
        }
    }, []);
    const { address, isConnected } = useAccount();
    const publicClient = usePublicClient();
    const { data: walletClient } = useWalletClient();

    // Maintain ethers-compatible provider/signer for existing components
    const [provider, setProvider] = useState(null);
    const [signer, setSigner] = useState(null);

    useEffect(() => {
        const setupEthers = async () => {
            try {
                if (typeof window !== 'undefined' && window.ethereum && isConnected) {
                    // Add additional checks for wallet state
                    if (window.ethereum.selectedAddress || address) {
                        const browserProvider = new ethers.BrowserProvider(window.ethereum);
                        setProvider(browserProvider);
                        try {
                            const s = await browserProvider.getSigner();
                            setSigner(s);
                        } catch (e) {
                            console.warn('Failed to get signer:', e.message);
                            setSigner(null);
                        }
                    } else {
                        setProvider(null);
                        setSigner(null);
                    }
                } else {
                    setProvider(null);
                    setSigner(null);
                }
            } catch (e) {
                console.warn('Error setting up ethers:', e.message);
                setProvider(null);
                setSigner(null);
            }
        };

        // Add a small delay to ensure wallet state is stable
        const timeoutId = setTimeout(setupEthers, 100);
        return () => clearTimeout(timeoutId);
    }, [walletClient, isConnected, address]);
    
    const [activeTab, setActiveTab] = useState('home');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    
    const navigationItems = [
        {
            id: 'home',
            label: 'ZKVault Core',
            icon: Home,
            description: 'Privacy-preserving swaps and core features',
            component: UserWallet
        },
        {
            id: 'datadao',
            label: 'DataDAO',
            icon: Database,
            description: 'Tokenized data sharing and governance',
            component: DataDAODashboard
        },
        {
            id: 'analytics',
            label: 'AI/ML Analytics',
            icon: BarChart3,
            description: 'Akave O3 powered analytics and insights',
            component: AnalyticsDashboard
        },
        {
            id: 'feeds',
            label: 'zkTLS Feeds',
            icon: Wifi,
            description: 'Live verified off-chain data feeds',
            component: DataFeedsDashboard
        },
        {
            id: 'airdrops',
            label: 'Airdrops & Rewards',
            icon: Gift,
            description: 'Self Protocol gated rewards system',
            component: AirdropDashboard
        }
    ];
    
    const renderActiveComponent = () => {
        const activeItem = navigationItems.find(item => item.id === activeTab);
        if (!activeItem) return null;
        
        const Component = activeItem.component;
        
        // Pass common props to all components
        const commonProps = {
            provider,
            signer,
            userAddress: address
        };
        
        return <Component {...commonProps} />;
    };
    
    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        setSidebarOpen(false);
    };
    
    if (!isConnected) {
        return (
            <div className="enhanced-app">
                <div className="connect-screen">
                    <motion.div 
                        className="connect-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <div className="connect-header">
                            <Shield className="connect-icon" />
                            <h1>ZKVault Protocol</h1>
                            <p>The Complete Institutional Privacy Platform</p>
                        </div>
                        
                        <div className="features-grid">
                            <div className="feature-card">
                                <Home className="feature-icon" />
                                <h3>Privacy-First Trading</h3>
                                <p>Zero-knowledge proofs for private DeFi swaps</p>
                            </div>
                            
                            <div className="feature-card">
                                <Database className="feature-icon" />
                                <h3>DataDAO Governance</h3>
                                <p>Monetize data while preserving privacy</p>
                            </div>
                            
                            <div className="feature-card">
                                <BarChart3 className="feature-icon" />
                                <h3>AI/ML Analytics</h3>
                                <p>Akave O3 powered institutional insights</p>
                            </div>
                            
                            <div className="feature-card">
                                <Wifi className="feature-icon" />
                                <h3>zkTLS Data Feeds</h3>
                                <p>Cryptographically verified off-chain data</p>
                            </div>
                            
                            <div className="feature-card">
                                <Gift className="feature-icon" />
                                <h3>Gated Rewards</h3>
                                <p>Self Protocol verified airdrops and incentives</p>
                            </div>
                            
                            <div className="feature-card">
                                <Coins className="feature-icon" />
                                <h3>Gas Pool DAO</h3>
                                <p>Decentralized relayer funding and staking</p>
                            </div>
                        </div>
                        
                        <div className="connect-action">
                            <ConnectButton />
                            <p className="connect-note">
                                Connect your wallet to access the complete ZKVault ecosystem
                            </p>
                        </div>
                    </motion.div>
                </div>
            </div>
        );
    }
    
    return (
        <div className="enhanced-app" ref={vantaRef}>
            {/* Mobile Menu Button */}
            <button 
                className="mobile-menu-button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
            >
                {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            
            {/* Sidebar Navigation */}
            <AnimatePresence>
                <motion.aside 
                    className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}
                    initial={{ x: -300 }}
                    animate={{ x: 0 }}
                    exit={{ x: -300 }}
                    transition={{ duration: 0.3 }}
                >
                    <div className="sidebar-header">
                        <Shield className="sidebar-logo" />
                        <div>
                            <h2>ZKVault</h2>
                            <p>Institutional Privacy Platform</p>
                        </div>
                    </div>
                    
                    <nav className="sidebar-nav">
                        {navigationItems.map((item) => {
                            const IconComponent = item.icon;
                            return (
                                <button
                                    key={item.id}
                                    className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                                    onClick={() => handleTabChange(item.id)}
                                >
                                    <IconComponent className="nav-icon" />
                                    <div className="nav-content">
                                        <span className="nav-label">{item.label}</span>
                                        <span className="nav-description">{item.description}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </nav>
                    
                    <div className="sidebar-footer">
                        <div className="user-info">
                            <div className="user-avatar">
                                <Shield size={20} />
                            </div>
                            <div className="user-details">
                                <span className="user-address">
                                    {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''}
                                </span>
                                <span className="user-status">Connected</span>
                            </div>
                        </div>
                        
                        <ConnectButton />
                    </div>
                </motion.aside>
            </AnimatePresence>
            
            {/* Main Content Area */}
            <main className="main-content">
                <header className="main-header">
                    <div className="header-info">
                        <h1>{navigationItems.find(item => item.id === activeTab)?.label}</h1>
                        <p>{navigationItems.find(item => item.id === activeTab)?.description}</p>
                    </div>
                    
                    <div className="header-actions">
                        <button className="settings-button">
                            <Settings size={20} />
                        </button>
                    </div>
                </header>
                
                <div className="content-wrapper">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="content-container"
                        >
                            {renderActiveComponent()}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>
            
            {/* Overlay for mobile sidebar */}
            {sidebarOpen && (
                <div 
                    className="sidebar-overlay"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
        </div>
    );
};

export default EnhancedApp;
