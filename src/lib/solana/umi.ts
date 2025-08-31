import { WalletAdapter } from '@solana/wallet-adapter-base'
import { Connection, clusterApiUrl } from '@solana/web3.js'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters'
import { mplCandyMachine } from '@metaplex-foundation/mpl-candy-machine'
import * as CandyGuardPlugin from '@metaplex-foundation/mpl-candy-guard'
import * as BubblegumPlugin from '@metaplex-foundation/mpl-bubblegum'
import { mplCore } from '@metaplex-foundation/mpl-core'

export const getConnection = (network: 'mainnet-beta' | 'devnet' = 'mainnet-beta') => {
  const rpcUrl =
    network === 'devnet'
      ? process.env.SOLANA_RPC_URL_DEV || process.env.NEXT_PUBLIC_SOLANA_RPC_URL_DEV || clusterApiUrl('devnet')
      : process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
  return new Connection(rpcUrl, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 120_000,
  })
}

const createBaseUmi = (network: 'mainnet-beta' | 'devnet') => {
  const connection = getConnection(network)
  return createUmi((connection as any).rpcEndpoint || (connection as any)._rpcEndpoint)
}

export const getUmiCore = (network: 'mainnet-beta' | 'devnet' = 'mainnet-beta', walletAdapter?: any) => {
  let umi = createBaseUmi(network).use(mplCore())
  return walletAdapter ? umi.use(walletAdapterIdentity(walletAdapter)) : umi
}

export const getUmiCandy = (network: 'mainnet-beta' | 'devnet' = 'mainnet-beta', walletAdapter?: any) => {
  let umi = createBaseUmi(network).use(mplCandyMachine())
  const guardPlugin = (CandyGuardPlugin as any)?.mplCandyGuard?.()
  if (guardPlugin) {
    umi = umi.use(guardPlugin)
  }
  return walletAdapter ? umi.use(walletAdapterIdentity(walletAdapter)) : umi
}

export const getUmiBubblegum = (network: 'mainnet-beta' | 'devnet' = 'mainnet-beta', walletAdapter?: any) => {
  let umi = createBaseUmi(network)
  const bubblegumPlugin = (BubblegumPlugin as any)?.mplBubblegum?.()
  if (bubblegumPlugin) {
    umi = umi.use(bubblegumPlugin)
  }
  return walletAdapter ? umi.use(walletAdapterIdentity(walletAdapter)) : umi
}

// Backward compatible minimal Umi (no plugins)
export const getUmi = (network: 'mainnet-beta' | 'devnet' = 'mainnet-beta', walletAdapter?: any) => {
  const umi = createBaseUmi(network)
  return walletAdapter ? umi.use(walletAdapterIdentity(walletAdapter)) : umi
}
