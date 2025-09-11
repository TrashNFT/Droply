export interface NFTMetadata {
  name: string
  symbol: string
  description: string
  image: string
  attributes?: NFTAttribute[]
  properties?: {
    files?: Array<{
      type: string
      uri: string
    }>
    category?: string
  }
}

export interface NFTAttribute {
  trait_type: string
  value: string
}

export interface MintPhase {
  id: string
  name: string
  price: number
  maxPerWallet: number
  maxSupply?: number
  startDate?: string | Date
  endDate?: string | Date
  allowlist?: string[]
}

export interface CollectionConfig {
  name: string
  symbol: string
  description: string
  image: string
  sellerFeeBasisPoints: number
  creators?: Array<{
    address: string
    verified: boolean
    share: number
  }>
}

export interface CandyMachineConfig {
  price: number
  itemsAvailable: number
  sellerFeeBasisPoints: number
  symbol: string
  maxEditionSupply: number
  isMutable: boolean
  creators: Array<{
    address: string
    verified: boolean
    share: number
  }>
  collection: {
    name: string
    family: string
  }
  guards?: {
    solPayment?: {
      amount: number
      destination: string
    }
    startDate?: {
      date: Date
    }
    mintLimit?: {
      id: number
      limit: number
    }
  }
}

export interface UploadedAsset {
  id: string
  name: string
  file: File
  preview: string
  uploaded: boolean
  arweaveUrl?: string
  metadata?: NFTMetadata
}

export interface Collection {
  id: string
  slug?: string
  name: string
  symbol: string
  description: string
  image: string
  price: number
  itemsAvailable: number
  itemsMinted: number
  candyMachineAddress?: string
  mintPageUrl?: string
  status: 'draft' | 'deployed' | 'minting' | 'completed'
  createdAt: Date
  updatedAt: Date
  creatorAddress: string
  network: 'mainnet-beta' | 'devnet'
  // Token standard for this collection
  standard?: 'core' | 'legacy' | 'cnft'
  // Optional seller fee bps persisted alongside collection
  sellerFeeBasisPoints?: number
  // Core/Compressed specific
  coreCollectionAddress?: string
  merkleTreeAddress?: string
  // Legacy TM-compatibility: optional collection mint for on-chain display
  tmCollectionMint?: string
  // Optional item URIs for non-CM flows (Core/cNFT)
  itemUris?: string[]
  // Optional mint phases
  phases?: MintPhase[]
  // Base start/end window for implicit Public phase
  startDate?: string | Date | null
  endDate?: string | Date | null
}

export interface MintStats {
  totalMinted: number
  totalRevenue: number
  uniqueMinters: number
  averageMintTime: number
  mintHistory: Array<{
    timestamp: Date
    mints: number
    revenue: number
  }>
}

export interface WalletInfo {
  publicKey: string
  balance: number
  connected: boolean
}

export interface ArweaveUploadResult {
  transactionId: string
  url: string
  size: number
}

export interface CreateCollectionFormData {
  name: string
  symbol: string
  description: string
  slug?: string
  price: number
  itemsAvailable: number
  sellerFeeBasisPoints: number
  startDate?: Date
  endDate?: Date
  isMutable: boolean
  network: 'mainnet-beta' | 'devnet'
  standard?: 'core' | 'legacy' | 'cnft'
  phases?: MintPhase[]
  // Optional pre-hosted item URIs (skip uploads when provided)
  itemUris?: string[]
  // Optional: shuffle item order prior to CM insert
  shuffleItems?: boolean
  // cNFT: optional Merkle tree address to mint into
  merkleTreeAddress?: string
  // Creator address and optional persisted fields for API
  creatorAddress?: string
  image?: string
  candyMachineAddress?: string
  collectionAddress?: string
  mintPageUrl?: string
  // Core: optional pre-created collection address to skip creation
  preCollectionAddress?: string
  // Core/Legacy optional: pre-generated secret key for deterministic collection mint (JSON array or string)
  preCollectionSecret?: number[] | string
}

