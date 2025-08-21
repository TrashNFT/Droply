'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { MintSettings } from '@/components/forms/MintSettings'
import { WalletMultiButton } from '@/components/wallet/WalletMultiButton'
import { 
  Plus, 
  BarChart3, 
  Users, 
  DollarSign, 
  TrendingUp,
  Eye,
  Edit,
  Trash2
} from 'lucide-react'
import type { Collection, MintStats } from '@/types'
import { WalletDebug } from '@/components/debug/WalletDebug'
import { getDeployedCollections, clearAllDeployedCollections } from '@/lib/utils/collectionStorage'
import useSWR from 'swr'

// Mock data - in a real app, this would come from your backend
const mockCollections: Collection[] = [
  {
    id: '1',
    name: 'Cool Apes',
    symbol: 'CAPE',
    description: 'A collection of cool apes',
    image: 'https://via.placeholder.com/300x300',
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
  {
    id: 'freemint',
    name: 'Free Genesis Collection',
    symbol: 'FREE',
    description: 'Completely free NFT collection for early supporters',
    image: 'https://via.placeholder.com/300x300/00FF00/FFFFFF?text=FREE',
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
  {
    id: '2',
    name: 'Pixel Warriors',
    symbol: 'PWAR',
    description: 'Epic pixel art warriors',
    image: 'https://via.placeholder.com/300x300',
    price: 2.0,
    itemsAvailable: 500,
    itemsMinted: 500,
    candyMachineAddress: '1111111111111111111111111111111111111111111111111111111111111111',
    mintPageUrl: '/mint/2',
    status: 'completed',
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-18'),
    creatorAddress: '1111111111111111111111111111111111111111111111111111111111111111',
    network: 'mainnet-beta',
  },
]

const mockStats: MintStats = {
  totalMinted: 1250,
  totalRevenue: 2250,
  uniqueMinters: 850,
  averageMintTime: 2.5,
  mintHistory: [
    { timestamp: new Date('2024-01-20'), mints: 50, revenue: 75 },
    { timestamp: new Date('2024-01-19'), mints: 75, revenue: 112.5 },
    { timestamp: new Date('2024-01-18'), mints: 100, revenue: 150 },
  ],
}

export default function DashboardPage() {
  const { connected, publicKey } = useWallet()
  const router = useRouter()
  const [collections, setCollections] = useState<Collection[]>([])
  const [stats, setStats] = useState<MintStats>(mockStats)
  const [mounted, setMounted] = useState(false)

  const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(r => r.json())
  const creatorKey = publicKey?.toString()
  const { data: serverCollections } = useSWR(
    () => creatorKey ? `/api/collections?creator=${creatorKey}` : null,
    fetcher,
    { refreshInterval: 5000, revalidateOnFocus: true }
  )
  const { data: serverStats, mutate: reloadStats } = useSWR(
    () => creatorKey ? `/api/stats?creator=${creatorKey}` : null,
    fetcher,
    { refreshInterval: 5000, revalidateOnFocus: true }
  )
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [chartData, setChartData] = useState<any[]>([])
  const [editing, setEditing] = useState<null | any>(null)
  const [mobileActionsFor, setMobileActionsFor] = useState<string | null>(null)

  const handleClearLocalCollections = () => {
    try {
      clearAllDeployedCollections()
    } catch (error) {
      console.error('Error clearing local collections:', error)
    }
  }

  useEffect(() => {
    setMounted(true)
    
    // Load collections for this creator from server + localStorage
    const loadCollections = () => {
      try {
        const deployedCollections = getDeployedCollections()
        const apiRows = Array.isArray(serverCollections) ? serverCollections : []

        // Normalize server rows to Collection shape
        const apiCollections = apiRows.map((row: any) => ({
          id: row.collection_address || row.id,
          name: row.name,
          symbol: row.symbol,
          description: row.description || '',
          image: row.image_url || '',
          price: Number(row.price || 0),
          itemsAvailable: Number(row.items_available || 0),
          itemsMinted: Number(row.items_minted || 0),
          candyMachineAddress: row.candy_machine_address || undefined,
          mintPageUrl: row.mint_page_url || (row.collection_address ? `/mint/${row.collection_address}` : undefined),
          status: (row.status || 'deployed') as any,
          createdAt: new Date(row.created_at || Date.now()),
          updatedAt: new Date(row.updated_at || Date.now()),
          creatorAddress: row.creator_address || '',
          network: (row.network || 'mainnet-beta') as any,
          standard: (row.standard || 'core') as any,
          itemUris: Array.isArray(row.item_uris) ? row.item_uris : [],
          phases: Array.isArray(row.phases) ? row.phases : [],
          startDate: row.start_date || null,
          endDate: row.end_date || null,
        }))

        const walletAddress = publicKey?.toString()
        const localFiltered = walletAddress
          ? deployedCollections.filter((c: any) => String(c.creatorAddress) === walletAddress)
          : []

        // Merge keeping server list authoritative, then local-only items for this creator
        const seen = new Set((apiCollections as any[]).map((c: any) => c.id || (c as any).collectionAddress))
        const localOnly = localFiltered.filter((c: any) => !seen.has(c.id))
        const allCollections = [...apiCollections, ...localOnly]
        setCollections(allCollections)
      } catch (error) {
        console.error('Error loading collections:', error)
        setCollections([])
      }
    }
    
    loadCollections()
    
    // Listen for new deployments
    const handleStorageChange = () => {
      loadCollections()
    }
    
    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [serverCollections, publicKey])

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Connect Your Wallet
          </h1>
          <p className="text-gray-600 mb-6">
            Please connect your Solana wallet to view your dashboard
          </p>
          <WalletMultiButton />
        </div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      case 'deployed':
        return 'bg-blue-100 text-blue-800'
      case 'minting':
        return 'bg-green-100 text-green-800'
      case 'completed':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getMintProgress = (minted: number, total: number) => {
    const safeTotal = Math.max(1, Number(total) || 0)
    const safeMinted = Math.max(0, Math.min(Number(minted) || 0, safeTotal))
    return (safeMinted / safeTotal) * 100
  }

  return (
    <div className="min-h-screen bg-dots overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <div className="flex items-center space-x-4">
              <WalletMultiButton />
              {/* Removed Clear Local Collections per request */}
              <Button onClick={() => router.push('/create')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Collection
              </Button>
            </div>
          </div>
        </div>
      </header>

        <div className="container mx-auto px-2 md:px-4 py-4 md:py-8 text-white">
        {/* Stats Overview */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-primary-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-300">Total Collections</p>
                <p className="text-2xl font-bold text-white">{collections.length}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-green-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-300">Total Minted</p>
                <p className="text-2xl font-bold text-white">{serverStats?.totalMinted ?? stats.totalMinted}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-yellow-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-300">Total Revenue</p>
                <p className="text-2xl font-bold text-white">{serverStats?.totalRevenue ?? stats.totalRevenue} SOL</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-primary-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-300">Unique Minters</p>
                <p className="text-2xl font-bold text-white">{serverStats?.uniqueMinters ?? stats.uniqueMinters}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Collections */}
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm">
          <div className="border-b px-4 md:px-6 py-3 md:py-4">
            <h2 className="text-base md:text-lg font-semibold text-white">Your Collections</h2>
          </div>
          
          {collections.length === 0 ? (
            <div className="p-8 text-center">
              <BarChart3 className="mx-auto mb-4 h-12 w-12 text-gray-400" />
              <h3 className="mb-2 text-lg font-medium text-white">
                No collections yet
              </h3>
              <p className="mb-4 text-gray-300">
                Create your first NFT collection to get started
              </p>
              <Button onClick={() => router.push('/create')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Collection
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {collections.map((collection) => (
                <div key={collection.id} className="p-4 md:p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 md:space-x-4">
                      <img
                        src={collection.image}
                        alt={collection.name}
                        className="h-12 w-12 md:h-16 md:w-16 rounded-lg object-cover"
                      />
                      <div>
                        <h3 className="text-base md:text-lg font-semibold text-white">
                          {collection.name}
                        </h3>
                        <p className="text-xs md:text-sm text-gray-300 line-clamp-1 md:line-clamp-none">{collection.description}</p>
                        <div className="flex items-center space-x-4 mt-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(collection.status)}`}>
                            {collection.status}
                          </span>
                          <span className="text-sm text-gray-400">
                            {collection.network}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            setSelectedCollection((collection as any).collectionAddress || collection.id)
                            try {
                              const res = await fetch(`/api/stats/${encodeURIComponent((collection as any).collectionAddress || collection.id)}`)
                              const js = await res.json()
                              if (res.ok) setChartData(js.mintHistory || [])
                            } catch {}
                          }}
                        >
                          View Stats
                        </Button>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xl md:text-2xl font-bold text-white">
                        {collection.price === 0 ? (
                          <span className="text-green-300">FREE</span>
                        ) : (
                          `${collection.price} SOL`
                        )}
                      </div>
                      {collection.price === 0 && (
                        <div className="text-xs font-medium text-green-300">
                          Free Mint
                        </div>
                      )}
                      {(() => {
                        const total = Math.max(1, Number(collection.itemsAvailable) || 0, Number(collection.itemsMinted) || 0)
                        const minted = Math.max(0, Math.min(Number(collection.itemsMinted) || 0, total))
                        return (
                          <div className="text-xs md:text-sm text-gray-300">
                            {minted} / {total} minted
                          </div>
                        )
                      })()}
                      <div className="mt-2 h-2 w-28 md:w-32 rounded-full bg-white/10">
                        <div
                          className="h-2 rounded-full bg-primary-500"
                          style={{ width: `${Math.min(100, getMintProgress(collection.itemsMinted, Math.max(collection.itemsAvailable, collection.itemsMinted))) }%` }}
                        />
                      </div>
                    </div>

                    {/* Desktop actions (limited) */}
                    <div className="hidden md:flex flex-wrap justify-end gap-2 md:space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(collection.mintPageUrl || `/mint/${collection.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditing(collection)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={async () => {
                          const ok = confirm('Delete this collection? This will remove it from the server list (not on-chain).')
                          if (!ok) return
                          try {
                            const target = (collection as any).collectionAddress || collection.id
                            const res = await fetch(`/api/collections?id=${encodeURIComponent(target)}`, { method: 'DELETE' })
                            const js = await res.json()
                            if (!res.ok) throw new Error(js?.error || 'Delete failed')
                            try { const { removeDeployedCollection } = await import('@/lib/utils/collectionStorage'); removeDeployedCollection(String(target)) } catch {}
                            // Refresh list without full reload
                            setCollections(prev => prev.filter(c => String(c.id) !== String(target)))
                          } catch (e: any) {
                            alert(e?.message || 'Delete failed')
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                    {/* Mobile actions */}
                    <div className="md:hidden">
                      <Button variant="outline" size="sm" onClick={() => setMobileActionsFor(collection.id)}>Actions</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedCollection && (
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/90 backdrop-blur mt-8">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Collection Stats</h2>
              <Button variant="outline" size="sm" onClick={() => setSelectedCollection(null)}>Close</Button>
            </div>
            <div className="p-6">
              {chartData.length === 0 ? (
                <div className="text-sm text-white/70">No history yet.</div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  <div className="overflow-hidden rounded-lg border border-white/10">
                    <div className="grid grid-cols-3 bg-white/5 text-white/80 text-xs font-medium">
                      <div className="px-4 py-2">Day</div>
                      <div className="px-4 py-2">Mints</div>
                      <div className="px-4 py-2">Revenue (SOL)</div>
                    </div>
                    <div className="divide-y divide-white/10">
                      {chartData.map((row, idx) => (
                        <div key={idx} className="grid grid-cols-3 text-white px-4 py-2">
                          <div>{new Date(row.timestamp).toLocaleDateString()}</div>
                          <div>{row.mints}</div>
                          <div>{row.revenue}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile actions sheet */}
      {mobileActionsFor && (() => {
        const c = collections.find((x) => x.id === mobileActionsFor)
        if (!c) return null
        return (
          <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setMobileActionsFor(null)}>
            <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-white/10 bg-[hsl(var(--card))] p-4" onClick={(e) => e.stopPropagation()}>
              <div className="mb-2 text-center text-white font-semibold">Actions</div>
              <div className="grid gap-2">
                <Button variant="outline" onClick={() => router.push(c.mintPageUrl || `/mint/${c.id}`)}>View</Button>
                <Button variant="outline" onClick={async () => {
                  const address = prompt('Airdrop to wallet address:'); if (!address) return
                  try { const res = await fetch('/api/airdrop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candyMachineAddress: c.candyMachineAddress, to: address, quantity: 1, network: c.network }) }); const js = await res.json(); if (!res.ok) throw new Error(js?.error || 'Airdrop failed'); alert(`Airdrop tx: ${js.signatures?.[0] || 'ok'}`) } catch(e:any){ alert(e?.message || 'Airdrop failed') }
                }}>Airdrop 1</Button>
                <Button variant="outline" onClick={async () => {
                  const qty = parseInt(prompt('Reserve (pre-mint) how many for team?') || '0', 10); if (!qty) return
                  try { const res = await fetch('/api/reserve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candyMachineAddress: c.candyMachineAddress, to: c.creatorAddress, quantity: qty, network: c.network }) }); const js = await res.json(); if (!res.ok) throw new Error(js?.error || 'Reserve failed'); alert(`Reserved. First tx: ${js.signatures?.[0] || 'ok'}`) } catch(e:any){ alert(e?.message || 'Reserve failed') }
                }}>Reserve</Button>
                <Button variant="outline" onClick={() => setEditing(c)}>Edit</Button>
                <Button variant="outline" onClick={async () => {
                  const mintAddress = prompt('Enter NFT mint address to update'); const newUri = mintAddress ? prompt('Enter new metadata URI') : null; if (!mintAddress || !newUri) return
                  try { const res = await fetch('/api/utils', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'updateMetadata', mintAddress, newUri, network: c.network }) }); const js = await res.json(); if (!res.ok) throw new Error(js?.error || 'Update failed'); alert(`Update tx: ${js.signature}`) } catch(e:any){ alert(e?.message || 'Update failed') }
                }}>Update URI</Button>
                <Button variant="outline" className="text-red-600" onClick={async () => {
                  const ok = confirm('Delete this collection?'); if (!ok) return
                  try { const res = await fetch(`/api/collections?id=${encodeURIComponent((c as any).collectionAddress || c.id)}`, { method: 'DELETE' }); const js = await res.json(); if (!res.ok) throw new Error(js?.error || 'Delete failed'); window.location.reload() } catch(e:any){ alert(e?.message || 'Delete failed') }
                }}>Delete</Button>
                <Button variant="outline" onClick={() => setMobileActionsFor(null)}>Close</Button>
              </div>
            </div>
          </div>
        )
      })()}

      {mobileActionsFor && (() => {
        const c = collections.find((x) => x.id === mobileActionsFor)
        if (!c) return null
        return (
          <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setMobileActionsFor(null)}>
            <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-white/10 bg-[hsl(var(--card))] p-4" onClick={(e) => e.stopPropagation()}>
              <div className="mb-2 text-center text-white font-semibold">Actions</div>
              <div className="grid gap-2">
                <Button variant="outline" onClick={async () => {
                  setSelectedCollection((c as any).collectionAddress || c.id)
                  try {
                    const res = await fetch(`/api/stats/${encodeURIComponent((c as any).collectionAddress || c.id)}`)
                    const js = await res.json()
                    if (res.ok) setChartData(js.mintHistory || [])
                  } catch {}
                  setMobileActionsFor(null)
                }}>View Stats</Button>
                <Button variant="outline" onClick={() => router.push(c.mintPageUrl || `/mint/${c.id}`)}>View</Button>
                <Button variant="outline" onClick={() => { setEditing(c); setMobileActionsFor(null) }}>Edit</Button>
                <Button variant="outline" className="text-red-600" onClick={async () => { const ok = confirm('Delete this collection?'); if (!ok) return; try { const target = (c as any).collectionAddress || c.id; const res = await fetch(`/api/collections?id=${encodeURIComponent(target)}`, { method: 'DELETE' }); const js = await res.json(); if (!res.ok) throw new Error(js?.error || 'Delete failed'); try { const { removeDeployedCollection } = await import('@/lib/utils/collectionStorage'); removeDeployedCollection(String(target)) } catch {}; setCollections(prev => prev.filter(x => String(x.id) !== String(target))); setMobileActionsFor(null) } catch(e:any){ alert(e?.message || 'Delete failed') } }}>Delete</Button>
                <Button variant="outline" onClick={() => setMobileActionsFor(null)}>Close</Button>
              </div>
            </div>
          </div>
        )
      })()}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-5xl rounded-xl border border-white/10 bg-[hsl(var(--card))]/95 shadow-xl max-h-[95vh] overflow-y-auto overscroll-contain">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[hsl(var(--card))]/95 px-4 py-3">
              <h3 className="text-base md:text-lg font-semibold text-white">Edit Collection</h3>
              <div className="space-x-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                <Button size="sm" onClick={async () => {
                  try {
                    const payload: any = {
                      id: editing.id,
                      name: editing.name,
                      price: editing.price,
                      itemsAvailable: editing.itemsAvailable,
                      startDate: (editing as any).startDate,
                      endDate: (editing as any).endDate,
                      status: editing.status,
                      imageUrl: (editing as any).image || (editing as any).image_url,
                      sellerFeeBasisPoints: (editing as any).sellerFeeBasisPoints,
                      standard: editing.standard,
                      phases: (editing as any).phases || [],
                    }
                    const res = await fetch('/api/collections', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                    const js = await res.json()
                    if (!res.ok) throw new Error(js?.error || 'Update failed')
                    window.location.reload()
                  } catch (e: any) {
                    alert(e?.message || 'Update failed')
                  }
                }}>Save</Button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-white">Name</label>
                <input className="w-full rounded-md border border-white/10 bg-[hsl(var(--card))] px-3 py-2 text-white" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <MintSettings
                  formData={{ mintSettings: { price: editing.price, itemsAvailable: editing.itemsAvailable, startDate: (editing as any).startDate || '', endDate: (editing as any).endDate || '', phases: (editing as any).phases || [], network: editing.network, sellerFeeBasisPoints: (editing as any).sellerFeeBasisPoints || 500, standard: editing.standard || 'core' }, collection: editing, collectionId: editing.id }}
                  onUpdate={(d: any) => setEditing({ ...editing, ...(d || {}), ...(d?.mintSettings || {}) })}
                  onNext={() => {}}
                  onBack={() => {}}
                  onDeploy={() => {}}
                  isLastStep={false}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      <WalletDebug />
    </div>
  )
}

