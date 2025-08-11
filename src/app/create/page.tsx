"use client"

import { useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { AssetUpload } from '@/components/forms/AssetUpload'
import { CollectionConfig } from '@/components/forms/CollectionConfig'
import { MintSettings } from '@/components/forms/MintSettings'
import { Preview } from '@/components/forms/Preview'
import { ArrowLeft, ArrowRight, Check, Upload, Settings } from 'lucide-react'
import Image from 'next/image'
import { PLATFORM_CONFIG } from '@/config/platform'
import CreatePreviewPanel from '@/components/forms/CreatePreviewPanel'
import toast from 'react-hot-toast'
import { saveDeployedCollection, removeDeployedCollection } from '@/lib/utils/collectionStorage'
import { deployCollectionClient } from '@/lib/services/collectionService.client'

const steps = [
  { id: 1, name: 'Upload Assets', component: AssetUpload },
  { id: 2, name: 'Collection Config', component: CollectionConfig },
  { id: 3, name: 'Mint Settings', component: MintSettings },
  { id: 4, name: 'Preview & Deploy', component: Preview },
]

export default function CreatePage() {
  const { connected, publicKey, wallet } = useWallet()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<any>({
    assets: [],
    collection: {},
    mintSettings: {},
  })
  // Removed draft save/restore: no client-side draft persistence

  // NOTE: Do not early-return before hooks; render gating happens below

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleFormDataUpdate = (stepData: any) => {
    setFormData((prev: any) => ({
      ...prev,
      ...stepData,
    }))
  }

  const handleDeploy = async () => {
    let loadingToast: string | undefined
    
    try {
      if (!publicKey) {
        toast.error('Please connect your wallet first')
        return
      }

      loadingToast = toast.loading('Deploying your collection...')

      const network = formData.mintSettings?.network || 'mainnet-beta'

      const deployment = await deployCollectionClient(
        wallet?.adapter || {
          publicKey,
          signTransaction: undefined,
          signAllTransactions: undefined,
        },
        {
          name: formData.collection?.name || '',
          symbol: formData.collection?.symbol || '',
          description: formData.collection?.description || '',
          price: parseFloat(formData.mintSettings?.price || '0'),
          itemsAvailable: formData.mintSettings?.itemsAvailable || (formData.itemUris?.length || formData.assets?.length || 0),
          sellerFeeBasisPoints: formData.mintSettings?.sellerFeeBasisPoints || 500,
          isMutable: formData.mintSettings?.isMutable ?? true,
          startDate: formData.mintSettings?.startDate ? new Date(formData.mintSettings.startDate) : undefined,
          shuffleItems: formData.mintSettings?.shuffleItems || false,
          merkleTreeAddress: formData.mintSettings?.merkleTreeAddress || '',
          itemUris: formData.itemUris || [],
          network,
          standard: formData.mintSettings?.standard || 'core',
        } as any,
        formData.assets || [],
        network,
        (stage, progress) => {
          console.log(`Deployment progress: ${stage} - ${progress}%`)
        }
      )

      if (!deployment.success) {
        throw new Error(deployment.error || 'Deployment failed')
      }

      const now = new Date()
          const collection = {
        id: deployment.collectionMint,
        name: formData.collection?.name || '',
        symbol: formData.collection?.symbol || '',
        description: formData.collection?.description || '',
          image: formData.collection?.image || formData.assets?.[0]?.preview || 'https://via.placeholder.com/300x300',
        price: parseFloat(formData.mintSettings?.price || '0'),
        itemsAvailable: formData.mintSettings?.itemsAvailable || (formData.assets?.length || 0),
        itemsMinted: 0,
        candyMachineAddress: deployment.candyMachineAddress,
        mintPageUrl: deployment.mintPageUrl,
        status: 'deployed' as const,
        createdAt: now,
        updatedAt: now,
        creatorAddress: publicKey.toString(),
        network: network,
        standard: formData.mintSettings?.standard || 'core',
        itemUris: deployment.itemUris || [],
        phases: formData.mintSettings?.phases || [],
            sneakPeekImages: (formData?.sneakPeekImages || []).slice(0,3),
      }
      saveDeployedCollection(collection)
      // Also persist to server so all browsers can see it
      try {
        const res = await fetch('/api/collections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            name: collection.name,
            symbol: collection.symbol,
            description: collection.description,
            image: collection.image || deployment.collectionImageUri || '',
            price: collection.price,
            itemsAvailable: collection.itemsAvailable,
            candyMachineAddress: collection.candyMachineAddress,
            collectionAddress: deployment.collectionMint,
            mintPageUrl: collection.mintPageUrl,
            creatorAddress: collection.creatorAddress,
            network: collection.network,
            sellerFeeBasisPoints: formData.mintSettings?.sellerFeeBasisPoints || 500,
            isMutable: formData.mintSettings?.isMutable ?? true,
              startDate: formData.mintSettings?.startDate || null,
              endDate: formData.mintSettings?.endDate || null,
            phases: formData.mintSettings?.phases || [],
            itemUris: collection.itemUris,
            standard: collection.standard || 'core',
              sneakPeekImages: (collection as any).sneakPeekImages || [],
                website: formData?.website || null,
                twitter: formData?.twitter || null,
                discord: formData?.discord || null,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          console.error('[create] /api/collections failed', res.status, err)
          throw new Error(err?.error || `API returned ${res.status}`)
        }
      } catch (e) {
        console.warn('Failed to persist collection to server API:', e)
      }
      
      if (loadingToast) {
        toast.dismiss(loadingToast)
      }
      toast.success('Collection deployed successfully!')
      
      // Redirect to dashboard
      router.push('/dashboard')
    } catch (error) {
      if (loadingToast) {
        toast.dismiss(loadingToast)
      }
      toast.error(`Failed to deploy collection: ${error instanceof Error ? error.message : 'Unknown error'}`)
      console.error('Deployment error:', error)
    }
  }

  const CurrentStepComponent = steps[currentStep - 1].component

  // Draft save/restore removed: deployment flow requires completing steps in one session

  return (
    <div className="min-h-screen bg-dots">
      {!connected && (
        <div className="flex items-center justify-center p-6">
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-bold text-white">Connect Your Wallet</h1>
            <p className="mb-6 text-gray-300">Please connect your Solana wallet to create a collection</p>
            <Button onClick={() => router.push('/')}>Go Back</Button>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2 text-white">
            <Image src={PLATFORM_CONFIG.PLATFORM_LOGO_SRC} alt={PLATFORM_CONFIG.PLATFORM_NAME} width={20} height={20} className="h-5 w-5" />
            <h1 className="text-xl font-semibold">Create NFT Collection</h1>
          </div>
          <div className="text-sm text-gray-400">Step {currentStep} of {steps.length}</div>
        </div>
      </header>

      {/* Main Content with left sidebar stepper */}
      <div className="container mx-auto px-4 pb-24 pt-6">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
          {/* Left vertical stepper */}
          <aside className="md:col-span-3">
            <div className="sticky top-24 space-y-6">
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                <div className="mb-3 text-sm font-semibold text-white">Create Collection</div>
                <ol className="space-y-3 text-sm">
                  {steps.map((s) => (
                    <li key={s.id} className={`flex items-start gap-3 ${currentStep === s.id ? 'text-white' : 'text-gray-400'}`}>
                      <span className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full ring-1 ring-inset ${currentStep === s.id ? 'bg-primary-500 text-white ring-primary-400/40' : 'bg-white/5 text-gray-300 ring-white/10'}`}>{s.id}</span>
                      <div>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-gray-500">{s.id === 1 ? 'Upload your images' : s.id === 2 ? 'Basics & socials' : s.id === 3 ? 'Phases & pricing' : 'Review & deploy'}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              {/* Live preview card */}
              <CreatePreviewPanel formData={formData} />
            </div>
          </aside>

          {/* Right panel */}
          <section className="md:col-span-9">
            {/* Section title mirrors current step for clarity */}
            <h2 className="mb-3 text-xl font-semibold text-white">
              {currentStep === 1 && 'Upload Assets'}
              {currentStep === 2 && 'Collection Config'}
              {currentStep === 3 && 'Mint Settings'}
              {currentStep === 4 && 'Preview & Deploy'}
            </h2>
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
              <CurrentStepComponent
                formData={formData}
                onUpdate={(d:any)=>{
                  handleFormDataUpdate(d);
                  // bubble socials into root for API save after deploy
                  if (d?.collection) {
                    const { website,twitter,discord } = d.collection
                    setFormData((prev:any)=>({ ...prev, website, twitter, discord }))
                  }
                }}
                onNext={handleNext}
                onBack={handleBack}
                onDeploy={handleDeploy}
                isLastStep={currentStep === steps.length}
              />
            </div>
          </section>
        </div>
      </div>
      {/* Mobile bottom actions */}
      <div className="fixed inset-x-0 bottom-0 z-40 block border-t border-[hsl(var(--border))] bg-[hsl(var(--card))]/90 p-3 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-3">
          <button
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white"
            onClick={handleNext}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}

