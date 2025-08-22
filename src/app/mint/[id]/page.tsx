'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useWallet } from '@solana/wallet-adapter-react'
import { Button } from '@/components/ui/Button'
import { WalletMultiButton } from '@/components/wallet/WalletMultiButton'
import { 
  Sparkles, 
  Users, 
  DollarSign, 
  Clock,
  CheckCircle,
  AlertCircle,
  Unlock,
  Globe,
  Twitter,
  Link as LinkIcon,
  Share2
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Collection } from '@/types'
import { useMint } from '@/hooks/useMint'
import { Metaplex, walletAdapterIdentity } from '@metaplex-foundation/js'
import { getConnection } from '@/lib/solana/umi'
import { PublicKey } from '@solana/web3.js'
import Image from 'next/image'
import Countdown from '@/components/ui/Countdown'

const normalizeUri = (u?: string | null): string | null => {
  if (!u || typeof u !== 'string') return null
  const s = u.trim()
  if (s.startsWith('ar://')) return `https://arweave.net/${s.slice('ar://'.length)}`
  if (s.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${s.slice('ipfs://'.length)}`
  if (/^https?:\/\//i.test(s)) return s
  return null
}

// Helper function to get collection from localStorage
const getCollectionFromStorage = (collectionId: string): Collection | null => {
  if (typeof window === 'undefined') return null
  
  try {
    const deployedCollections = JSON.parse(localStorage.getItem('deployed-collections') || '[]')
    console.log('All deployed collections in localStorage:', deployedCollections)
    
    // Clean up any collections with invalid addresses
    const cleanedCollections = deployedCollections.map((col: any) => {
      if (col.candyMachineAddress && !col.candyMachineAddress.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)) {
        console.log('Fixing invalid candy machine address for collection:', col.id)
        return {
          ...col,
          candyMachineAddress: '1111111111111111111111111111111111111111111111111111111111111111',
          creatorAddress: '1111111111111111111111111111111111111111111111111111111111111111'
        }
      }
      return col
    })
    
    // Update localStorage with cleaned collections
    if (JSON.stringify(deployedCollections) !== JSON.stringify(cleanedCollections)) {
      localStorage.setItem('deployed-collections', JSON.stringify(cleanedCollections))
    }
    
    const collection = cleanedCollections.find((col: any) => col.id === collectionId)
    return collection || null
  } catch (error) {
    console.error('Error reading from localStorage:', error)
    return null
  }
}

// Mock collection data as fallback - in a real app, this would come from your backend
const mockCollections: Record<string, Collection> = {
  '1': {
    id: '1',
    name: 'Cool Apes',
    symbol: 'CAPE',
    description: 'A collection of cool apes with unique traits and backgrounds. Each ape is algorithmically generated and stored on the Solana blockchain.',
    image: 'https://via.placeholder.com/600x600',
    price: 1.5,
    itemsAvailable: 1000,
    itemsMinted: 750,
    candyMachineAddress: '1111111111111111111111111111111111111111111111111111111111111111',
    mintPageUrl: '/mint/1',
    status: 'minting',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-20'),
    creatorAddress: '1111111111111111111111111111111111111111111111111111111111111111',
    network: 'mainnet-beta',
  },
  'freemint': {
    id: 'freemint',
    name: 'Free Genesis Collection',
    symbol: 'FREE',
    description: 'A completely free NFT collection for early supporters. No cost, just gas fees! Limited to 500 pieces.',
    image: 'https://via.placeholder.com/600x600/00FF00/FFFFFF?text=FREE+MINT',
    price: 0, // FREE MINT!
    itemsAvailable: 500,
    itemsMinted: 127,
    candyMachineAddress: '1111111111111111111111111111111111111111111111111111111111111111',
    mintPageUrl: '/mint/freemint',
    status: 'minting',
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-01-22'),
    creatorAddress: '1111111111111111111111111111111111111111111111111111111111111111',
    network: 'mainnet-beta',
  },
}

export default function MintPage() {
  const params = useParams()
  const { connected, publicKey } = useWallet()
  const [collection, setCollection] = useState<Collection | null>(null)
  const [mintCount, setMintCount] = useState(1)
  const [sneakPeek, setSneakPeek] = useState<string[]>([])
  const [links, setLinks] = useState<{ website?: string; twitter?: string; discord?: string }>({})
  const [usdEstimate, setUsdEstimate] = useState<number | null>(null)
  const [lastSignature, setLastSignature] = useState<string | undefined>()
  const [phaseCounts, setPhaseCounts] = useState<Record<string, number>>({})

  // Phase selector state must be declared unconditionally (before any early returns)
  const [selectedPhaseIdx, setSelectedPhaseIdx] = useState<number | null>(null)
  useEffect(() => {
    const basePhases: any[] = ((collection as any)?.phases) || []
    // Inject implicit Public phase from collection's base fields if not present
    const hasExplicitPublic = basePhases.some((p: any) => !Array.isArray(p?.allowlist) || p.allowlist.length === 0)
    const ph: any[] = hasExplicitPublic
      ? basePhases
      : [
          ...basePhases,
          {
            name: 'Public',
            price: (collection as any)?.price || 0,
            startDate: (collection as any)?.startDate || null,
            endDate: (collection as any)?.endDate || null,
            allowlist: [],
          },
        ]
    try {
      const now = Date.now()
      const liveIdxs = ph
        .map((p: any, i: number) => ({ p, i }))
        .filter(({ p }: { p: any }) => {
          const s = p.startDate ? new Date(p.startDate).getTime() : ((collection as any)?.startDate ? new Date((collection as any).startDate as any).getTime() : -Infinity)
          const e = p.endDate ? new Date(p.endDate).getTime() : ((collection as any)?.endDate ? new Date((collection as any).endDate as any).getTime() : Infinity)
          return now >= s && now <= e
        })
      if (liveIdxs.length === 0) { setSelectedPhaseIdx(null); return }
      const walletPk = publicKey?.toString() || ''
      const wl = liveIdxs.find(({ p }: { p: any }) => Array.isArray(p.allowlist) && p.allowlist.includes(walletPk))
      if (wl) { setSelectedPhaseIdx(wl.i); return }
      const pub = liveIdxs.find(({ p }: { p: any }) => !Array.isArray(p.allowlist) || p.allowlist.length === 0)
      if (pub) { setSelectedPhaseIdx(pub.i); return }
      setSelectedPhaseIdx(liveIdxs[0].i)
    } catch { setSelectedPhaseIdx(null) }
  }, [collection, publicKey])

  useEffect(() => {
    const load = async () => {
      const id = Array.isArray(params.id) ? params.id[0] : params.id
      try {
        const res = await fetch(`/api/collections?address=${id}`)
        const data = await res.json()
        if (data) {
          setCollection({
            id: data.collection_address || id,
            name: data.name,
            symbol: data.symbol,
            description: data.description || '',
            image: normalizeUri(data.image_url) || 'https://via.placeholder.com/600x600',
            price: Number(data.price || 0),
            itemsAvailable: Number(data.items_available || 0),
            itemsMinted: Number(data.items_minted || 0),
            candyMachineAddress: data.candy_machine_address || '',
            mintPageUrl: data.mint_page_url || `/mint/${id}`,
            status: (data.status || 'minting') as any,
            createdAt: new Date(data.created_at || Date.now()),
            updatedAt: new Date(data.updated_at || Date.now()),
            creatorAddress: data.creator_address || '',
            network: (data.network || 'mainnet-beta') as any,
            standard: (data.standard || 'legacy') as any,
            itemUris: data.item_uris || [],
            merkleTreeAddress: (data as any)?.merkle_tree_address || undefined,
            phases: data.phases || [],
            startDate: data.start_date || null,
            endDate: data.end_date || null,
          })
          // Socials (if present in DB)
          setLinks({ website: data.website || data.site || undefined, twitter: data.twitter || undefined, discord: data.discord || undefined })
          // Sneak peek: fetch first few metadata images if item_uris provided
          const urisRaw: string[] = Array.isArray(data.item_uris) ? data.item_uris.slice(0, 6) : []
          const uris: string[] = urisRaw.map((u: string) => normalizeUri(u)).filter(Boolean) as string[]
          if (uris.length > 0) {
            try {
              const imgs = await Promise.all(
                uris.map(async (u: string) => {
                  try {
                    const r = await fetch(u)
                    const j = await r.json()
                    const img = normalizeUri(j?.image)
                    return img || ''
                  } catch {
                    return ''
                  }
                })
              )
              const pics = imgs.filter(Boolean)
              setSneakPeek(pics)
              // If header image missing, derive from first metadata image
              if ((!data.image_url || !normalizeUri(data.image_url)) && pics.length > 0) {
                setCollection((prev) => (prev ? { ...prev, image: pics[0] } : prev))
              }
            } catch {}
          }
          return
        }
      } catch (e) {
        console.warn('API load failed, falling back to localStorage/mock', e)
      }
      // Fallbacks
      const ls = getCollectionFromStorage(id)
      if (ls) setCollection(ls)
      else setCollection(mockCollections[id] || mockCollections['1'])
    }
    load()
    // Load per-phase mint counts
    ;(async () => {
      try {
        const id = Array.isArray(params.id) ? params.id[0] : params.id
        const r = await fetch(`/api/stats/${id}`, { cache: 'no-store' })
        const j = await r.json()
        if (r.ok && Array.isArray(j?.phaseMinted)) {
          const map: Record<string, number> = {}
          j.phaseMinted.forEach((row: any) => {
            if (row?.phase) map[String(row.phase)] = Number(row.mints || 0)
          })
          setPhaseCounts(map)
        }
      } catch {}
    })()
  }, [params.id])

  // Fetch SOL price for USD estimate
  useEffect(() => {
    const loadUsd = async () => {
      try {
        const res = await fetch('/api/stats')
        // not needed; use mintService fallback oracle directly instead
      } catch {}
      try {
        const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', { cache: 'no-store' })
        const j = await r.json()
        const p = j?.solana?.usd
        if (typeof p === 'number' && isFinite(p)) setUsdEstimate(p)
      } catch {}
    }
    loadUsd()
  }, [])

  const { mintNFT, calculateMintCost, minting: hookMinting } = useMint()
  const [thawing, setThawing] = useState(false)

  // Compute remaining early so hooks below can depend on it without conditional rendering
  const remaining = collection ? (collection.itemsAvailable - collection.itemsMinted) : 0

  // Clamp mintCount based on remaining supply when selection changes
  useEffect(() => {
    setMintCount((prev) => Math.max(1, Math.min(prev, isFinite(remaining) ? remaining : prev)))
  }, [selectedPhaseIdx, remaining])

  const handleMint = async () => {
    if (!connected || !publicKey) {
      toast.error('Please connect your wallet to mint')
      return
    }

    if (!collection) {
      toast.error('Collection not loaded yet')
      return
    }

    // For legacy (CMv3) mints we need a candy machine address.
    // Core and cNFT mints do not require a candy machine.
    const requiresCandyMachine = (collection.standard ?? 'legacy') === 'legacy'
    if (requiresCandyMachine && !collection.candyMachineAddress) {
      toast.error('Invalid collection data')
      return
    }

    try {
      // Require a live phase when phases are configured
      if (Array.isArray(phases) && phases.length > 0 && !selectedPhase) {
        toast.error('No live phase currently')
        return
      }
      // Enforce allowlist eligibility when selectedPhase has an allowlist
      if (!eligibleForSelected) {
        toast.error('Wallet not eligible for the selected phase')
        return
      }
      // Double-check server-side eligibility and remaining per-phase allowance
      try {
        const checkRes = await fetch('/api/mint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'check',
            wallet: publicKey.toString(),
            collectionAddress: collection.id || collection.candyMachineAddress || collection.mintPageUrl || '',
            quantity: mintCount,
            phase: selectedPhase ? { name: selectedPhase.name } : null,
          })
        })
        const checkJson = await checkRes.json()
        if (!checkRes.ok || checkJson?.ok === false) {
          if (checkJson?.reason === 'no_live_phase') throw new Error('No live phase currently')
          if (checkJson?.reason === 'allowlist') throw new Error('Wallet not eligible for this phase')
          if (checkJson?.reason === 'limit') throw new Error(`Mint limit reached for this phase. Already: ${checkJson?.already || 0}`)
          throw new Error('Eligibility check failed')
        }
        if (typeof checkJson?.allowed === 'number' && isFinite(checkJson.allowed) && checkJson.allowed < mintCount) {
          throw new Error(`You can mint up to ${checkJson.allowed} more in this phase`)
        }
      } catch (e: any) {
        throw e
      }

      // Calculate cost breakdown
      const priceForCost = selectedPhase ? Number(selectedPhase.price || 0) : collection.price
      const costBreakdown = await calculateMintCost(priceForCost, mintCount, collection.network)
      
      // Show cost breakdown to user
      const totalCostSOL = costBreakdown.total.toFixed(4)
      const platformFeeSOL = costBreakdown.platformFee.toFixed(4)
      const mintCostSOL = costBreakdown.mintCost.toFixed(4)
      
      // Show detailed cost breakdown
      toast.success(
        <div className="text-left">
          <div className="font-semibold mb-2">Mint Cost Breakdown:</div>
          <div className="text-sm space-y-1">
             <div>Mint Price: {priceForCost === 0 ? 'FREE' : `${mintCostSOL} SOL`}{selectedPhase ? ` (Phase: ${selectedPhase.name || (Array.isArray(selectedPhase.allowlist) && selectedPhase.allowlist.length > 0 ? 'WL' : 'Public')})` : ''}</div>
            <div>Platform Fee: $1.00 USD ({platformFeeSOL} SOL)</div>
            <div className="border-t pt-1 font-medium">
              Total: {totalCostSOL} SOL
            </div>
          </div>
          <div className="text-xs mt-2 opacity-75">
            + network transaction fees (~0.001 SOL)
          </div>
        </div>,
        { duration: 8000, id: 'cost-breakdown' }
      )

      // Execute the actual mint transaction
      // For Core/cNFT mints, pick the next metadata URI to ensure uniqueness
      const nextIndex = Math.max(0, Number(collection.itemsMinted || 0))
      const metadataUri: string | undefined = (Array.isArray(collection.itemUris) && collection.itemUris[nextIndex]) || undefined
      const mintResult = await mintNFT({
        collectionId: collection.id,
        candyMachineAddress: collection.candyMachineAddress || '',
        mintPrice: priceForCost,
        creatorAddress: collection.creatorAddress,
        quantity: mintCount,
        network: collection.network,
        standard: collection.standard || 'legacy',
        metadataUri,
        itemUris: Array.isArray(collection.itemUris) ? collection.itemUris : [],
        merkleTreeAddress: (collection as any)?.merkleTreeAddress,
        name: collection.name,
        selectedPhaseName: selectedPhase?.name,
        phases: Array.isArray(phases) ? phases : [],
      })

      if (mintResult.success) {
        // Update collection state to reflect new mint count
        if (collection) {
          setCollection(prev => prev ? {
            ...prev,
            itemsMinted: prev.itemsMinted + mintCount
          } : prev)
        }

        // Show success message
        toast.success(
          <div>
            <div className="font-semibold">Mint Successful! 🎉</div>
            <div className="text-sm">
              {mintCount} NFT{mintCount > 1 ? 's' : ''} minted successfully
            </div>
            <div className="text-xs mt-1">
              NFT Address: {mintResult.nftAddress?.substring(0, 8)}...
            </div>
            <div className="text-xs">
              Transaction: {mintResult.transactionSignature?.substring(0, 8)}...
            </div>
          </div>,
          { duration: 8000 }
        )

        setLastSignature(mintResult.transactionSignature)

        // Lightweight confetti
        try {
          const colors = ['#60a5fa', '#34d399', '#f472b6', '#f59e0b', '#a78bfa']
          const count = Math.min(80, 20 + mintCount * 20)
          for (let i = 0; i < count; i++) {
            const piece = document.createElement('div')
            piece.className = 'confetti-piece'
            piece.style.left = Math.random() * 100 + 'vw'
            piece.style.background = colors[i % colors.length]
            piece.style.animationDuration = 2 + Math.random() * 2 + 's'
            piece.style.animationDelay = Math.random() * 0.2 + 's'
            document.body.appendChild(piece)
            setTimeout(() => piece.remove(), 4000)
          }
        } catch {}
      } else {
        throw new Error(mintResult.error || 'Mint failed')
      }
    } catch (error) {
      console.error('Mint error:', error)
      toast.error(`Mint failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { duration: 5000 })
    }
  }

  const handleThaw = async () => {
    try {
      if (!collection || !collection.candyMachineAddress) return
      setThawing(true)
      const nftMint = prompt('Enter NFT mint address to thaw:')
      if (!nftMint) return
      const connection = getConnection(collection.network as any)
      // Note: for demo, rely on wallet adapter from window if available; in real app, pass wallet adapter context
      const walletProvider: any = (window as any)?.solana || null
      if (!walletProvider?.publicKey) {
        toast.error('Connect your wallet to thaw')
        return
      }
      const metaplex = Metaplex.make(connection).use(walletAdapterIdentity(walletProvider))
      const cm = await metaplex.candyMachines().findByAddress({ address: new PublicKey(collection.candyMachineAddress) })
      await metaplex.candyMachines().callGuardRoute({
        candyMachine: cm as any,
        guard: 'freezeSolPayment' as any,
        settings: { path: 'thaw', nftMint: new PublicKey(nftMint), nftOwner: new PublicKey(walletProvider.publicKey.toString()) } as any,
      } as any)
      toast.success('Thaw instruction sent')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to thaw NFT')
    } finally {
      setThawing(false)
    }
  }

  if (!collection) {
    return (
      <div className="min-h-screen bg-dots flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading collection...</p>
        </div>
      </div>
    )
  }

  const mintProgress = (collection.itemsMinted / collection.itemsAvailable) * 100
  // Build phases for display, injecting implicit Public if not defined
  const basePhases: any[] = (collection as any).phases || []
  const hasExplicitPublic = basePhases.some((p: any) => !Array.isArray(p?.allowlist) || p.allowlist.length === 0)
  const phases: any[] = hasExplicitPublic
    ? basePhases
    : [
        ...basePhases,
        {
          name: 'Public',
          price: collection.price,
          startDate: (collection as any)?.startDate || null,
          endDate: (collection as any)?.endDate || null,
          allowlist: [],
        },
      ]
  const activePhase = phases.find((p: any) => {
    const now = Date.now()
    const start = p.startDate ? new Date(p.startDate).getTime() : -Infinity
    const end = p.endDate ? new Date(p.endDate).getTime() : Infinity
    return now >= start && now <= end
  })
  // Eligibility is computed inline where needed using `connected` and `publicKey`


  const selectedPhase: any | null = (selectedPhaseIdx !== null && phases[selectedPhaseIdx]) ? phases[selectedPhaseIdx] : null
  const effectivePrice = selectedPhase ? Number(selectedPhase.price || 0) : collection.price
  const eligibleForSelected = (() => {
    // If no phases configured, allow
    if (!Array.isArray(phases) || phases.length === 0) return true
    // If phases exist but none selected (no live), disallow
    if (!selectedPhase) return false
    if (!Array.isArray(selectedPhase.allowlist) || selectedPhase.allowlist.length === 0) return true
    const walletStr = typeof publicKey === 'string' ? publicKey : (publicKey as any) || ''
    const normalized = (selectedPhase.allowlist || []).map((a: string) => a.trim())
    return walletStr ? normalized.includes(walletStr.toString()) : false
  })()

  // Determine UI selection cap based on phase maxPerWallet (if provided)
  const phaseMaxPerWallet = (selectedPhase && typeof selectedPhase.maxPerWallet === 'number' && selectedPhase.maxPerWallet > 0)
    ? Number(selectedPhase.maxPerWallet)
    : Infinity
  const maxSelectable = Math.min(remaining, phaseMaxPerWallet)

  // (clamp already handled above with remaining)

  return (
    <div className="min-h-screen bg-dots">
      {/* Header (mobile-first) */}
      <header className="sticky top-0 z-30 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/80 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--card))]/60">
        <div className="container mx-auto flex items-center justify-between px-3 py-3 md:px-4 md:py-4">
          <div className="flex min-w-0 items-center gap-2">
            <Image src="/logo.png" alt="Droply" width={24} height={24} className="h-6 w-6 rounded" />
            <span className="truncate text-base font-semibold text-white md:text-xl">Droply</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Compact phase status */}
            {activePhase && (
              <div className="hidden items-center gap-2 rounded-full bg-white/5 px-2 py-1 text-xs text-gray-200 ring-1 ring-inset ring-white/10 sm:flex">
                <span className={`h-2 w-2 rounded-full ${Date.now() <= new Date(activePhase.endDate || Date.now()+1).getTime() ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                <span className="uppercase tracking-wide">{activePhase.name || (Array.isArray(activePhase.allowlist) && activePhase.allowlist.length>0 ? 'WL' : 'Public')}</span>
                <Countdown start={activePhase.startDate} end={activePhase.endDate} />
              </div>
            )}
            <WalletMultiButton />
          </div>
        </div>
        {/* Mobile secondary bar: concise countdown only to avoid CTA/price duplication */}
        <div className="border-t border-white/10 sm:hidden">
          <div className="container mx-auto flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span className="text-gray-300">Ends in</span>
            <span className="text-white"><Countdown start={activePhase?.startDate} end={activePhase?.endDate} /></span>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-10">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-2">
          {/* Left: Artwork + Sneak peek */}
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={collection.image} alt={collection.name} className="w-full object-cover" />
            </div>

            {(sneakPeek.length > 0 || (collection as any)?.sneakPeekImages?.length > 0 || collection.image) && (
              <div>
                <div className="mb-2 text-sm font-medium text-white/80">Sneak peeks</div>
                {/* Desktop grid */}
                <div className="hidden grid-cols-5 gap-3 sm:grid">
                  {(sneakPeek.length > 0 ? sneakPeek : ((collection as any)?.sneakPeekImages || [collection.image])).slice(0, 5).map((src: string, idx: number) => (
                    <div key={idx} className="overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`preview-${idx}`} className="aspect-square w-full object-cover" />
                    </div>
                  ))}
                </div>
                {/* Mobile carousel */}
                <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 sm:hidden">
                  {(sneakPeek.length > 0 ? sneakPeek : ((collection as any)?.sneakPeekImages || [collection.image])).slice(0, 10).map((src: string, idx: number) => (
                    <div key={idx} className="snap-start shrink-0 overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`preview-${idx}`} className="h-28 w-28 object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
              </div>

          {/* Right: Details card */}
          <div>
            <div className="card-hover space-y-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/95 p-5 backdrop-blur">
              <div className="flex items-start justify-between">
              <div>
                  <div className="mb-1 text-xs uppercase tracking-wide text-gray-400">Limited Edition</div>
                  <h2 className="text-2xl font-bold text-white">{collection.name}</h2>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-gray-200 ring-1 ring-inset ring-white/10">{collection.symbol}</span>
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs text-emerald-300 ring-1 ring-inset ring-emerald-500/30">{collection.status}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {links.website && (
                    <a href={links.website} target="_blank" rel="noreferrer" title="Visit website" aria-label="Visit website" className="rounded-lg border border-white/10 p-2 text-gray-300 hover:text-white">
                      <Globe className="h-4 w-4" />
                    </a>
                  )}
                  {links.twitter && (
                    <a href={links.twitter} target="_blank" rel="noreferrer" title="View on X" aria-label="View on X" className="rounded-lg border border-white/10 p-2 text-gray-300 hover:text-white">
                      <Twitter className="h-4 w-4" />
                    </a>
                  )}
                  {collection.mintPageUrl && (
                    <a href={collection.mintPageUrl} target="_blank" rel="noreferrer" title="Open mint page" aria-label="Open mint page" className="rounded-lg border border-white/10 p-2 text-gray-300 hover:text-white">
                      <LinkIcon className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>

              {/* Stages */}
              <div className="rounded-xl border border-white/10 bg-black/10">
                <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-white">Mint Stages</div>
                <div className="divide-y divide-white/10">
                  {Array.isArray(phases) && phases.length > 0 ? phases.map((p: any, i: number) => {
                    const now = Date.now()
                    const start = p.startDate ? new Date(p.startDate).getTime() : -Infinity
                    const end = p.endDate ? new Date(p.endDate).getTime() : Infinity
                    const ended = now > end
                    const live = now >= start && now <= end
                    const isWL = Array.isArray(p.allowlist) && p.allowlist.length > 0
                    const label = p.name || (isWL ? 'WL' : 'Public')
                    const mintedInPhase = phaseCounts[label] || 0
                    const cap = Number(p.maxSupply || 0) > 0 ? Number(p.maxSupply) : undefined
                    return (
                      <div key={i} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`h-2.5 w-2.5 rounded-full ${live ? 'bg-emerald-400' : ended ? 'bg-gray-500' : 'bg-amber-400'}`}></div>
                          <div>
                            <div className="text-sm font-medium text-white">{label}</div>
                            <div className="text-xs text-gray-400">Price {p.price ? `${p.price} SOL` : 'FREE'}{(typeof p.maxPerWallet === 'number' && p.maxPerWallet > 0) ? ` • Max ${p.maxPerWallet}/wallet` : ''}</div>
                          </div>
                        </div>
                        <div className="text-right text-xs text-gray-400">
                          <div className="mb-0.5">{cap ? `${mintedInPhase} / ${cap} minted` : `${mintedInPhase} minted`}</div>
                        <div className="flex items-center justify-end gap-2">
                          <span>{ended ? 'Ended' : live ? 'Live' : 'Starts in'}</span>
                          {/* Eligibility pill when wallet is connected */}
                          {connected && isWL && (
                            p.allowlist.includes(publicKey?.toString() || '') ? (
                              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30">Eligible</span>
                            ) : (
                              live && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-300 ring-1 ring-inset ring-red-500/30">Not eligible</span>
                            )
                          )}
                        </div>
                          <Countdown start={p.startDate} end={p.endDate || undefined} className="mt-1" />
                      </div>
                      </div>
                    )
                  }) : (
                    <div className="px-4 py-3 text-sm text-gray-400">No stage data provided</div>
                  )}
                </div>
              </div>

              {/* Progress */}
              <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                <div className="mb-2 flex items-center justify-between text-sm text-gray-300">
                  <span className="inline-flex items-center gap-2 text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400"></span> Live</span>
                  <div className="text-right">
                    <span className="text-white">{mintProgress.toFixed(1)}%</span>
                    <span className="ml-2 text-gray-400">{collection.itemsMinted} / {collection.itemsAvailable}</span>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="glow-primary h-full rounded-full bg-gradient-to-r from-primary-500 to-secondary-500" style={{ width: `${mintProgress}%` }} />
                </div>
              </div>

              {/* Phase selector or WL priority notice */}
              {Array.isArray(phases) && phases.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                  <div className="mb-2 text-sm font-medium text-white/80">Phase</div>
                  {(() => {
                    const now = Date.now()
                    const livePhases = phases.filter((p: any) => {
                      const s = p.startDate ? new Date(p.startDate).getTime() : -Infinity
                      const e = p.endDate ? new Date(p.endDate).getTime() : Infinity
                      return now >= s && now <= e
                    })
                    const userIn = (p: any) => Array.isArray(p.allowlist) && p.allowlist.includes(publicKey?.toString() || '')
                    const wl = livePhases.find((p: any) => userIn(p))
                    const pub = livePhases.find((p: any) => !Array.isArray(p.allowlist) || p.allowlist.length === 0)
                    return (
                      <div className="flex flex-col gap-2">
                        {livePhases.length === 0 && (
                          <div className="text-sm text-gray-300">No live phase currently.</div>
                        )}
                        {livePhases.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {livePhases.map((p: any, idx: number) => {
                              const i = phases.indexOf(p)
                              const isSelected = selectedPhaseIdx === i
                              const label = p.name || (Array.isArray(p.allowlist) && p.allowlist.length > 0 ? 'WL' : 'Public')
                              const eligible = Array.isArray(p.allowlist) ? p.allowlist.includes(publicKey?.toString() || '') : true
                              return (
                                <button
                                  key={idx}
                                  onClick={() => setSelectedPhaseIdx(i)}
                                  className={`rounded-full px-3 py-1 text-xs ring-1 ring-inset transition ${isSelected ? 'bg-primary-600 text-white ring-primary-500' : 'bg-white/5 text-gray-200 ring-white/10 hover:bg-white/10'}`}
                                  title={eligible ? 'Eligible' : 'Not eligible'}
                                >
                                  {label}{Array.isArray(p.allowlist) && p.allowlist.length > 0 ? (eligible ? '' : ' (Not eligible)') : ''}
                                </button>
                              )
                            })}
                          </div>
                        )}
                        {wl && (
                          <div className="text-xs text-gray-400">WL is prioritized over Public while both are live.</div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Price + controls */}
              <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                <div className="mb-3 text-sm text-gray-400">Price</div>
                <div className="mb-2 flex items-end justify-between">
                  <div>
                    <div className="text-3xl font-extrabold tracking-tight text-white">{effectivePrice === 0 ? 'FREE' : `${effectivePrice} SOL`}</div>
                    {usdEstimate && effectivePrice > 0 && (
                      <div className="text-xs text-gray-400">≈ ${(usdEstimate * effectivePrice).toFixed(2)} USD</div>
                    )}
                  </div>
                  <div className="inline-flex items-center gap-2" id="mint-controls">
                    <Button variant="outline" size="sm" onClick={() => setMintCount(Math.max(1, mintCount - 1))} disabled={mintCount <= 1} aria-label="Decrease quantity">-</Button>
                    <span className="min-w-[56px] rounded-md bg-white/5 px-3 py-2 text-center text-white">{mintCount}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMintCount(Math.min(isFinite(maxSelectable) ? maxSelectable : remaining, mintCount + 1))}
                      disabled={mintCount >= (isFinite(maxSelectable) ? maxSelectable : remaining)}
                      aria-label="Increase quantity"
                    >
                      +
                    </Button>
                    </div>
                  </div>

                {connected ? (
                  <Button onClick={handleMint} disabled={hookMinting || remaining === 0 || (Array.isArray(phases) && phases.length > 0 && (!selectedPhase || !eligibleForSelected))} className="w-full" size="lg">
                    {hookMinting ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                        Minting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" /> {(Array.isArray(phases) && phases.length > 0 && !selectedPhase) ? 'No live phase' : (eligibleForSelected ? `Mint ${mintCount} NFT${mintCount > 1 ? 's' : ''}` : 'Not eligible')}
                      </>
                    )}
                  </Button>
              ) : (
                <div className="text-center">
                  <WalletMultiButton />
                </div>
              )}

                <div className="mt-3 text-center text-xs text-gray-400">Collection is locked from trading until all items have been minted.</div>
              </div>

              {/* Info */}
              <div className="rounded-xl border border-white/10 bg-black/10 p-4 text-sm text-gray-300">
                <div className="grid grid-cols-2 gap-3">
                   <div>Network: <span className="text-white">{String(collection.network).includes('mainnet') ? 'SOLANA' : 'DEVNET'}</span></div>
                  <div>Remaining: <span className="text-white">{remaining}</span></div>
                  <div>Creator: <span className="text-white">{collection.creatorAddress?.slice(0, 4)}…{collection.creatorAddress?.slice(-4)}</span></div>
                  <div className="col-span-2">
                    <div className="flex items-center justify-between">
                      <span>Collection Address: <span className="text-white">{collection.id?.slice(0, 4)}…{collection.id?.slice(-4)}</span></span>
                      <button
                        className="rounded-md border border-white/10 px-2 py-1 text-xs text-gray-300 hover:text-white"
                        title="Copy collection address"
                        aria-label="Copy collection address"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(collection.id!)
                            toast.success('Collection address copied')
                          } catch {}
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  {collection.candyMachineAddress && (
                    <div className="flex items-center justify-between">
                      <span>CM Address: <span className="text-white">{collection.candyMachineAddress.slice(0, 4)}…{collection.candyMachineAddress.slice(-4)}</span></span>
                      <button
                        className="rounded-md border border-white/10 px-2 py-1 text-xs text-gray-300 hover:text-white"
                        title="Copy candy machine address"
                        aria-label="Copy candy machine address"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(collection.candyMachineAddress!)
                            toast.success('Candy Machine address copied')
                          } catch {}
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  )}
                </div>
                <div className="mt-3">
                  <Button variant="outline" size="sm" onClick={handleThaw} disabled={thawing || !collection?.candyMachineAddress} className="w-full">
                    <Unlock className="mr-2 h-4 w-4" /> Thaw NFT
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating total bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-4xl px-4 pb-6 md:pb-8">
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/90 p-4 backdrop-blur">
          <div className="flex flex-col items-stretch gap-3 text-white sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <span>Total</span>
              <span className="hidden items-center gap-2 sm:flex">
                <Countdown start={activePhase?.startDate} end={activePhase?.endDate} />
              </span>
            </div>
            <div className="text-xl font-bold">
              {effectivePrice === 0 ? 'FREE' : `${(effectivePrice * mintCount).toFixed(3)} SOL`}
              {usdEstimate && effectivePrice > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-400">(≈ ${(usdEstimate * effectivePrice * mintCount).toFixed(2)} USD)</span>
              )}
            </div>
            {connected ? (
              <Button size="lg" onClick={handleMint} disabled={hookMinting || remaining === 0 || (Array.isArray(phases) && phases.length > 0 && (!selectedPhase || !eligibleForSelected))} className="w-full sm:w-auto">
                {hookMinting ? 'Minting…' : 'Mint Now'}
              </Button>
            ) : (
              <div className="w-full sm:w-auto"><WalletMultiButton /></div>
            )}
            {lastSignature && (
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  try {
                    const origin = typeof window !== 'undefined' ? window.location.origin : ''
                    const text = encodeURIComponent(`I just minted ${collection.name} on ${origin}! #Solana #NFT #Mint`)
                    const url = encodeURIComponent(window.location.href)
                    const sig = encodeURIComponent(lastSignature)
                    const tweet = `https://twitter.com/intent/tweet?text=${text}&url=${url}%3Fsig%3D${sig}`
                    window.open(tweet, '_blank', 'noopener,noreferrer')
                  } catch {}
                }}
              >
                <Share2 className="mr-2 h-4 w-4" /> Share on X
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile compact header with price and countdown */}
      <div className="fixed top-[56px] z-30 w-full border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/85 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2 text-sm text-white">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold">{effectivePrice === 0 ? 'FREE' : `${effectivePrice} SOL`}</span>
            {usdEstimate && effectivePrice > 0 && (
              <span className="text-xs text-gray-400">(≈ ${(usdEstimate * effectivePrice).toFixed(2)} USD)</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Countdown start={activePhase?.startDate} end={activePhase?.endDate} />
            <Button
              size="sm"
              onClick={() => {
                const el = document.getElementById('mint-controls')
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }}
            >
              Mint
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

