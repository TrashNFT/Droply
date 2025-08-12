import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import { WalletAdapter } from '@solana/wallet-adapter-base'
import { getConnection } from '../solana/umi'
import { getConfig } from '@/config/platform'

// Get platform configuration
const config = getConfig()
const PLATFORM_WALLET_ADDRESS = new PublicKey(config.PLATFORM_WALLET_ADDRESS)
const PLATFORM_FEE_USD = config.PLATFORM_FEE_USD
const PLATFORM_FEE_SOL = (config as any).PLATFORM_FEE_SOL ?? undefined

interface MintRequest {
  candyMachineAddress: string
  creatorAddress: string
  mintPrice: number // in SOL
  quantity: number
  network: 'mainnet-beta' | 'devnet'
}

interface MintResult {
  success: boolean
  mintAddresses?: string[]
  transactionSignatures?: string[]
  totalPaid?: number
  platformFee?: number
  creatorAmount?: number
  error?: string
}

export class MintService {
  private connection: Connection
  private wallet: WalletAdapter
  private network: 'mainnet-beta' | 'devnet'

  constructor(wallet: WalletAdapter, network: 'mainnet-beta' | 'devnet' = 'mainnet-beta') {
    this.network = network
    this.connection = getConnection('mainnet-beta')
    this.wallet = wallet
  }

  private getFallbackRpcUrl(): string {
    return this.network === 'devnet'
      ? 'https://api.devnet.solana.com'
      : 'https://api.mainnet-beta.solana.com'
  }

  /**
   * Get current SOL price in USD from a price oracle or use hardcoded value
   * In production, you would use a real price feed like Pyth or Switchboard
   */
  private async getSolPriceInUSD(): Promise<number> {
    try {
      // Try live price first
      const url = config.SERVICES.PRICE_ORACLE_URL || 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
      const response = await fetch(url, { cache: 'no-store' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data: any = await response.json()
      // Support common response shapes
      const price = data?.solana?.usd ?? data?.price ?? data?.result ?? data?.USD ?? data?.usd
      if (typeof price !== 'number' || !isFinite(price) || price <= 0) {
        throw new Error('Invalid price payload')
      }
      return price
    } catch (error) {
      console.error('Failed to fetch SOL price, using fallback:', error)
      // Fallback price from config
      return config.SERVICES.FALLBACK_SOL_PRICE_USD
    }
  }

  /**
   * Convert USD amount to SOL lamports
   */
  private async convertUSDToLamports(usdAmount: number): Promise<number> {
    const solPrice = await this.getSolPriceInUSD()
    const solAmount = usdAmount / solPrice
    // Round up by a tiny epsilon to avoid underpay due to rounding
    return Math.ceil(solAmount * LAMPORTS_PER_SOL)
  }

  /**
   * Create atomic transaction for minting with platform fee
   */
  private async createMintTransaction(
    mintRequest: MintRequest,
    userPublicKey: PublicKey
  ): Promise<Transaction> {
    const transaction = new Transaction()

    // Calculate platform fee in lamports
    const platformFeeLamports = PLATFORM_FEE_SOL != null
      ? Math.ceil(PLATFORM_FEE_SOL * LAMPORTS_PER_SOL * mintRequest.quantity)
      : await this.convertUSDToLamports(PLATFORM_FEE_USD * mintRequest.quantity)
    
    // Calculate creator payment in lamports
    const creatorPaymentLamports = Math.floor(mintRequest.mintPrice * LAMPORTS_PER_SOL * mintRequest.quantity)
    
    // Total amount user needs to pay (mint price + platform fee)
    const totalLamports = creatorPaymentLamports + platformFeeLamports

    console.log(`Mint Details:`)
    console.log(`- Mint Price: ${mintRequest.mintPrice} SOL (${creatorPaymentLamports} lamports)`)
    console.log(`- Platform Fee: $${(PLATFORM_FEE_USD * mintRequest.quantity).toFixed(2)} USD (${platformFeeLamports} lamports)`)
    console.log(`- Total: ${totalLamports} lamports`)

    // Add payment to creator (if mint price > 0)
    if (creatorPaymentLamports > 0) {
      const payCreatorInstruction = SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: new PublicKey(mintRequest.creatorAddress),
        lamports: creatorPaymentLamports,
      })
      transaction.add(payCreatorInstruction)
    }

    // Add platform fee payment (always charged)
    const payPlatformInstruction = SystemProgram.transfer({
      fromPubkey: userPublicKey,
      toPubkey: PLATFORM_WALLET_ADDRESS,
      lamports: platformFeeLamports,
    })
    transaction.add(payPlatformInstruction)

    // TODO: Add actual Candy Machine mint instruction here
    // This would use the Metaplex Candy Machine v3 SDK
    // Example:
    // const mintInstruction = await createMintInstruction({
    //   candyMachine: new PublicKey(mintRequest.candyMachineAddress),
    //   minter: userPublicKey,
    //   // ... other params
    // })
    // transaction.add(mintInstruction)

    // Set recent blockhash and fee payer (fallback to public RPC if 401/Unauthorized)
    try {
      const { blockhash } = await this.connection.getLatestBlockhash('confirmed')
      transaction.recentBlockhash = blockhash
    } catch (e: any) {
      const msg = String(e?.message || e)
      if (msg.includes('Unauthorized') || msg.includes('401')) {
        this.connection = new Connection(this.getFallbackRpcUrl(), {
          commitment: 'confirmed',
          confirmTransactionInitialTimeout: 120_000,
        })
        const { blockhash } = await this.connection.getLatestBlockhash('confirmed')
        transaction.recentBlockhash = blockhash
      } else {
        throw e
      }
    }
    transaction.feePayer = userPublicKey

    return transaction
  }

  /**
   * Execute the mint transaction with payment splitting
   */
  async executeMint(mintRequest: MintRequest): Promise<MintResult> {
    try {
      // Validate wallet connection
      if (!this.wallet.publicKey) {
        throw new Error('Wallet not connected')
      }

      // Validate user has sufficient balance
      const userBalance = await this.connection.getBalance(this.wallet.publicKey)
      const platformFeeLamports = PLATFORM_FEE_SOL != null
        ? Math.ceil(PLATFORM_FEE_SOL * LAMPORTS_PER_SOL * mintRequest.quantity)
        : await this.convertUSDToLamports(PLATFORM_FEE_USD * mintRequest.quantity)
      const creatorPaymentLamports = Math.floor(mintRequest.mintPrice * LAMPORTS_PER_SOL * mintRequest.quantity)
      const totalRequired = creatorPaymentLamports + platformFeeLamports + 10000 // Add buffer for transaction fees

      if (userBalance < totalRequired) {
        const requiredSOL = totalRequired / LAMPORTS_PER_SOL
        const availableSOL = userBalance / LAMPORTS_PER_SOL
        throw new Error(
          `Insufficient balance. Required: ${requiredSOL.toFixed(4)} SOL, Available: ${availableSOL.toFixed(4)} SOL`
        )
      }

      // Create the transaction with payment splitting
      const transaction = await this.createMintTransaction(mintRequest, this.wallet.publicKey)

      // Send transaction directly using wallet adapter
      // The wallet adapter will handle signing internally
      let signature: string
      try {
        signature = await this.wallet.sendTransaction(transaction, this.connection, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        })
      } catch (e: any) {
        const msg = String(e?.message || e)
        if (msg.includes('Unauthorized') || msg.includes('401')) {
          // Retry once with fallback RPC
          this.connection = new Connection(this.getFallbackRpcUrl(), {
            commitment: 'confirmed',
            confirmTransactionInitialTimeout: 120_000,
          })
          signature = await this.wallet.sendTransaction(transaction, this.connection, {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
          })
        } else {
          throw e
        }
      }

      // Wait for confirmation
      await this.connection.confirmTransaction(signature, 'confirmed')

      console.log('Mint transaction confirmed:', signature)

      // Generate mock mint addresses (in production, extract from transaction logs)
      const mintAddresses = Array.from({ length: mintRequest.quantity }, () => 
        `NFT${Math.random().toString(36).substr(2, 9)}`
      )

      return {
        success: true,
        mintAddresses,
        transactionSignatures: [signature],
        totalPaid: (creatorPaymentLamports + platformFeeLamports) / LAMPORTS_PER_SOL,
        platformFee: platformFeeLamports / LAMPORTS_PER_SOL,
        creatorAmount: creatorPaymentLamports / LAMPORTS_PER_SOL,
      }

    } catch (error) {
      console.error('Mint execution failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown minting error',
      }
    }
  }

  /**
   * Get platform fee information for display purposes
   */
  async getPlatformFeeInfo(): Promise<{
    feeUSD: number
    feeSOL: number
    feeLamports: number
    solPrice: number
  }> {
    const solPrice = await this.getSolPriceInUSD()
    const feeLamports = PLATFORM_FEE_SOL != null
      ? Math.ceil(PLATFORM_FEE_SOL * LAMPORTS_PER_SOL)
      : await this.convertUSDToLamports(PLATFORM_FEE_USD)
    const feeSOL = PLATFORM_FEE_SOL != null ? PLATFORM_FEE_SOL : feeLamports / LAMPORTS_PER_SOL

    return {
      feeUSD: PLATFORM_FEE_USD,
      feeSOL,
      feeLamports,
      solPrice,
    }
  }

  /**
   * Calculate total cost for minting (including platform fee)
   */
  async calculateTotalCost(mintPrice: number, quantity: number): Promise<{
    mintCost: number
    platformFee: number
    total: number
    breakdown: {
      mintCostLamports: number
      platformFeeLamports: number
      totalLamports: number
    }
  }> {
    const platformFeeLamports = PLATFORM_FEE_SOL != null
      ? Math.ceil(PLATFORM_FEE_SOL * LAMPORTS_PER_SOL * quantity)
      : await this.convertUSDToLamports(PLATFORM_FEE_USD * quantity)
    const mintCostLamports = Math.floor(mintPrice * LAMPORTS_PER_SOL * quantity)
    const totalLamports = mintCostLamports + platformFeeLamports

    return {
      mintCost: mintPrice * quantity,
      platformFee: platformFeeLamports / LAMPORTS_PER_SOL,
      total: totalLamports / LAMPORTS_PER_SOL,
      breakdown: {
        mintCostLamports,
        platformFeeLamports,
        totalLamports,
      }
    }
  }
}

/**
 * Factory function to create MintService instance
 */
export const createMintService = (wallet: WalletAdapter, network: 'mainnet-beta' | 'devnet' = 'mainnet-beta') => {
  return new MintService(wallet, network)
}

/**
 * Utility function to validate platform wallet address
 */
export const validatePlatformWallet = (): boolean => {
  try {
    new PublicKey(PLATFORM_WALLET_ADDRESS)
    return true
  } catch {
    return false
  }
}

/**
 * Get platform wallet address (for configuration purposes)
 */
export const getPlatformWalletAddress = (): string => {
  return PLATFORM_WALLET_ADDRESS.toString()
}

// Export constants for external use
export { PLATFORM_WALLET_ADDRESS, PLATFORM_FEE_USD }
