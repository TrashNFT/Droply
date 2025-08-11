// @ts-nocheck
import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram, sendAndConfirmTransaction, Keypair, TransactionInstruction } from '@solana/web3.js'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters'
import { create as cmCreate, mintV2, addConfigLines, fetchCandyMachine, setCollection, update as cmUpdate } from '@metaplex-foundation/mpl-candy-machine'
import { mplCandyGuard } from '@metaplex-foundation/mpl-candy-guard'
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata'
import { WalletAdapter } from '@solana/wallet-adapter-base'

// Platform configuration
const PLATFORM_WALLET_ADDRESS = process.env.PLATFORM_WALLET_ADDRESS || 'J17NcCGvRzY82yp5nw2RYngfdQy6RivravcTnJfKSne3'
const PLATFORM_FEE_USD = parseFloat(process.env.PLATFORM_FEE_USD || '1.0')

// Mock SOL price for development (in production, fetch from an oracle)
const SOL_PRICE_USD = 50.0 // $50 per SOL (update this or fetch from API)

/**
 * Convert SOL to lamports
 */
export function solToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL)
}

/**
 * Convert USD to SOL using current price
 */
export function usdToSol(usd: number): number {
  return usd / SOL_PRICE_USD
}

/**
 * Get platform fee in lamports ($1 USD equivalent)
 */
export function getPlatformFeeLamports(): number {
  const platformFeeSOL = usdToSol(PLATFORM_FEE_USD)
  return solToLamports(platformFeeSOL)
}

/**
 * Check if a collection is free mint (0 SOL price)
 */
export function isFreeMint(price: number): boolean {
  return price === 0
}

/**
 * Calculate total cost for minting (mint price + platform fee)
 */
export function calculateMintCost(mintPriceSOL: number): {
  mintPrice: number
  platformFee: number
  total: number
  mintPriceLamports: number
  platformFeeLamports: number
  totalLamports: number
} {
  const platformFeeSOL = usdToSol(PLATFORM_FEE_USD)
  const totalSOL = mintPriceSOL + platformFeeSOL

  return {
    mintPrice: mintPriceSOL,
    platformFee: platformFeeSOL,
    total: totalSOL,
    mintPriceLamports: solToLamports(mintPriceSOL),
    platformFeeLamports: getPlatformFeeLamports(),
    totalLamports: solToLamports(totalSOL)
  }
}

/**
 * Real Solana Candy Machine Service with actual blockchain transactions
 */
export class SolanaCandyMachineService {
  private connection: Connection
  private wallet: any
  private umi: any

  constructor(connection: Connection, wallet: any = null) {
    this.connection = connection
    this.wallet = wallet
    // Umi client setup for mainnet/devnet (uses same RPC URL as connection)
    const umi = createUmi((connection as any).rpcEndpoint || (connection as any)._rpcEndpoint)
      .use(walletAdapterIdentity(wallet))
      .use(mplTokenMetadata())
      .use(mplCandyGuard())
    this.umi = umi
  }

  /**
   * Deploy a Candy Machine (demo version with mock transactions)
   */
  async deployCandyMachine(params: {
    collectionMint: string
    itemUris: string[]
    mintPriceSol: number
    goLiveDate?: Date
  }): Promise<{
    candyMachineAddress: string
    collectionAddress: string
    transactionSignature: string
  }> {
    try {
      const umi = this.umi
      const payer = umi.identity

      // Create Candy Machine (configurable guards kept minimal)
      const priceLamports = BigInt(Math.floor(params.mintPriceSol * LAMPORTS_PER_SOL))
      const goLive = params.goLiveDate ? BigInt(Math.floor(params.goLiveDate.getTime() / 1000)) : undefined

      const createIx = cmCreate(umi, {
        // minimal CMV3 config
        price: priceLamports,
        itemsAvailable: BigInt(params.itemUris.length),
        goLiveDate: goLive,
      })

      const { signature, candyMachine } = await createIx.sendAndConfirm(umi, {
        send: { commitment: 'confirmed' },
        confirm: { commitment: 'confirmed', timeout: 120_000 },
      })

      // Insert items
      const addItemsIx = addConfigLines(umi, {
        candyMachine,
        index: 0,
        configLines: params.itemUris.map((uri, i) => ({ name: `Item #${i + 1}`, uri })),
      })
      await addItemsIx.sendAndConfirm(umi, {
        send: { commitment: 'confirmed' },
        confirm: { commitment: 'confirmed', timeout: 120_000 },
      })

      // Set collection
      const collectionMint = params.collectionMint
      const setCollectionIx = setCollection(umi, {
        candyMachine,
        collectionMint: collectionMint as any,
      })
      await setCollectionIx.sendAndConfirm(umi, {
        send: { commitment: 'confirmed' },
        confirm: { commitment: 'confirmed', timeout: 120_000 },
      })

      return {
        candyMachineAddress: candyMachine.toString(),
        collectionAddress: collectionMint,
        transactionSignature: signature.toString(),
      }
    } catch (error) {
      console.error('Error deploying Candy Machine:', error)
      throw new Error(`Failed to deploy Candy Machine: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Mint an NFT (demo version with mock transactions)
   */
  async mintNFT(params: { candyMachineAddress: string }): Promise<{ nftAddress: string; transactionSignature: string }> {
    try {
      const umi = this.umi
      const result = await mintV2(umi, { candyMachine: params.candyMachineAddress as any }).sendAndConfirm(umi)
      // Extract minted NFT from logs is non-trivial; placeholder here
      return { nftAddress: 'unknown', transactionSignature: result.signature.toString() }
    } catch (error) {
      console.error('Error minting NFT:', error)
      throw new Error(`Failed to mint NFT: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get candy machine state from blockchain
   */
  async getCandyMachineState(candyMachineAddress: string): Promise<{
    itemsAvailable: number
    itemsMinted: number
    price: number
    goLiveDate: Date
    isActive: boolean
    isMintLive: boolean
  }> {
    try {
      // For now, return mock state since we need to implement proper Candy Machine v3 state fetching
      // In production, this would fetch real data from the Candy Machine v3 program
      return {
        itemsAvailable: 100,
        itemsMinted: 0,
        price: 0.1,
        goLiveDate: new Date(),
        isActive: true,
        isMintLive: true
      }
    } catch (error) {
      console.error('Error getting candy machine state:', error)
      throw error
    }
  }
}

/**
 * Create a candy machine service instance
 */
export function createCandyMachineService(
  connection: Connection, 
  wallet: any = null
): SolanaCandyMachineService {
  return new SolanaCandyMachineService(connection, wallet)
}

/**
 * Get platform configuration
 */
export function getPlatformConfig() {
  return {
    platformWalletAddress: PLATFORM_WALLET_ADDRESS,
    platformFeeUSD: PLATFORM_FEE_USD,
    solPriceUSD: SOL_PRICE_USD
  }
}
