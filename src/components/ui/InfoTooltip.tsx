"use client"

import React, { useEffect, useRef, useState } from 'react'
import { Info } from 'lucide-react'

type Props = {
  text: string
  className?: string
  size?: number
}

export default function InfoTooltip({ text, className, size = 14 }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={ref} className={`relative inline-block ${className || ''}`}>
      <button
        type="button"
        aria-label="Info"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md p-1 text-gray-300 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <Info width={size} height={size} />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 rounded-md border border-white/10 bg-[hsl(var(--card))] p-3 text-xs text-gray-200 shadow-xl">
          {text}
        </div>
      )}
    </div>
  )}













