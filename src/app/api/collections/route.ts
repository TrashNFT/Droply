import { NextRequest, NextResponse } from 'next/server'
import type { CreateCollectionFormData } from '@/types'
import { query } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body: CreateCollectionFormData = await request.json()
    // Debug log (safe fields only)
    try {
      console.log('[POST /api/collections] Incoming', {
        name: body?.name,
        symbol: body?.symbol,
        hasItemUris: Array.isArray((body as any)?.itemUris) && (body as any).itemUris.length > 0,
        creatorAddress: body?.creatorAddress,
      })
    } catch {}

    // Validate required fields
    if (!body.name || !body.symbol || !body.description || !body.creatorAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Normalize image and phases before saving
    const normalizeImage = (url?: string | null) => {
      if (!url || typeof url !== 'string') return ''
      const trimmed = url.trim()
      if (trimmed.startsWith('ar://')) return `https://arweave.net/${trimmed.slice('ar://'.length)}`
      if (trimmed.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${trimmed.slice('ipfs://'.length)}`
      return trimmed
    }

    let imageUrl = normalizeImage((body as any).image)
    // If image not provided, try derive from first item_uris metadata
    if ((!imageUrl || imageUrl.length === 0) && Array.isArray((body as any).itemUris) && (body as any).itemUris.length > 0) {
      try {
        const firstRaw = (body as any).itemUris[0]
        const first = normalizeImage(firstRaw)
        if (typeof first === 'string' && /^https?:\/\//i.test(first)) {
          const r = await fetch(first, { cache: 'no-store' })
          const j = await r.json()
          imageUrl = normalizeImage(j?.image)
        }
      } catch {}
    }

    const result = await query(
       `INSERT INTO collections (name, symbol, description, image_url, price, items_available, items_minted, candy_machine_address, collection_address, merkle_tree_address, mint_page_url, status, creator_address, network, seller_fee_basis_points, is_mutable, start_date, standard, phases, item_uris, website, twitter, discord, sneak_peek_images, end_date, tm_collection_mint)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
       ON CONFLICT (collection_address)
       DO UPDATE SET
         name = EXCLUDED.name,
         symbol = EXCLUDED.symbol,
         description = EXCLUDED.description,
         image_url = EXCLUDED.image_url,
         price = EXCLUDED.price,
         items_available = EXCLUDED.items_available,
         items_minted = EXCLUDED.items_minted,
         candy_machine_address = EXCLUDED.candy_machine_address,
         merkle_tree_address = EXCLUDED.merkle_tree_address,
         mint_page_url = EXCLUDED.mint_page_url,
         status = EXCLUDED.status,
         creator_address = EXCLUDED.creator_address,
         network = EXCLUDED.network,
         seller_fee_basis_points = EXCLUDED.seller_fee_basis_points,
         is_mutable = EXCLUDED.is_mutable,
         start_date = EXCLUDED.start_date,
         standard = EXCLUDED.standard,
         phases = EXCLUDED.phases,
          item_uris = EXCLUDED.item_uris,
          website = EXCLUDED.website,
          twitter = EXCLUDED.twitter,
         discord = EXCLUDED.discord,
         sneak_peek_images = EXCLUDED.sneak_peek_images,
         end_date = EXCLUDED.end_date,
         tm_collection_mint = COALESCE(EXCLUDED.tm_collection_mint, collections.tm_collection_mint),
         updated_at = NOW()
       RETURNING *`,
      [
        body.name,
        body.symbol,
        body.description,
        imageUrl || '',
        body.price || 0,
        body.itemsAvailable || 0,
        0,
        body.candyMachineAddress || null,
        body.collectionAddress || null,
        (body as any).merkleTreeAddress || null,
        body.mintPageUrl || null,
        'deployed',
        body.creatorAddress,
        body.network || 'mainnet-beta',
        body.sellerFeeBasisPoints || 500,
        body.isMutable ?? true,
        body.startDate ? new Date(body.startDate) : null,
        body.standard || 'legacy',
        JSON.stringify((body as any).phases || []),
        JSON.stringify((body as any).itemUris || []),
        (body as any).website || null,
        (body as any).twitter || null,
        (body as any).discord || null,
        JSON.stringify((body as any).sneakPeekImages || []),
        (body as any).endDate ? new Date((body as any).endDate) : null,
        (body as any).tmCollectionMint || null,
      ]
    )

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Create collection error:', error)
    const message = (error as any)?.message || 'Failed to create collection'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, collectionAddress } = body || {}
    const target = id || collectionAddress
    if (!target) return NextResponse.json({ error: 'Missing id or collectionAddress' }, { status: 400 })

    // Build a dynamic update for a limited set of editable fields
    const fields: string[] = []
    const values: any[] = []
    const push = (sql: string, val: any) => { fields.push(sql); values.push(val) }
    if (typeof body.name === 'string') push('name = $X', body.name)
    if (typeof body.symbol === 'string') push('symbol = $X', body.symbol)
    if (typeof body.description === 'string') push('description = $X', body.description)
    if (typeof body.price !== 'undefined') push('price = $X', Number(body.price) || 0)
    if (typeof body.itemsAvailable !== 'undefined') push('items_available = $X', Number(body.itemsAvailable) || 0)
    if (typeof body.status === 'string') push('status = $X', body.status)
    if (typeof body.startDate !== 'undefined') push('start_date = $X', body.startDate ? new Date(body.startDate) : null)
    if (typeof body.endDate !== 'undefined') push('end_date = $X', body.endDate ? new Date(body.endDate) : null)
    if (typeof body.imageUrl === 'string') push('image_url = $X', body.imageUrl)
    if (typeof body.sellerFeeBasisPoints !== 'undefined') push('seller_fee_basis_points = $X', Number(body.sellerFeeBasisPoints) || 0)
    if (typeof body.standard === 'string') push('standard = $X', body.standard)
    if (Array.isArray(body.phases)) push('phases = $X', JSON.stringify(body.phases))
    if (typeof body.candyMachineAddress === 'string') push('candy_machine_address = $X', body.candyMachineAddress)
    if (typeof body.collectionAddress === 'string') push('collection_address = $X', body.collectionAddress)

    // Replace $X placeholders with correct $1..$N
    const sets = fields.map((f, i) => f.replace('$X', `$${i + 1}`))
    values.push(target)
    if (sets.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

    const sql = `UPDATE collections SET ${sets.join(', ')}, updated_at = NOW() WHERE id::text = $${values.length} OR collection_address = $${values.length} RETURNING *`
    const res = await query(sql, values)
    return NextResponse.json(res.rows[0] || null)
  } catch (error) {
    console.error('Update collection error:', error)
    return NextResponse.json({ error: 'Failed to update collection' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const creatorAddress = searchParams.get('creator')
    const address = searchParams.get('address')

    let result
     if (address && address.trim().length > 0) {
      result = await query(
        `SELECT c.*, COALESCE(s.minted,0) as items_minted
         FROM collections c
         LEFT JOIN (
           SELECT collection_id, COALESCE(SUM(quantity),0) as minted
           FROM mint_transactions
           WHERE status = 'confirmed'
           GROUP BY collection_id
         ) s ON s.collection_id = c.id
         WHERE c.collection_address = $1 OR c.id::text = $1
         LIMIT 1`,
        [address]
      )
      const row = result.rows[0]
      if (!row) return NextResponse.json(null)
      // Derive image from first metadata if missing
      if ((!row.image_url || row.image_url.length === 0) && Array.isArray(row.item_uris) && row.item_uris.length > 0) {
        try {
          const r = await fetch(row.item_uris[0], { cache: 'no-store' })
          const j = await r.json()
          if (j?.image && typeof j.image === 'string') {
            row.image_url = j.image
            // Persist in background
            query(`UPDATE collections SET image_url = $1, updated_at = NOW() WHERE id = $2`, [row.image_url, row.id]).catch(()=>{})
          }
        } catch {}
      }
      // Ensure phases is an array
      if (row?.phases && typeof row.phases === 'string') {
        try { row.phases = JSON.parse(row.phases) } catch {}
      }
      return NextResponse.json(row)
    } else {
      const hasFilter = creatorAddress && creatorAddress.trim().length > 0
      result = await query(
        hasFilter
          ? `SELECT c.*, COALESCE(s.minted,0) as items_minted
             FROM collections c
             LEFT JOIN (
               SELECT collection_id, COALESCE(SUM(quantity),0) as minted
               FROM mint_transactions
               WHERE status IN ('pending','confirmed')
               GROUP BY collection_id
             ) s ON s.collection_id = c.id
             WHERE c.creator_address = $1
             ORDER BY c.created_at DESC`
          : `SELECT c.*, COALESCE(s.minted,0) as items_minted
             FROM collections c
             LEFT JOIN (
               SELECT collection_id, COALESCE(SUM(quantity),0) as minted
               FROM mint_transactions
               WHERE status = 'confirmed'
               GROUP BY collection_id
             ) s ON s.collection_id = c.id
             ORDER BY c.created_at DESC`,
        hasFilter ? [creatorAddress] : []
      )
    }

    const rows = result.rows || []
    // Best-effort fill missing images from metadata for list view
    const filled = await Promise.all(rows.map(async (row: any) => {
      if ((!row.image_url || row.image_url.length === 0) && Array.isArray(row.item_uris) && row.item_uris.length > 0) {
        try {
          const r = await fetch(row.item_uris[0], { cache: 'no-store' })
          const j = await r.json()
          if (j?.image && typeof j.image === 'string') {
            row.image_url = j.image
            query(`UPDATE collections SET image_url = $1, updated_at = NOW() WHERE id = $2`, [row.image_url, row.id]).catch(()=>{})
          }
        } catch {}
      }
      if (row?.phases && typeof row.phases === 'string') {
        try { row.phases = JSON.parse(row.phases) } catch {}
      }
      return row
    }))

    return NextResponse.json(filled)
  } catch (error) {
    console.error('List collections error:', error)
    const message = (error as any)?.message || 'Failed to list collections'
    return NextResponse.json({ error: 'Failed to list collections', details: process.env.NODE_ENV !== 'production' ? message : undefined }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const idOrAddress = searchParams.get('id') || searchParams.get('address')
    if (!idOrAddress) {
      return NextResponse.json({ error: 'Missing id or address' }, { status: 400 })
    }
    // Delete by UUID or collection_address
    await query(
      `DELETE FROM collections WHERE id::text = $1 OR collection_address = $1`,
      [idOrAddress]
    )
    try {
      // Notify clients to remove from localStorage if present
      // Clients listen for this event to call removeDeployedCollection
      // This is a no-op server-side; kept for clarity and future SSE/websocket hooks
    } catch {}
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete collection error:', error)
    return NextResponse.json({ error: 'Failed to delete collection' }, { status: 500 })
  }
}


