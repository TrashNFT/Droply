'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/Button'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import type { UploadedAsset } from '@/types'
import toast from 'react-hot-toast'

interface AssetUploadProps {
  formData: any
  onUpdate: (data: any) => void
  onNext: () => void
  onBack: () => void
  onDeploy: () => void
  isLastStep: boolean
}

export function AssetUpload({
  formData,
  onUpdate,
  onNext,
  onBack,
  onDeploy,
  isLastStep,
}: AssetUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [assets, setAssets] = useState<UploadedAsset[]>(formData.assets || [])
  const [inputMode, setInputMode] = useState<'upload' | 'uris'>(
    (formData.itemUris && formData.itemUris.length > 0) ? 'uris' : 'upload'
  )
  const [baseUri, setBaseUri] = useState('')
  const [startIndex, setStartIndex] = useState<number>(1)
  const [count, setCount] = useState<number>(0)
  const [pattern, setPattern] = useState<string>('{index}.json')
  const [manifestUrl, setManifestUrl] = useState<string>('')
  const [collectionAddress, setCollectionAddress] = useState<string>('')
  const [injecting, setInjecting] = useState<boolean>(false)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploading(true)
    
    try {
      const images: File[] = []
      const jsons: File[] = []
      acceptedFiles.forEach((f) => {
        if (f.type.startsWith('image/')) images.push(f)
        else if (f.name.toLowerCase().endsWith('.json')) jsons.push(f)
      })

      // Index JSONs by base name (without extension)
      const jsonByBase = new Map<string, File>()
      for (const jf of jsons) {
        const base = jf.name.replace(/\.json$/i, '')
        jsonByBase.set(base, jf)
      }

      const newAssets: UploadedAsset[] = []
      for (const file of images) {
        const base = file.name.replace(/\.[^.]+$/i, '')
        let metadata: any | undefined
        const jf = jsonByBase.get(base)
        if (jf) {
          try {
            const text = await jf.text()
            metadata = JSON.parse(text)
          } catch (e) {
            console.warn('Failed to parse metadata JSON for', base, e)
          }
        }

        const asset: UploadedAsset = {
          id: Date.now().toString() + Math.random(),
          name: file.name,
          file,
          preview: URL.createObjectURL(file),
          uploaded: false,
          metadata,
        }
        newAssets.push(asset)
      }

      const updated = [...assets, ...newAssets]
      setAssets(updated)
      onUpdate({ assets: updated })
      
      toast.success(`Added ${newAssets.length} images${jsons.length ? ` with ${jsons.length} metadata file(s)` : ''}`)
    } catch (error) {
      toast.error('Failed to add assets')
      console.error('Asset upload error:', error)
    } finally {
      setUploading(false)
    }
  }, [assets, onUpdate])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'application/json': ['.json'],
    },
    multiple: true,
  })

  const removeAsset = (id: string) => {
    const updatedAssets = assets.filter(asset => asset.id !== id)
    setAssets(updatedAssets)
    onUpdate({ assets: updatedAssets })
  }

  const handleNext = async () => {
    if (inputMode === 'upload') {
      if (assets.length === 0) {
        toast.error('Please upload at least one asset')
        return
      }
    } else {
      let uris = (formData.itemUris || []).filter((s: string) => s && s.trim() !== '')
      // If none pasted, try manifest or base pattern
      if (uris.length === 0) {
        try {
          if (manifestUrl.trim()) {
            const res = await fetch(manifestUrl.trim())
            const json = await res.json()
            if (Array.isArray(json)) {
              uris = json.map((s) => String(s)).filter(Boolean)
              onUpdate({ itemUris: uris })
            }
          }
        } catch (e) {
          console.warn('Failed to load manifest URL', e)
        }
      }
      if (uris.length === 0 && baseUri.trim() && count > 0) {
        const cleanBase = baseUri.replace(/\/+$/, '')
        const out: string[] = []
        for (let i = 0; i < count; i++) {
          const idx = startIndex + i
          const name = pattern.replace('{index}', String(idx))
          out.push(`${cleanBase}/${name}`)
        }
        uris = out
        onUpdate({ itemUris: out })
      }
      if (uris.length === 0) {
        toast.error('Provide URIs, a manifest URL, or a base URI + count')
        return
      }
    }
    onNext()
  }

  const buildUrisFromInputs = (): string[] => {
    let uris = (formData.itemUris || []).filter((s: string) => s && s.trim() !== '')
    if (uris.length > 0) return uris
    // Try manifest first
    // Note: manifest is processed during handleNext, but for ad-hoc rebuild we attempt base pattern
    if (baseUri.trim() && count > 0) {
      const cleanBase = baseUri.replace(/\/+$/, '')
      const out: string[] = []
      for (let i = 0; i < count; i++) {
        const idx = startIndex + i
        const name = pattern.replace('{index}', String(idx))
        out.push(`${cleanBase}/${name}`)
      }
      return out
    }
    return uris
  }

  const handleInjectCollectionKey = async () => {
    try {
      const addr = collectionAddress.trim()
      if (!addr || addr.length < 32) {
        toast.error('Enter a valid collection address')
        return
      }
      const uris = buildUrisFromInputs()
      if (!uris || uris.length === 0) {
        toast.error('Provide URIs, a manifest URL, or a base URI + count')
        return
      }
      setInjecting(true)
      const res = await fetch('/api/utils', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rebuildMetadataWithCollection',
          network: formData?.mintSettings?.network || 'mainnet-beta',
          collectionAddress: addr,
          uris,
          skipIfPresent: true,
          concurrency: 8,
          preferGateway: 'irys',
          returnGateway: 'irys',
        }),
      })
      const js = await res.json()
      if (!res.ok || !js?.ok) {
        throw new Error(js?.error || 'Failed to rebuild metadata')
      }
      const results: Record<string, string> = js.results || {}
      const newUris = uris.map((u) => results[u] || u)
      if (!newUris || newUris.length === 0) {
        throw new Error('No URIs returned')
      }
      // Update form
      onUpdate({ itemUris: newUris })
      toast.success(`Updated ${js.succeeded || newUris.length} / ${js.total || newUris.length} metadata URIs`)
    } catch (e: any) {
      toast.error(e?.message || 'Injection failed')
    } finally {
      setInjecting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-2xl font-bold text-white">Upload Your NFT Assets</h2>
        <p className="text-gray-300">Upload your NFT images. You can upload multiple files at once.</p>
      </div>

      {/* Toggle between Upload and URIs */}
      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <label className="mb-2 block text-sm font-medium text-gray-300">Provide Assets</label>
        <div className="flex items-center space-x-4">
          <label className="inline-flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="assetInputMode"
              checked={inputMode === 'upload'}
              onChange={() => { setInputMode('upload'); onUpdate({ itemUris: [] }) }}
            />
            <span className="text-white">Upload images</span>
          </label>
          <label className="inline-flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="assetInputMode"
              checked={inputMode === 'uris'}
              onChange={() => { setInputMode('uris'); setAssets([]) }}
            />
            <span className="text-white">Paste metadata URIs</span>
          </label>
        </div>
        {inputMode === 'uris' ? (
          <textarea
            className="mt-3 w-full rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 text-sm text-white"
            rows={6}
            placeholder="One URI per line (ipfs:// or https://)"
            defaultValue={(formData.itemUris || []).join('\n')}
            onChange={(e) => {
              const list = e.target.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
              onUpdate({ itemUris: list })
            }}
          />
        ) : null}
        {inputMode === 'uris' && (
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-gray-400">Base URI (optional)</label>
              <input className="w-full rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1 text-white" placeholder="https://.../" value={baseUri} onChange={(e) => setBaseUri(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">Start index</label>
              <input type="number" className="w-full rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1 text-white" value={startIndex} onChange={(e) => setStartIndex(parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">Count</label>
              <input type="number" className="w-full rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1 text-white" value={count} onChange={(e) => setCount(parseInt(e.target.value) || 0)} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-gray-400">Filename pattern</label>
              <input className="w-full rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1 text-white" value={pattern} onChange={(e) => setPattern(e.target.value)} />
              <p className="mt-1 text-[11px] text-gray-400">Use {'{index}'} placeholder, e.g., {'{index}'}.json</p>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-gray-400">Manifest URL (optional)</label>
              <input className="w-full rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1 text-white" placeholder="https://.../manifest.json" value={manifestUrl} onChange={(e) => setManifestUrl(e.target.value)} />
            </div>
            <div className="md:col-span-4 mt-2 rounded border border-white/10 bg-white/5 p-3">
              <div className="mb-2 text-xs text-gray-300">Inject collection address into metadata (server will re-upload updated JSONs).</div>
              <div className="grid gap-2 md:grid-cols-6 items-center">
                <div className="md:col-span-4">
                  <label className="mb-1 block text-xs text-gray-400">Collection Address</label>
                  <input
                    className="w-full rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1 text-white"
                    placeholder="Enter collection address"
                    value={collectionAddress}
                    onChange={(e) => setCollectionAddress(e.target.value.trim())}
                  />
                </div>
                <div className="md:col-span-2 flex items-end">
                  <Button onClick={handleInjectCollectionKey} disabled={injecting}>
                    {injecting ? 'Updating…' : 'Inject Collection Key'}
                  </Button>
                </div>
              </div>
              <p className="mt-1 text-[11px] text-gray-400">Uses your pasted URIs or the base pattern above. Existing correct keys are skipped.</p>
            </div>
          </div>
        )}
      </div>

      {/* Dropzone */}
      {inputMode === 'upload' && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-primary-500 bg-white/5'
              : 'border-[hsl(var(--border))] hover:border-primary-400 bg-[hsl(var(--card))]'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          {isDragActive ? (
            <p className="font-medium text-primary-300">Drop the files here...</p>
          ) : (
            <div>
              <p className="mb-2 text-gray-300">
                Drag & drop your NFT images here, or click to select files
              </p>
              <p className="text-sm text-gray-400">
                Supports: JPG, PNG, GIF, WebP (Max 10MB each)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Uploaded Assets */}
      {assets.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold text-white">
            Uploaded Assets ({assets.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="group relative overflow-hidden rounded-lg border border-[hsl(var(--border))]"
              >
                <img
                  src={asset.preview}
                  alt={asset.name}
                  className="h-32 w-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 transition-opacity group-hover:bg-opacity-50">
                  <button
                    onClick={() => removeAsset(asset.id)}
                    className="opacity-0 group-hover:opacity-100 bg-red-500 text-white p-1 rounded-full transition-opacity"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-2">
                  <p className="truncate text-sm font-medium text-white">
                    {asset.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {(asset.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-6">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={
            inputMode === 'upload'
              ? assets.length === 0
              : !(
                  (formData.itemUris && formData.itemUris.length > 0) ||
                  (manifestUrl.trim().length > 0) ||
                  (baseUri.trim().length > 0 && count > 0)
                )
          }
        >
          Next
        </Button>
      </div>
    </div>
  )
}


