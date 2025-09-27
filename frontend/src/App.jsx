import { ConnectButton } from '@rainbow-me/rainbowkit'
import React from 'react'
import UserWallet from './components/UserWallet'
import './App.css'

const App = () => {
  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">ZKVault</h1>
          <p className="app-subtitle">Privacy-Preserving DeFi Swaps</p>
          <ConnectButton />
        </div>
      </header>
      
      <main className="app-main">
        <UserWallet />
      </main>
      
      <footer className="app-footer">
        <p>Powered by Zero-Knowledge Proofs & Self Protocol</p>
      </footer>
    </div>
  )
}

export default App