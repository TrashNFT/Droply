"use client"

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/cn'
import { Clock, Sparkles, Coins } from 'lucide-react'

export interface ApiCollectionRow {
  id: string
  name: string
  symbol: string
  description?: string
  image_url?: string
  price?: number
  items_available?: number
  items_minted?: number
  candy_machine_address?: string | null
  collection_address?: string | null
  mint_page_url?: string | null
  slug?: string | null
  status?: string
  creator_address?: string
  network?: 'mainnet-beta' | 'devnet'
  seller_fee_basis_points?: number
  is_mutable?: boolean
  start_date?: string | null
  end_date?: string | null
  created_at?: string
  updated_at?: string
}

function formatPrice(value?: number) {
  if (value === null || value === undefined) return 'Free'
  if (Number(value) === 0) return 'Free'
  return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL`
}

function truncate(address?: string | null, front = 4, back = 4) {
  if (!address) return ''
  if (address.length <= front + back) return address
  return `${address.slice(0, front)}…${address.slice(-back)}`
}

export type CollectionCardProps = {
  collection: ApiCollectionRow
  className?: string
  priority?: boolean
}

export const CollectionCard: React.FC<CollectionCardProps> = ({ collection, className }) => {
  const minted = Number(collection.items_minted || 0)
  const supply = Number(collection.items_available || 0)
  const progress = supply > 0 ? Math.min(100, Math.round((minted / supply) * 100)) : 0
  const now = new Date()
  const start = collection.start_date ? new Date(collection.start_date) : undefined
  const end = collection.end_date ? new Date(collection.end_date) : undefined
  const hasStarted = !start || start <= now
  const notEnded = !end || end >= now
  const notSoldOut = minted < supply

  // Phase-aware live check: if any phase in phases[] overlaps now, treat as live
  const phases: any[] = Array.isArray((collection as any).phases) ? (collection as any).phases : []
  const anyPhaseLive = phases.some((p: any) => {
    const ps = p?.startDate ? new Date(p.startDate) : start
    const pe = p?.endDate ? new Date(p.endDate) : end
    const within = (!ps || ps <= now) && (!pe || pe >= now)
    return within
  })
  const baseWindowLive = hasStarted && notEnded
  const liveWindow = anyPhaseLive || baseWindowLive
  const isMintingNow = liveWindow && notSoldOut && (collection.status === 'deployed' || collection.status === 'minting' || !collection.status)

  const mintHref = collection.mint_page_url || (collection?.slug ? `/mint/${collection.slug}` : (collection.collection_address ? `/mint/${collection.collection_address}` : collection.id ? `/mint/${collection.id}` : '#'))

  return (
    <div className={cn('group relative overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm transition hover:shadow-lg', className)}>
      <div className="aspect-square overflow-hidden bg-[hsl(var(--muted))]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={collection.image_url || 'https://placehold.co/600x600/png?text=Collection'}
          alt={collection.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      </div>

      <div className="p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="truncate text-base font-semibold text-white">{collection.name}</h3>
          {isMintingNow ? (
            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
              <Sparkles className="mr-1 h-3.5 w-3.5" /> Minting
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-medium text-gray-300 ring-1 ring-inset ring-white/10">
              <Clock className="mr-1 h-3.5 w-3.5" /> {minted >= supply && supply > 0 ? 'Sold out' : 'Upcoming'}
            </span>
          )}
        </div>

        <div className="mb-3 flex items-center justify-between text-sm text-gray-300">
          <div className="inline-flex items-center">
            <Coins className="mr-1.5 h-4 w-4 text-primary-400" />
            <span>{formatPrice(collection.price)}</span>
          </div>
          <div className="text-xs text-gray-400">{truncate(collection.creator_address)}</div>
        </div>

        {supply > 0 && (
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
              <span>
                {minted}/{supply} minted
              </span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-primary-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <Link href={mintHref} className="block">
          <Button className="w-full">{isMintingNow ? 'Mint Now' : 'View Details'}</Button>
        </Link>
      </div>
    </div>
  )
}

export default CollectionCard


