'use client'

import { FC, ReactNode, useMemo } from 'react'
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { clusterApiUrl } from '@solana/web3.js'

// Import wallet adapter CSS
require('@solana/wallet-adapter-react-ui/styles.css')

interface WalletProviderProps {
  children: ReactNode
}

export const WalletProvider: FC<WalletProviderProps> = ({ children }) => {
  // Force Mainnet only
  const network = WalletAdapterNetwork.Mainnet

  // You can also provide a custom RPC endpoint
  const endpoint = useMemo(() => {
    return process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(network)
  }, [])

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  )

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  )
}

