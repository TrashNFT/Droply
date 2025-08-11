import { Connection, clusterApiUrl, Commitment } from '@solana/web3.js'

const NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta'
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(NETWORK as any)

export const connection = new Connection(RPC_URL, {
  commitment: 'confirmed' as Commitment,
  confirmTransactionInitialTimeout: 60000,
})

export const getConnection = (network?: 'mainnet-beta' | 'devnet') => {
  const rpcUrl = network === 'devnet' 
    ? process.env.NEXT_PUBLIC_SOLANA_RPC_URL_DEV || clusterApiUrl('devnet')
    : RPC_URL
    
  return new Connection(rpcUrl, {
    commitment: 'confirmed' as Commitment,
    confirmTransactionInitialTimeout: 60000,
  })
}

export const getNetworkConfig = () => {
  return {
    network: NETWORK,
    rpcUrl: RPC_URL,
  }
}

