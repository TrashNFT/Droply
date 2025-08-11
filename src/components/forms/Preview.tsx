"use client"

import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Button } from '@/components/ui/Button'
import { CheckCircle, AlertCircle, Clock } from 'lucide-react'
import CollectionCard, { ApiCollectionRow } from '@/components/collections/CollectionCard'
import toast from 'react-hot-toast'

interface PreviewProps {
  formData: any
  onUpdate: (data: any) => void
  onNext: () => void
  onBack: () => void
  onDeploy: () => void
  isLastStep: boolean
}

export function Preview({
  formData,
  onUpdate,
  onNext,
  onBack,
  onDeploy,
  isLastStep,
}: PreviewProps) {
  const [deploying, setDeploying] = useState(false)
  const { publicKey, connected } = useWallet()

  const handleDeploy = async () => {
    if (!connected || !publicKey) {
      toast.error('Please connect your wallet first')
      return
    }

    console.log('Preview formData received:', formData)
    console.log('Assets:', formData.assets)
    console.log('Collection:', formData.collection)
    console.log('Mint Settings:', formData.mintSettings)

    setDeploying(true)
    try {
      // Use the main page's deployment function
      await onDeploy()
    } catch (error) {
      console.error('Deploy error:', error)
      toast.error(`Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setDeploying(false)
    }
  }

  const { assets, collection, mintSettings } = formData

  const previewCollection: ApiCollectionRow = {
    id: 'preview',
    name: collection?.name || 'Untitled',
    symbol: collection?.symbol || '',
    description: collection?.description || '',
    image_url: collection?.image || assets?.[0]?.preview || 'https://placehold.co/600x600/png?text=Collection',
    price: Number(mintSettings?.price || 0),
    items_available: mintSettings?.itemsAvailable || (assets?.length || 0),
    items_minted: 0,
    candy_machine_address: null,
    collection_address: null,
    mint_page_url: null,
    status: 'deployed',
    creator_address: publicKey?.toString(),
    network: (mintSettings?.network as any) || 'mainnet-beta',
    seller_fee_basis_points: mintSettings?.sellerFeeBasisPoints || 500,
    is_mutable: mintSettings?.isMutable ?? true,
    start_date: mintSettings?.startDate || null,
    end_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-2xl font-bold text-white">Preview & Deploy</h2>
        <p className="text-gray-300">Review your collection details before deploying to Solana.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Collection Preview (use the same card UI as homepage) */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Collection Preview</h3>
          <div className="max-w-md">
            <CollectionCard collection={previewCollection} />
          </div>
        </div>

        {/* Mint Settings Preview */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Mint Settings</h3>
          
          <div className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Price:</span>
              <span className="font-medium text-white">{formData.mintSettings?.price || 0} SOL</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Supply:</span>
              <span className="font-medium text-white">{formData.mintSettings?.itemsAvailable || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Network:</span>
              <span className="font-medium text-white">{formData.mintSettings?.network || 'mainnet-beta'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Seller Fee:</span>
              <span className="font-medium text-white">{(formData.mintSettings?.sellerFeeBasisPoints || 500) / 100}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Mutable:</span>
              <span className="font-medium text-white">{formData.mintSettings?.isMutable ? 'Yes' : 'No'}</span>
            </div>
          </div>

          {formData.mintSettings?.startDate && (
            <div className="rounded-lg border border-blue-400/20 bg-blue-400/10 p-4">
              <div className="flex items-center">
                <Clock className="mr-2 h-4 w-4 text-blue-300" />
                <span className="text-sm font-medium text-white">Start Date</span>
              </div>
              <p className="mt-1 text-sm text-blue-200">
                {new Date(formData.mintSettings.startDate).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Assets Preview */}
      {formData.assets && formData.assets.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold text-white">
            Assets ({formData.assets.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {formData.assets.slice(0, 6).map((asset: any, index: number) => (
              <div key={asset.id} className="overflow-hidden rounded-lg border border-[hsl(var(--border))]">
                <img
                  src={asset.preview}
                  alt={asset.name}
                  className="h-20 w-full object-cover"
                />
                <div className="p-2">
                  <p className="truncate text-xs text-gray-400">{asset.name}</p>
                </div>
              </div>
            ))}
            {formData.assets.length > 6 && (
              <div className="flex h-20 items-center justify-center rounded-lg border border-[hsl(var(--border))]">
                <span className="text-sm text-gray-400">
                  +{formData.assets.length - 6} more
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Deployment Info */}
      <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/10 p-4">
        <div className="flex items-start">
          <AlertCircle className="mr-3 mt-0.5 h-5 w-5 text-yellow-300" />
          <div>
            <h4 className="text-sm font-medium text-yellow-100">
              Deployment Information
            </h4>
            <ul className="mt-2 space-y-1 text-sm text-yellow-100/90">
              <li>• Your collection will be deployed to {formData.mintSettings?.network || 'mainnet-beta'}</li>
              <li>• Candy Machine v3 will be created on Solana</li>
              <li>• Assets will be uploaded to Arweave (decentralized storage)</li>
              <li>• You'll need SOL for transaction fees</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button 
          onClick={handleDeploy} 
          disabled={deploying || !connected}
          className="flex items-center"
        >
          {deploying ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Deploying...
            </>
          ) : !connected ? (
            <>
              <AlertCircle className="h-4 w-4 mr-2" />
              Connect Wallet to Deploy
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Deploy Collection
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

