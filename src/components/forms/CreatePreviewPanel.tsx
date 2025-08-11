"use client"

import React, { useMemo } from 'react'
import { Sparkles, Coins } from 'lucide-react'

type Props = {
  formData: any
}

const fallbackImg = 'https://placehold.co/600x600/png?text=Collection'

export default function CreatePreviewPanel({ formData }: Props) {
  const img = useMemo(() => {
    return (
      formData?.collection?.image ||
      formData?.assets?.[0]?.preview ||
      fallbackImg
    )
  }, [formData])

  const name = formData?.collection?.name || 'Untitled Collection'
  const symbol = formData?.collection?.symbol || 'SYMB'
  const price = Number(formData?.mintSettings?.price || 0)
  const supply = Number(formData?.mintSettings?.itemsAvailable || formData?.assets?.length || 0)

  const peeks: string[] = (formData?.assets || []).slice(0, 5).map((a: any) => a?.preview).filter(Boolean)

  // Compute phase status from inputs
  const phases: any[] = Array.isArray(formData?.mintSettings?.phases) ? formData.mintSettings.phases : []
  const now = Date.now()
  let phaseStatus: 'Live' | 'Upcoming' | 'Ended' | null = null
  if (phases.length > 0) {
    const active = phases.find((p: any) => {
      const s = p?.startDate ? new Date(p.startDate).getTime() : -Infinity
      const e = p?.endDate ? new Date(p.endDate).getTime() : Infinity
      return now >= s && now <= e
    })
    if (active) phaseStatus = 'Live'
    else {
      const upcoming = phases.some((p: any) => (p?.startDate ? new Date(p.startDate).getTime() : Infinity) > now)
      phaseStatus = upcoming ? 'Upcoming' : 'Ended'
    }
  }

  return (
    <aside className="md:sticky md:top-24">
      <div className="card-hover overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/95 shadow-sm">
        <div className="aspect-square overflow-hidden bg-[hsl(var(--muted))]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt={name} className="h-full w-full object-cover" />
        </div>
        <div className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="truncate text-lg font-semibold text-white">{name}</h3>
            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
              <Sparkles className="mr-1 h-3.5 w-3.5" /> Preview
            </span>
          </div>
          <div className="mb-3 flex items-center justify-between text-sm text-gray-300">
            <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs ring-1 ring-inset ring-white/10">{symbol}</span>
            <div className="inline-flex items-center gap-2">
              {phaseStatus && (
                <span className={`rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset ${phaseStatus === 'Live' ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30' : phaseStatus === 'Upcoming' ? 'bg-amber-500/15 text-amber-300 ring-amber-500/30' : 'bg-white/5 text-gray-300 ring-white/10'}`}>{phaseStatus}</span>
              )}
              <span className="inline-flex items-center"><Coins className="mr-1.5 h-4 w-4 text-primary-400" /> {price === 0 ? 'Free' : `${price} SOL`}</span>
            </div>
          </div>
          {!!supply && (
            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
                <span>Supply</span>
                <span>{supply}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-primary-500" style={{ width: supply ? '18%' : '0%' }} />
              </div>
            </div>
          )}
          {peeks.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-xs text-gray-400">Sneak peeks</div>
              <div className="grid grid-cols-5 gap-2">
                {peeks.map((p, i) => (
                  <div key={i} className="overflow-hidden rounded-lg ring-1 ring-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p} alt={`peek-${i}`} className="aspect-square w-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}


