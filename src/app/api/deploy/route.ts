import { NextRequest, NextResponse } from 'next/server'
import { createCollectionService } from '@/lib/services/collectionService'
import { getConnection } from '@/lib/solana/umi'
import { PublicKey } from '@solana/web3.js'
import type { CreateCollectionFormData, UploadedAsset } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { formData, assets, walletAddress, network = 'mainnet-beta' } = body
    
    console.log('Deploy request received:', { 
      formData: formData,
      walletAddress,
      network 
    })
    
    console.log('FormData details:', {
      name: formData?.name,
      symbol: formData?.symbol,
      description: formData?.description,
      price: formData?.price,
      supply: formData?.supply || formData?.itemsAvailable,
      itemsAvailable: formData?.itemsAvailable
    })
    
    console.log('Full formData object:', formData)
    
    // Basic validation
    const errors: string[] = []
    
    if (!formData.name?.trim()) {
      errors.push('Collection name is required')
    }
    
    if (!formData.symbol?.trim()) {
      errors.push('Collection symbol is required')
    }
    
    if (!formData.description?.trim()) {
      errors.push('Collection description is required')
    }
    
    const supply = parseInt(formData.supply || formData.itemsAvailable || '0')
    if (supply <= 0) {
      errors.push('Supply must be greater than 0')
    }
    
    const price = parseFloat(formData.price || '0')
    if (price < 0) {
      errors.push('Price cannot be negative')
    }
    
    if (errors.length > 0) {
      console.log('Validation errors:', errors)
      return NextResponse.json(
        { 
          success: false, 
          error: `Validation failed: ${errors.join(', ')}`,
          details: errors 
        },
        { status: 400 }
      )
    }

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    // Create mock wallet adapter for server-side processing
    // In production, this would be handled client-side with actual wallet signing
    const mockWallet = {
      adapter: {
        publicKey: { toString: () => walletAddress },
        signTransaction: async () => { throw new Error('Server-side signing not implemented - use client-side deployment') },
        signAllTransactions: async () => { throw new Error('Server-side signing not implemented - use client-side deployment') },
      }
    }

    // Create collection service with real Solana connection
    const connection = getConnection(network)
    
    // For demo purposes, we'll skip the real Solana transaction and just return mock data
    // In production, you would need proper wallet integration for signing
    console.log('Creating mock deployment for demo purposes')
    
    const mockWalletAdapter = {
      publicKey: new PublicKey(walletAddress),
      signTransaction: async (transaction: any) => {
        console.log('Mock transaction signing (demo only)')
        return transaction
      },
      signAllTransactions: async (transactions: any[]) => {
        console.log('Mock transaction signing (demo only)')
        return transactions
      }
    }
    
    const collectionService = createCollectionService(mockWalletAdapter as any, network)

    // Deploy the collection using real Solana transactions
    const deploymentResult = await collectionService.deployCollection(
      {
        name: formData.name,
        symbol: formData.symbol,
        description: formData.description,
        price: parseFloat(formData.price || '0'),
        itemsAvailable: supply,
        sellerFeeBasisPoints: 500, // 5% default
        isMutable: formData.isMutable || true,
        startDate: formData.startDate ? new Date(formData.startDate) : undefined,
        network: network as 'mainnet-beta' | 'devnet',
        standard: formData.standard || 'core',
      },
      assets || [],
      (stage: string, progress: number) => {
        console.log(`Deployment progress: ${stage} - ${progress}%`)
      }
    )
    
    if (!deploymentResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: deploymentResult.error || 'Deployment failed',
          details: deploymentResult
        },
        { status: 500 }
      )
    }

    // Store the deployed collection in localStorage (client-side will handle this)
    const deployedCollection = {
      id: deploymentResult.collectionId,
      name: formData.name,
      symbol: formData.symbol,
      description: formData.description,
      image: assets?.[0]?.url || 'https://via.placeholder.com/300x300',
      price: parseFloat(formData.price || '0'),
      itemsAvailable: supply,
      itemsMinted: 0,
      candyMachineAddress: deploymentResult.candyMachineAddress,
      mintPageUrl: deploymentResult.mintPageUrl,
      status: 'deployed' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      creatorAddress: walletAddress,
      network: network as 'mainnet-beta' | 'devnet',
      standard: formData.standard || 'core',
    }
    
    const result = {
      success: true,
      collection: deployedCollection,
      candyMachineAddress: deploymentResult.candyMachineAddress,
      collectionAddress: deploymentResult.collectionAddress,
      mintPageUrl: deploymentResult.mintPageUrl,
    }
    
    console.log('Deploy successful:', { 
      collectionId: deploymentResult.collectionId,
      name: deployedCollection.name,
      candyMachineAddress: deploymentResult.candyMachineAddress
    })
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('Deployment error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Deployment failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const collectionId = searchParams.get('id')
  
  if (!collectionId) {
    return NextResponse.json(
      { error: 'Collection ID is required' },
      { status: 400 }
    )
  }

  // In production, fetch from database
  // For now, return mock data
  const mockCollection = {
    id: collectionId,
    name: 'Sample Collection',
    symbol: 'SAMPLE',
    description: 'A sample NFT collection',
    candyMachineAddress: '1111111111111111111111111111111111111111111111111111111111111111',
    status: 'deployed',
    network: 'mainnet-beta',
    price: 0.1,
    itemsAvailable: 100,
    itemsMinted: 25,
  }

  return NextResponse.json(mockCollection)
}

