export type PutResult = { ok: boolean; cid: string; uri: string; gateway: string }

async function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

function withTimeout(ms: number): AbortController {
  const controller = new AbortController()
  setTimeout(() => controller.abort(), ms)
  return controller
}

export async function putFile(file: File, name?: string, maxAttempts: number = 6): Promise<PutResult> {
  const arr = await file.arrayBuffer()
  const blob = new Blob([arr], { type: file.type || 'application/octet-stream' })
  let lastErr: any
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const form = new FormData()
      form.append('file', new Blob([arr], { type: file.type || 'application/octet-stream' }), (file as any)?.name || 'file')
      const controller = withTimeout(60000)
      const res = await fetch('/api/web3?action=putFile', {
        method: 'POST',
        body: form,
        signal: controller.signal,
      })
      const js = await res.json().catch(() => ({}))
      if (res.ok && js?.cid) return js
      if (res.status === 429 || res.status >= 500) {
        const ra = Number(res.headers.get('retry-after') || 0)
        const backoff = ra > 0 ? ra * 1000 : Math.min(30000, 500 * Math.pow(2, attempt))
        await delay(backoff + Math.floor(Math.random() * 200))
        continue
      }
      const baseMsg = js?.error || js?.message || 'putFile failed'
      const err: any = new Error(`${baseMsg}${res.status ? ` (status ${res.status})` : ''}`)
      err.status = res.status
      err.nonRetryable = true
      throw err
    } catch (e: any) {
      lastErr = e
      if (e?.nonRetryable || e?.name === 'AbortError') throw e
      await delay(Math.min(30000, 500 * Math.pow(2, attempt)))
    }
  }
  throw lastErr || new Error('putFile failed')
}

export async function putJSON(json: any, name?: string, maxAttempts: number = 6): Promise<PutResult> {
  let lastErr: any
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const controller = withTimeout(60000)
      const res = await fetch('/api/web3?action=putJSON', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json, name }),
        signal: controller.signal,
      })
      const js = await res.json().catch(() => ({}))
      if (res.ok && js?.cid) return js
      if (res.status === 429 || res.status >= 500) {
        const ra = Number(res.headers.get('retry-after') || 0)
        const backoff = ra > 0 ? ra * 1000 : Math.min(30000, 500 * Math.pow(2, attempt))
        await delay(backoff + Math.floor(Math.random() * 200))
        continue
      }
      const baseMsg = js?.error || js?.message || 'putJSON failed'
      const err: any = new Error(`${baseMsg}${res.status ? ` (status ${res.status})` : ''}`)
      err.status = res.status
      err.nonRetryable = true
      throw err
    } catch (e: any) {
      lastErr = e
      if (e?.nonRetryable || e?.name === 'AbortError') throw e
      await delay(Math.min(30000, 500 * Math.pow(2, attempt)))
    }
  }
  throw lastErr || new Error('putJSON failed')
}


