import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getMerkleRoot, getMerkleProof } from '@metaplex-foundation/js'

// POST supports JSON body with an action: 'upload' | 'clear' | 'merkle' | 'proof'
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    const isMultipart = contentType.includes('multipart/form-data')

    if (isMultipart) {
      // CSV upload via multipart/form-data
      const form = await request.formData()
      const collectionIdRaw = String(form.get('collectionId') || '')
      const phaseName = String(form.get('phaseName') || '')
      const file = form.get('file') as File | null
      const collectionId = await resolveCollectionId(collectionIdRaw)
      if (!collectionId || !phaseName || !file) {
        return NextResponse.json({ error: 'Missing collectionId, phaseName or file' }, { status: 400 })
      }
      const text = await file.text()
      const addresses = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)

      if (addresses.length === 0) {
        return NextResponse.json({ error: 'No addresses found in CSV' }, { status: 400 })
      }

      await bulkUpsertAllowlist(collectionId, phaseName, addresses)
      return NextResponse.json({ ok: true, count: addresses.length })
    }

    const body = await request.json()
    const { action } = body || {}
    if (!action) return NextResponse.json({ error: 'Missing action' }, { status: 400 })

    if (action === 'upload') {
      const { collectionId: collectionIdRaw, phaseName, addresses } = body
      const collectionId = await resolveCollectionId(String(collectionIdRaw || ''))
      if (!collectionId || !phaseName || !Array.isArray(addresses)) {
        return NextResponse.json({ error: 'Missing collectionId, phaseName or addresses' }, { status: 400 })
      }
      await bulkUpsertAllowlist(String(collectionId), String(phaseName), addresses.map((a: any) => String(a)))
      return NextResponse.json({ ok: true, count: addresses.length })
    }

    if (action === 'clear') {
      const { collectionId: collectionIdRaw, phaseName } = body
      const collectionId = await resolveCollectionId(String(collectionIdRaw || ''))
      if (!collectionId || !phaseName) return NextResponse.json({ error: 'Missing collectionId or phaseName' }, { status: 400 })
      await query(`DELETE FROM phase_allowlist WHERE collection_id = $1 AND phase_name = $2`, [collectionId, phaseName])
      return NextResponse.json({ ok: true })
    }

    if (action === 'merkle') {
      const { collectionId: collectionIdRaw, phaseName } = body
      const collectionId = await resolveCollectionId(String(collectionIdRaw || ''))
      if (!collectionId || !phaseName) return NextResponse.json({ error: 'Missing collectionId or phaseName' }, { status: 400 })
      const addresses = await fetchAllowlistAddresses(collectionId, phaseName)
      const root = addresses.length > 0 ? getMerkleRoot(addresses) : new Uint8Array(32)
      return NextResponse.json({ merkleRoot: Array.from(root), count: addresses.length })
    }

    if (action === 'proof') {
      const { collectionAddress, candyMachineAddress, phaseName, wallet } = body
      if (!wallet) return NextResponse.json({ error: 'Missing wallet' }, { status: 400 })

      // Resolve collection id
      let collectionId: string | null = null
      if (collectionAddress) {
        const res = await query(`SELECT id FROM collections WHERE collection_address = $1 LIMIT 1`, [collectionAddress])
        collectionId = res.rows?.[0]?.id || null
      } else if (candyMachineAddress) {
        const res = await query(`SELECT id FROM collections WHERE candy_machine_address = $1 LIMIT 1`, [candyMachineAddress])
        collectionId = res.rows?.[0]?.id || null
      }
      if (!collectionId) return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
      if (!phaseName) return NextResponse.json({ error: 'Missing phaseName' }, { status: 400 })

      const addresses = await fetchAllowlistAddresses(collectionId, phaseName)
      if (addresses.length === 0) return NextResponse.json({ error: 'No allowlist for this phase' }, { status: 404 })
      const proof = getMerkleProof(addresses, String(wallet))
      if (!proof || proof.length === 0) {
        return NextResponse.json({ error: 'Wallet not allowlisted' }, { status: 403 })
      }
      return NextResponse.json({ proof: proof.map((u8) => Array.from(u8)) })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Allowlist API error:', error)
    return NextResponse.json({ error: 'Allowlist API failed' }, { status: 500 })
  }
}

// GET: export CSV — requires collectionId & phaseName
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const collectionId = searchParams.get('collectionId')
    const phaseName = searchParams.get('phaseName')
    if (!collectionId || !phaseName) {
      return new NextResponse('Missing collectionId or phaseName', { status: 400 })
    }
    const addresses = await fetchAllowlistAddresses(collectionId, phaseName)
    const csv = addresses.join('\n')
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="allowlist-${phaseName}.csv"`,
      },
    })
  } catch (error) {
    console.error('Allowlist export error:', error)
    return new NextResponse('Allowlist export failed', { status: 500 })
  }
}

async function fetchAllowlistAddresses(collectionId: string, phaseName: string): Promise<string[]> {
  const res = await query<{ wallet_address: string }>(
    `SELECT wallet_address FROM phase_allowlist WHERE collection_id = $1 AND phase_name = $2`,
    [collectionId, phaseName]
  )
  return res.rows.map((r) => r.wallet_address.trim())
}

async function bulkUpsertAllowlist(collectionId: string, phaseName: string, addresses: string[]) {
  if (addresses.length === 0) return
  // Build values list
  const values: any[] = []
  const chunks: string[] = []
  addresses.forEach((addr, i) => {
    values.push(collectionId, phaseName, addr.trim())
    chunks.push(`($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`)
  })
  await query(
    `INSERT INTO phase_allowlist (collection_id, phase_name, wallet_address) VALUES ${chunks.join(',')} 
     ON CONFLICT (collection_id, phase_name, wallet_address) DO NOTHING`,
    values
  )
}

// Helper: allow `collectionId` to be a UUID or a collection_address
async function resolveCollectionId(idOrAddress: string): Promise<string | null> {
  const raw = (idOrAddress || '').trim()
  if (!raw) return null
  // If it looks like a UUID, assume it's the id
  if (/^[0-9a-fA-F-]{36}$/.test(raw)) return raw
  // Try resolve by collection_address
  try {
    const res = await query<{ id: string }>(`SELECT id FROM collections WHERE collection_address = $1 LIMIT 1`, [raw])
    return res.rows?.[0]?.id || null
  } catch {
    return null
  }
}




