import { NextRequest, NextResponse } from 'next/server'

const NFT_TOKEN = process.env.NFT_STORAGE_TOKEN || ''

function withTimeout(ms: number): AbortController {
  const controller = new AbortController()
  setTimeout(() => controller.abort(), ms)
  return controller
}

async function ensureAuth() {
  if (!NFT_TOKEN || NFT_TOKEN.trim().length === 0) {
    throw new Error('NFT_STORAGE_TOKEN not configured on server')
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    const action = request.nextUrl.searchParams.get('action') || ''
    await ensureAuth()

    if (action === 'putFile') {
      if (!contentType.includes('multipart/form-data')) {
        return NextResponse.json({ error: 'Content-Type must be multipart/form-data' }, { status: 400 })
      }
      const form = await request.formData()
      const file = form.get('file') as File | null
      const name = (form.get('name') as string) || (file as any)?.name || 'file'
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }
      const arr = await file.arrayBuffer()
      const blob = new Blob([arr], { type: file.type || 'application/octet-stream' })

      const controller = withTimeout(60_000)
      const res = await fetch('https://api.nft.storage/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${NFT_TOKEN}`,
          'X-NAME': name,
        },
        body: blob,
        signal: controller.signal,
      })
      const js = await res.json().catch(() => ({}))
      if (!res.ok) {
        const retryAfter = res.headers.get('retry-after') || undefined
        return NextResponse.json({ error: js?.error || js?.message || 'NFT.Storage upload failed', retryAfter }, { status: res.status })
      }
      const cid = js?.value?.cid || js?.cid
      if (!cid) return NextResponse.json({ error: 'Missing CID in response' }, { status: 502 })
      return NextResponse.json({ ok: true, cid, uri: `ipfs://${cid}`, gateway: `https://nftstorage.link/ipfs/${cid}` })
    }

    if (action === 'putJSON') {
      if (!contentType.includes('application/json')) {
        return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 400 })
      }
      const body = await request.json()
      const { json, name } = body || {}
      if (!json || typeof json !== 'object') {
        return NextResponse.json({ error: 'Missing json payload' }, { status: 400 })
      }
      const blob = new Blob([JSON.stringify(json)], { type: 'application/json' })
      const controller = withTimeout(60_000)
      const res = await fetch('https://api.nft.storage/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${NFT_TOKEN}`,
          'Content-Type': 'application/json',
          ...(name ? { 'X-NAME': String(name) } : {}),
        },
        body: blob,
        signal: controller.signal,
      })
      const js = await res.json().catch(() => ({}))
      if (!res.ok) {
        const retryAfter = res.headers.get('retry-after') || undefined
        return NextResponse.json({ error: js?.error || js?.message || 'NFT.Storage upload failed', retryAfter }, { status: res.status })
      }
      const cid = js?.value?.cid || js?.cid
      if (!cid) return NextResponse.json({ error: 'Missing CID in response' }, { status: 502 })
      return NextResponse.json({ ok: true, cid, uri: `ipfs://${cid}`, gateway: `https://nftstorage.link/ipfs/${cid}` })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    console.error('NFT.Storage API error:', e)
    return NextResponse.json({ error: e?.message || 'NFT.Storage API failed' }, { status: 500 })
  }
}


