export type PinResult = { ok: boolean; cid: string; uri: string; gateway: string }

export async function pinFile(file: File, name?: string): Promise<PinResult> {
  const form = new FormData()
  form.append('file', file)
  if (name) form.append('name', name)
  const res = await fetch('/api/pinata?action=pinFile', { method: 'POST', body: form })
  const js = await res.json()
  if (!res.ok || !js?.cid) throw new Error(js?.error || 'pinFile failed')
  return js
}

export async function pinJSON(json: any, name?: string): Promise<PinResult> {
  const res = await fetch('/api/pinata?action=pinJSON', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ json, name }),
  })
  const js = await res.json()
  if (!res.ok || !js?.cid) throw new Error(js?.error || 'pinJSON failed')
  return js
}


