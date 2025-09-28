import { ConnectButton } from '@rainbow-me/rainbowkit'
import React, { useState } from 'react'
import UserWallet from './components/UserWallet'
import SynapseStorage from './components/SynapseStorage'
import LiveDataDashboard from './components/LiveDataDashboard'
import DataDAODashboard from './components/datadao/DataDAODashboard'
import AnalyticsDashboard from './components/analytics/AnalyticsDashboard'
import CustomIdentityVerification from './components/CustomIdentityVerification'
import './App.css'

const App = () => {
  const [activeTab, setActiveTab] = useState('wallet')

  const tabs = [
    { id: 'wallet', label: 'Wallet & Swaps', component: UserWallet },
    { id: 'identity', label: 'Identity Verification', component: CustomIdentityVerification },
    { id: 'synapse', label: 'Synapse Storage', component: SynapseStorage },
    { id: 'livedata', label: 'Live Data Feeds', component: LiveDataDashboard },
    { id: 'datadao', label: 'DataDAO', component: DataDAODashboard },
    { id: 'analytics', label: 'Analytics', component: AnalyticsDashboard }
  ]

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || UserWallet

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="app-title">ZKVault</h1>
            <p className="app-subtitle">Privacy-Preserving DeFi Protocol</p>
          </div>
          <div className="header-right">
            <ConnectButton />
          </div>
        </div>
        
        <nav className="app-navigation">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>
      
      <main className="app-main">
        <ActiveComponent />
      </main>
      
      <footer className="app-footer">
        <div className="footer-content">
          <p>Powered by Zero-Knowledge Proofs, Self Protocol, Lighthouse, Akave O3 & Synapse</p>
          <div className="footer-links">
            <a href="https://github.com/zkvault/protocol" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <a href="https://docs.zkvault.app" target="_blank" rel="noopener noreferrer">
              Docs
            </a>
            <a href="https://discord.gg/zkvault" target="_blank" rel="noopener noreferrer">
              Discord
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App