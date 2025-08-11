"use client"

import React, { useEffect, useMemo, useState } from 'react'

export type CountdownProps = {
  start?: string | Date | null
  end?: string | Date | null
  className?: string
}

function format(num: number) {
  return String(Math.max(0, Math.floor(num))).padStart(2, '0')
}

export const Countdown: React.FC<CountdownProps> = ({ start, end, className }) => {
  const [now, setNow] = useState<number>(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const { label, d, h, m, s } = useMemo(() => {
    // Treat invalid or missing dates as -Infinity/Infinity
    const startMsRaw = start ? new Date(start).getTime() : NaN
    const endMsRaw = end ? new Date(end).getTime() : NaN
    const startMs = isFinite(startMsRaw) ? startMsRaw : -Infinity
    const endMs = isFinite(endMsRaw) ? endMsRaw : Infinity
    if (now < startMs) {
      const diff = startMs - now
      return { label: 'Starts in', d: diff / 86400000, h: (diff / 3600000) % 24, m: (diff / 60000) % 60, s: (diff / 1000) % 60 }
    }
    if (now < endMs) {
      const diff = endMs - now
      return { label: 'Ends in', d: diff / 86400000, h: (diff / 3600000) % 24, m: (diff / 60000) % 60, s: (diff / 1000) % 60 }
    }
    return { label: 'Ended', d: 0, h: 0, m: 0, s: 0 }
  }, [now, start, end])

  const ended = label === 'Ended'

  return (
    <div className={className}>
      <span className="mr-2 text-xs text-gray-400">{label}</span>
      {ended ? (
        <span className="text-xs text-gray-400">—</span>
      ) : (
        <span className="inline-flex items-center gap-2 rounded-md bg-white/5 px-2 py-1 text-xs font-medium text-white ring-1 ring-inset ring-white/10">
          <span>{format(d)}d</span>
          <span>{format(h)}h</span>
          <span>{format(m)}m</span>
          <span>{format(s)}s</span>
        </span>
      )}
    </div>
  )
}

export default Countdown



