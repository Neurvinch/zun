import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient,QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider ,darkTheme } from '@rainbow-me/rainbowkit'
import { http } from 'wagmi'
import { sepolia, celoSepolia } from 'viem/chains'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import "@rainbow-me/rainbowkit/styles.css"
import './index.css'
import EnhancedApp from './EnhancedApp.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'


const config = getDefaultConfig({
  appName : "ZetaAsk",
  projectId : "3f84877fb445dd3a1c6a2813dcfdb3d0",
  chains:[sepolia,celoSepolia],
  transports: {
    [sepolia.id] : http("https://worldchain-sepolia.g.alchemy.com/v2/Ljr9rV6foCZ6EDtKt6z-d2Kiy0ahFvLs"),
    [celoSepolia.id] : http("https://celo-sepolia.g.alchemy.com/v2/EhIhIkZtonHuwFsvqOwkusHPrXFXBc7i")

  }
})
  
const queryClient = new QueryClient()

const theme = darkTheme({
  accentColor: '#7b3fe4',
  accentColorForeground: "white",
  fontStack : "system",
  overlayBlur: "small",
});
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient} >
        <RainbowKitProvider theme={theme} chains={[sepolia , celoSepolia]}>
          <ErrorBoundary>
            <EnhancedApp />
          </ErrorBoundary>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
    
    
  </StrictMode>,
)