export type PinResult = { ok: boolean; cid: string; uri: string; gateway: string }

async function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

export async function pinFile(file: File, name?: string, maxAttempts: number = 6): Promise<PinResult> {
  const form = new FormData()
  const arr = await file.arrayBuffer()
  const blob = new Blob([arr], { type: file.type || 'application/octet-stream' })
  const filename = (file as any)?.name || 'file'
  form.append('file', blob, filename)
  if (name) form.append('name', name)
  let lastErr: any
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch('/api/pinata?action=pinFile', { method: 'POST', body: form })
      const js = await res.json().catch(() => ({}))
      if (res.ok && js?.cid) return js
      // Handle rate limit / transient
      if (res.status === 429 || res.status >= 500) {
        const ra = Number(res.headers.get('retry-after') || 0)
        const backoff = ra > 0 ? ra * 1000 : Math.min(30000, 500 * Math.pow(2, attempt))
        await delay(backoff + Math.floor(Math.random() * 200))
        continue
      }
      throw new Error(js?.error || 'pinFile failed')
    } catch (e: any) {
      lastErr = e
      await delay(Math.min(30000, 500 * Math.pow(2, attempt)))
    }
  }
  throw lastErr || new Error('pinFile failed')
}

export async function pinJSON(json: any, name?: string, maxAttempts: number = 6): Promise<PinResult> {
  let lastErr: any
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch('/api/pinata?action=pinJSON', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json, name }),
      })
      const js = await res.json().catch(() => ({}))
      if (res.ok && js?.cid) return js
      if (res.status === 429 || res.status >= 500) {
        const ra = Number(res.headers.get('retry-after') || 0)
        const backoff = ra > 0 ? ra * 1000 : Math.min(30000, 500 * Math.pow(2, attempt))
        await delay(backoff + Math.floor(Math.random() * 200))
        continue
      }
      throw new Error(js?.error || 'pinJSON failed')
    } catch (e: any) {
      lastErr = e
      await delay(Math.min(30000, 500 * Math.pow(2, attempt)))
    }
  }
  throw lastErr || new Error('pinJSON failed')
}


