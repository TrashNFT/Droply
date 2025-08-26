import Link from 'next/link'
import { WalletMultiButton } from '@/components/wallet/WalletMultiButton'
import { Button } from '@/components/ui/Button'
import { ArrowRight } from 'lucide-react'
import CollectionCard, { ApiCollectionRow } from '@/components/collections/CollectionCard'
import { headers } from 'next/headers'
import React from 'react'
import Image from 'next/image'
import { PLATFORM_CONFIG } from '@/config/platform'

export const dynamic = 'force-dynamic'

function getBaseUrl() {
  // Prefer runtime headers
  try {
    const h = headers()
    const proto = h.get('x-forwarded-proto') ?? 'http'
    const host = h.get('x-forwarded-host') ?? h.get('host')
    if (host) return `${proto}://${host}`
  } catch {}
  // Fallback to envs
  const fromEnv =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
  if (fromEnv) return fromEnv
  return `http://localhost:${process.env.PORT || 3000}`
}

async function fetchCollections(): Promise<ApiCollectionRow[]> {
  const base = getBaseUrl()
  const res = await fetch(`${base}/api/collections`, {
    // Mark as ISR-capable fetch
    next: { revalidate: 30 },
  })
  if (!res.ok) return []
  return res.json()
}

export default async function HomePage() {
  const collections = await fetchCollections()

  // Split into minting vs all
  const now = new Date()
  const mintingNow = collections.filter((c) => {
    const minted = Number(c.items_minted || 0)
    const supply = Number(c.items_available || 0)
    const start = c.start_date ? new Date(c.start_date) : undefined
    const end = c.end_date ? new Date(c.end_date) : undefined
    const hasStarted = !start || start <= now
    const notEnded = !end || end >= now
    const notSoldOut = supply === 0 ? true : minted < supply
    const statusOk = c.status === 'minting' || c.status === 'deployed' || !c.status
    const phases = Array.isArray((c as any).phases) ? (c as any).phases : []
    const anyPhaseLive = phases.some((p: any) => {
      const ps = p?.startDate ? new Date(p.startDate) : start
      const pe = p?.endDate ? new Date(p.endDate) : end
      return (!ps || ps <= now) && (!pe || pe >= now)
    })
    const liveWindow = anyPhaseLive || (hasStarted && notEnded)
    return liveWindow && notSoldOut && statusOk
  })

  return (
    <div className="min-h-screen bg-dots">
      <header className="sticky top-0 z-30 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--card))]/60">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center space-x-2">
            <Image src={PLATFORM_CONFIG.PLATFORM_LOGO_SRC} alt={PLATFORM_CONFIG.PLATFORM_NAME} width={28} height={28} className="h-7 w-7" />
            <h1 className="text-xl font-semibold text-white md:text-2xl">{PLATFORM_CONFIG.PLATFORM_NAME}</h1>
          </div>
          <WalletMultiButton />
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="container mx-auto px-4 py-12 md:py-16">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="mb-4 text-4xl font-bold tracking-tight text-white md:text-6xl">Discover Rare NFTs</h1>
            <p className="mx-auto mb-8 max-w-2xl text-base text-gray-300 md:text-lg">
              Your hub for launching premium digital collectibles.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="#minting">
                <Button size="lg">Browse Collections</Button>
              </Link>
              <Link href="/create">
                <Button size="lg" variant="outline">
                  Start Creating
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Minting Now */}
        <section id="minting" className="container mx-auto px-4 py-10">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white md:text-2xl">Minting Now</h2>
            <Link href="/dashboard" className="text-sm text-primary-300 hover:underline">
              View dashboard
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {mintingNow.length === 0 && (
              <div className="col-span-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 text-center text-gray-300">No active mints right now.</div>
            )}
            {mintingNow.map((c) => (
              <CollectionCard key={c.id} collection={c} />
            ))}
          </div>
        </section>

        {/* All Collections */}
        <section className="container mx-auto px-4 pb-16 pt-4">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white md:text-2xl">All Collections</h2>
            <Link href="/create" className="text-sm text-primary-300 hover:underline">
              Launch yours
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {collections.map((c) => (
              <CollectionCard key={`all-${c.id}`} collection={c} />
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto px-4 pb-24">
          <div className="rounded-2xl bg-[hsl(var(--card))] p-8 text-center text-white ring-1 ring-inset ring-[hsl(var(--border))] md:p-12">
            <h2 className="mb-3 text-2xl font-bold md:text-3xl">Ready To Create Your Own collection?</h2>
            <p className="mx-auto mb-6 max-w-xl text-white/80">Join our community of creators and collectors today.</p>
            <Link href="/create">
              <Button size="lg" variant="secondary" className="text-base md:text-lg">
                Get Started Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] py-10">
        <div className="container mx-auto px-4 text-center text-sm text-gray-400">
          <div className="mb-2 flex items-center justify-center gap-2">
            <Image src={PLATFORM_CONFIG.PLATFORM_LOGO_SRC} alt={PLATFORM_CONFIG.PLATFORM_NAME} width={16} height={16} className="h-4 w-4" />
            <span className="font-medium text-gray-200">{PLATFORM_CONFIG.PLATFORM_NAME}</span>
          </div>
          <p>Build, launch and mint on Solana.</p>
        </div>
      </footer>
    </div>
  )
}
