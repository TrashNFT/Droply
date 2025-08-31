import { NextRequest, NextResponse } from 'next/server'

const PINATA_JWT = process.env.PINATA_JWT || ''

async function ensureAuth() {
  if (!PINATA_JWT) {
    throw new Error('PINATA_JWT not configured on server')
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    const action = request.nextUrl.searchParams.get('action') || ''
    await ensureAuth()

    if (action === 'pinFile') {
      if (!contentType.includes('multipart/form-data')) {
        return NextResponse.json({ error: 'Content-Type must be multipart/form-data' }, { status: 400 })
      }
      const form = await request.formData()
      const file = form.get('file') as File | null
      const name = (form.get('name') as string) || undefined
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }
      const forward = new FormData()
      // Ensure filename is set explicitly to avoid multer "Unexpected field"
      const arr = await file.arrayBuffer()
      const blob = new Blob([arr], { type: file.type || 'application/octet-stream' })
      const filename = (file as any)?.name || 'file'
      forward.append('file', blob, filename)
      if (name) {
        // Pinata accepts JSON string for pinataMetadata
        forward.append('pinataMetadata', JSON.stringify({ name }))
      }
      const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PINATA_JWT}`,
        },
        body: forward,
      })
      const js = await res.json().catch(() => ({}))
      if (!res.ok) {
        // Bubble rate limit info to client so it can backoff
        const retryAfter = res.headers.get('retry-after') || undefined
        return NextResponse.json({ error: js?.error || js?.message || 'Pinata pinFile failed', retryAfter }, { status: res.status })
      }
      return NextResponse.json({ ok: true, cid: js.IpfsHash, uri: `ipfs://${js.IpfsHash}`, gateway: `https://gateway.pinata.cloud/ipfs/${js.IpfsHash}` })
    }

    if (action === 'pinJSON') {
      if (!contentType.includes('application/json')) {
        return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 400 })
      }
      const body = await request.json()
      const { json, name } = body || {}
      if (!json || typeof json !== 'object') {
        return NextResponse.json({ error: 'Missing json payload' }, { status: 400 })
      }
      const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PINATA_JWT}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pinataContent: json, ...(name ? { pinataMetadata: { name } } : {}) }),
      })
      const js = await res.json().catch(() => ({}))
      if (!res.ok) {
        const retryAfter = res.headers.get('retry-after') || undefined
        return NextResponse.json({ error: js?.error || js?.message || 'Pinata pinJSON failed', retryAfter }, { status: res.status })
      }
      return NextResponse.json({ ok: true, cid: js.IpfsHash, uri: `ipfs://${js.IpfsHash}`, gateway: `https://gateway.pinata.cloud/ipfs/${js.IpfsHash}` })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    console.error('Pinata API error:', e)
    return NextResponse.json({ error: e?.message || 'Pinata API failed' }, { status: 500 })
  }
}


