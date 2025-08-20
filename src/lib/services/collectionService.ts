import { WalletAdapter } from '@solana/wallet-adapter-base'
import { Connection, PublicKey } from '@solana/web3.js'
import { SolanaCandyMachineService, isFreeMint, solToLamports } from '../solana/candyMachine'
import { arweaveService } from '../storage/arweave'
import { getConnection } from '../solana/umi'
import type { CreateCollectionFormData, NFTMetadata, Collection, UploadedAsset } from '@/types'

export interface DeploymentResult {
  success: boolean
  collectionId: string
  candyMachineAddress: string
  collectionAddress: string
  mintPageUrl: string
  error?: string
}

export class CollectionService {
  private connection: Connection
  private wallet: any // Changed to any to handle different wallet formats
  private candyMachineService: SolanaCandyMachineService

  constructor(wallet: any, network: 'mainnet-beta' | 'devnet' = 'mainnet-beta') {
    this.connection = getConnection(network)
    this.wallet = wallet
    this.candyMachineService = new SolanaCandyMachineService(this.connection, wallet)
  }

  async deployCollection(
    formData: CreateCollectionFormData,
    assets: UploadedAsset[],
    onProgress?: (stage: string, progress: number) => void
  ): Promise<DeploymentResult> {
    try {
      // Handle different wallet formats
      const publicKey = this.wallet?.publicKey || this.wallet?.adapter?.publicKey
      if (!publicKey) {
        throw new Error('Wallet not connected')
      }

      const collectionId = `collection_${Date.now()}`
      
      // Stage 1: Upload assets to Arweave
      onProgress?.('Uploading assets to Arweave...', 10)
      
      console.log('Assets received:', assets)
      
      // Handle assets that might not have proper File objects
      const files = assets.map(asset => {
        console.log('Processing asset:', asset)
        return asset.file || asset
      })
      
      const collectionMetadata = {
        name: formData.name,
        symbol: formData.symbol,
        description: formData.description,
      }
      
      console.log('Uploading to Arweave with files:', files.length)
      
      const { imageUris, metadataUris } = await arweaveService.uploadCollection(
        files,
        collectionMetadata,
        (uploadProgress) => {
          onProgress?.('Uploading assets to Arweave...', 10 + (uploadProgress * 0.4))
        }
      )
      
      onProgress?.('Creating NFT metadata...', 50)
      
      // Create NFT metadata array
      const nftMetadata: NFTMetadata[] = files.map((file, index) => ({
        name: `${formData.name} #${index + 1}`,
        symbol: formData.symbol,
        description: formData.description,
        image: imageUris[index],
        attributes: [
          {
            trait_type: 'Collection',
            value: formData.name,
          },
          {
            trait_type: 'Edition',
            value: (index + 1).toString(),
          },
        ],
        properties: {
          files: [
            {
              type: file.type,
              uri: imageUris[index],
            },
          ],
          category: 'image',
        },
      }))
      
      onProgress?.('Deploying Candy Machine v3...', 60)
      
      // Stage 2: Deploy Candy Machine
      const candyMachineSettings = {
        itemsAvailable: formData.itemsAvailable,
        symbol: formData.symbol,
        maxEditionSupply: 0, // Set to 0 for unique NFTs
        isMutable: formData.isMutable,
        creators: [
          {
            address: publicKey.toString(),
            verified: true,
            share: 100,
          },
        ],
        collection: {
          name: formData.name,
          symbol: formData.symbol,
          description: formData.description,
          image: imageUris[0], // Use first image as collection image
        },
        guards: {
          ...(formData.price > 0 && {
            solPayment: {
              lamports: solToLamports(formData.price),
              destination: this.wallet.publicKey.toString(),
            },
          }),
          ...(formData.startDate && {
            startDate: {
              date: formData.startDate.toISOString(),
            },
          }),
        },
      }
      
      // First, create collection NFT and upload assets via client (already done in client deploy flow)
      // Here, we expect imageUris/metadataUris; if available, deploy CMv3
      const deployment = await this.candyMachineService.deployCandyMachine({
        collectionMint: 'pending-from-client',
        itemUris: metadataUris,
        mintPriceSol: formData.price,
        goLiveDate: formData.startDate,
      })
      
      onProgress?.('Finalizing deployment...', 90)
      
      // Generate mint page URL
      const mintPageUrl = `/mint/${collectionId}`
      
      onProgress?.('Deployment complete!', 100)
      
      return {
        success: true,
        collectionId,
        candyMachineAddress: deployment.candyMachineAddress,
        collectionAddress: deployment.collectionAddress,
        mintPageUrl,
      }
      
    } catch (error) {
      console.error('Deployment error:', error)
      return {
        success: false,
        collectionId: '',
        candyMachineAddress: '',
        collectionAddress: '',
        mintPageUrl: '',
        error: error instanceof Error ? error.message : 'Unknown deployment error',
      }
    }
  }

  async mintNFT(candyMachineAddress: string): Promise<{ success: boolean; mintAddress?: string; error?: string }> {
    try {
      if (!this.wallet.publicKey) {
        throw new Error('Wallet not connected')
      }

      const result = await this.candyMachineService.mintNFT({ candyMachineAddress: candyMachineAddress as any })
      
      return {
        success: true,
        mintAddress: result.nftAddress,
      }
      
    } catch (error) {
      console.error('Mint error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown mint error',
      }
    }
  }

  async getCandyMachineInfo(candyMachineAddress: string): Promise<any> {
    try {
      return await this.candyMachineService.getCandyMachineState(candyMachineAddress)
    } catch (error) {
      console.error('Error fetching candy machine info:', error)
      throw error
    }
  }

  // Check if collection is free mint
  isFreeMint(price: number): boolean {
    return isFreeMint(price)
  }

  // Get network info
  getNetworkInfo() {
    return {
      network: this.connection.rpcEndpoint.includes('devnet') ? 'devnet' : 'mainnet-beta',
      rpcUrl: this.connection.rpcEndpoint,
    }
  }
}

// Utility functions
export const createCollectionService = (wallet: WalletAdapter, network: 'mainnet-beta' | 'devnet' = 'mainnet-beta') => {
  return new CollectionService(wallet, network)
}

export const validateCollectionData = (formData: CreateCollectionFormData, assets: UploadedAsset[]): string[] => {
  const errors: string[] = []
  
  if (!formData.name.trim()) {
    errors.push('Collection name is required')
  }
  
  if (!formData.symbol.trim()) {
    errors.push('Collection symbol is required')
  }
  
  if (!formData.description.trim()) {
    errors.push('Collection description is required')
  }
  
  if (formData.itemsAvailable <= 0) {
    errors.push('Items available must be greater than 0')
  }
  
  if (formData.price < 0) {
    errors.push('Price cannot be negative')
  }
  
  if (assets.length === 0) {
    errors.push('At least one asset is required')
  }
  
  if (formData.itemsAvailable > assets.length) {
    errors.push(`Items available (${formData.itemsAvailable}) cannot exceed number of assets (${assets.length})`)
  }
  
  return errors
}
