'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useDropzone } from 'react-dropzone'
import { Upload, X, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

interface CollectionConfigProps {
  formData: any
  onUpdate: (data: any) => void
  onNext: () => void
  onBack: () => void
  onDeploy: () => void
  isLastStep: boolean
}

export function CollectionConfig({
  formData,
  onUpdate,
  onNext,
  onBack,
  onDeploy,
  isLastStep,
}: CollectionConfigProps) {
  const [collection, setCollection] = useState({
    name: formData.collection?.name || '',
    symbol: formData.collection?.symbol || '',
    description: formData.collection?.description || '',
    image: formData.collection?.image || '',
    website: formData.collection?.website || '',
    twitter: formData.collection?.twitter || '',
    discord: formData.collection?.discord || '',
    creators: formData.creators || [
      { address: formData?.creatorAddress || '', verified: true, share: 100 }
    ],
  })
  const [showCardPreview, setShowCardPreview] = useState(false)

  const cropToSquareUrl = async (file: File, size = 800): Promise<string> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        const s = Math.min(img.width, img.height)
        const sx = Math.floor((img.width - s) / 2)
        const sy = Math.floor((img.height - s) / 2)
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size)
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url)
          if (!blob) return reject(new Error('Crop failed'))
          const outUrl = URL.createObjectURL(blob)
          resolve(outUrl)
        }, file.type || 'image/png', 0.92)
      }
      img.onerror = () => reject(new Error('Image load failed'))
      img.src = url
    })
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0]
        try {
          const croppedUrl = await cropToSquareUrl(file)
          setCollection(prev => ({ ...prev, image: croppedUrl }))
          onUpdate({ collection: { ...collection, image: croppedUrl } })
        } catch {
          const preview = URL.createObjectURL(file)
          setCollection(prev => ({ ...prev, image: preview }))
          onUpdate({ collection: { ...collection, image: preview } })
        }
      }
    },
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    multiple: false,
  })

  const handleSneakInput = (index: number, value: string) => {
    const trimmed = value.trim()
    const key = 'sneakPeekImages'
    const next = Array.isArray((formData as any)?.[key]) ? [...(formData as any)[key]] : []
    next[index] = trimmed
    onUpdate({ [key]: next })
  }

  const handleInputChange = (field: string, value: string) => {
    const updatedCollection = { ...collection, [field]: value }
    setCollection(updatedCollection)
    onUpdate({ collection: updatedCollection, creators: updatedCollection.creators })
  }

  const handleNext = () => {
    if (!collection.name || !collection.symbol || !collection.description) {
      toast.error('Please fill in all required fields')
      return
    }
    onNext()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-2xl font-bold text-white">Collection Configuration</h2>
        <p className="text-gray-300">Configure your NFT collection details.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Collection Image */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-300">
              Collection Image *
            </label>
            {collection.image ? (
              <button type="button" onClick={() => setShowCardPreview(true)} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-gray-200 hover:bg-white/5">
                <Eye className="h-3.5 w-3.5" /> Preview on Card
              </button>
            ) : null}
          </div>
          <div className="text-xs text-gray-400 mb-2">Used on homepage cards and the mint page header. Recommended 1:1 (square), e.g., 800×800.</div>
          {/* Prefer HTTPS URL input for collection image */}
          <input
            type="url"
            placeholder="https://... (Collection image URL)"
            value={collection.image}
            onChange={(e)=>handleInputChange('image', e.target.value.trim())}
            className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <p className="text-xs text-gray-400 mt-1">Provide an HTTPS/IPFS gateway URL. This image appears on the homepage and mint header.</p>
          {/* Card preview modal */}
          {showCardPreview && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-sm rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-xl">
                <div className="overflow-hidden rounded-xl bg-[hsl(var(--muted))]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={collection.image || ''} alt="Preview" className="aspect-square w-full object-cover" />
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between">
                    <h4 className="text-base font-semibold text-white">{collection.name || 'Collection Name'}</h4>
                    <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-gray-300 ring-1 ring-inset ring-white/10">{collection.symbol || 'SYMB'}</span>
                  </div>
                  <div className="mb-2 text-sm text-gray-300">{(formData?.mintSettings?.price || 0) === 0 ? 'Free' : `${formData?.mintSettings?.price || 0} SOL`}</div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-primary-500" style={{ width: '12%' }} />
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-200 hover:bg-white/5" onClick={() => setShowCardPreview(false)}>Close</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Collection Details */}
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">
              Collection Name *
            </label>
            <input
              type="text"
              value={collection.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="My Awesome Collection"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">
              Symbol *
            </label>
            <input
              type="text"
              value={collection.symbol}
              onChange={(e) => handleInputChange('symbol', e.target.value.toUpperCase())}
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="MAC"
              maxLength={10}
            />
          </div>

          <div className="relative">
            <label className="mb-1 block text-sm font-medium text-gray-300">
              Description *
            </label>
            <textarea
              value={collection.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={4}
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Describe your collection..."
              maxLength={1000}
            />
            <div className="pointer-events-none absolute bottom-1 right-2 text-[11px] text-gray-400">
              {(collection.description || '').length}/1000
            </div>
          </div>
          {/* Optional Sneak Peeks for metadata-only uploads */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">Sneak peeks (optional, IPFS/HTTPS URLs)</label>
            <div className="space-y-2">
              {[0,1,2].map((i)=> (
                <input
                  key={i}
                  type="url"
                  onChange={(e)=>handleSneakInput(i, e.target.value)}
                  placeholder={`https://... (image ${i+1})`}
                  className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              ))}
              <p className="text-xs text-gray-400">If you upload IPFS metadata only, these will be shown on your mint page.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Social links (optional) */}
      <div className="grid gap-6 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">Website (optional)</label>
          <input
            type="url"
            value={collection.website}
            onChange={(e) => handleInputChange('website', e.target.value.trim())}
            className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="https://yoursite.xyz"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">Twitter/X (optional)</label>
          <input
            type="url"
            value={collection.twitter}
            onChange={(e) => handleInputChange('twitter', e.target.value.trim())}
            className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="https://x.com/yourhandle"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">Discord (optional)</label>
          <input
            type="url"
            value={collection.discord}
            onChange={(e) => handleInputChange('discord', e.target.value.trim())}
            className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="https://discord.gg/..."
          />
        </div>
      </div>

      {/* Creators & Splits */}
      <div className="space-y-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">Creators (royalty splits)</h3>
          <button
            type="button"
            className="text-sm text-primary-400"
            onClick={() => {
              const updated = {
                ...collection,
                creators: [...(collection.creators || []), { address: '', verified: false, share: 0 }]
              }
              setCollection(updated)
              onUpdate({ collection: updated, creators: updated.creators })
            }}
          >
            Add Creator
          </button>
        </div>
        <div className="space-y-2">
          {(collection.creators || []).map((cr: any, i: number) => (
            <div key={i} className="grid grid-cols-1 items-center gap-2 md:grid-cols-12">
              <input
                className="md:col-span-7 rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-2 text-sm text-white"
                placeholder="Creator wallet address"
                value={cr.address}
                onChange={(e) => {
                  const creators = [...(collection.creators || [])]
                  creators[i] = { ...creators[i], address: e.target.value }
                  const updated = { ...collection, creators }
                  setCollection(updated)
                  onUpdate({ collection: updated, creators })
                }}
              />
              <label className="md:col-span-2 inline-flex items-center space-x-2 text-sm text-white">
                <input
                  type="checkbox"
                  checked={!!cr.verified}
                  onChange={(e) => {
                    const creators = [...(collection.creators || [])]
                    creators[i] = { ...creators[i], verified: e.target.checked }
                    const updated = { ...collection, creators }
                    setCollection(updated)
                    onUpdate({ collection: updated, creators })
                  }}
                  className="h-4 w-4 rounded border-[hsl(var(--border))] text-primary-500 focus:ring-primary-500"
                />
                <span className="select-none">Verified</span>
              </label>
              <input
                type="number"
                className="md:col-span-2 rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-2 text-sm text-white"
                placeholder="Share %"
                value={cr.share}
                onChange={(e) => {
                  const creators = [...(collection.creators || [])]
                  creators[i] = { ...creators[i], share: parseInt(e.target.value) || 0 }
                  const updated = { ...collection, creators }
                  setCollection(updated)
                  onUpdate({ collection: updated, creators })
                }}
              />
              <div className="md:col-span-1 text-right">
                <button
                  type="button"
                  className="text-xs text-red-400"
                  onClick={() => {
                    const creators = (collection.creators || []).filter((_, idx) => idx !== i)
                    const updated = { ...collection, creators }
                    setCollection(updated)
                    onUpdate({ collection: updated, creators })
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-400">Ensure total shares sum to 100.</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleNext}>
          Next: Mint Settings
        </Button>
      </div>
    </div>
  )
}


