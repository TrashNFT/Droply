import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: { collection: string } }) {
  try {
    const collectionAddress = params.collection
    if (!collectionAddress) return NextResponse.json({ error: 'Missing collection address' }, { status: 400 })
    const col = await query(`SELECT id FROM collections WHERE collection_address = $1 OR id::text = $1 LIMIT 1`, [collectionAddress])
    if (!col.rows.length) return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    const collectionId = col.rows[0].id

    const totals = await query(
      `SELECT COALESCE(SUM(quantity),0) AS total_minted, COALESCE(SUM(total_paid),0) AS total_revenue, COALESCE(COUNT(DISTINCT minter_address),0) AS unique_minters
       FROM mint_transactions WHERE collection_id = $1 AND status IN ('pending','confirmed')`,
      [collectionId]
    )
    const history = await query(
      `SELECT DATE_TRUNC('day', created_at) AS day, COALESCE(SUM(quantity),0) AS mints, COALESCE(SUM(total_paid),0) AS revenue
       FROM mint_transactions WHERE collection_id = $1 AND status = 'confirmed' GROUP BY 1 ORDER BY 1 DESC LIMIT 30`,
      [collectionId]
    )

    // Per-phase minted counts
    const perPhase = await query(
      `SELECT COALESCE(phase_name, 'Unknown') AS phase, COALESCE(SUM(quantity),0) AS mints
       FROM mint_transactions
       WHERE collection_id = $1 AND status = 'confirmed'
       GROUP BY COALESCE(phase_name, 'Unknown')
       ORDER BY 2 DESC`,
      [collectionId]
    )

    return NextResponse.json({
      totalMinted: Number(totals.rows?.[0]?.total_minted || 0),
      totalRevenue: Number(totals.rows?.[0]?.total_revenue || 0),
      uniqueMinters: Number(totals.rows?.[0]?.unique_minters || 0),
      mintHistory: history.rows.map((r: any) => ({ timestamp: r.day, mints: Number(r.mints), revenue: Number(r.revenue) })),
      phaseMinted: perPhase.rows.map((r: any) => ({ phase: r.phase, mints: Number(r.mints) })),
    })
  } catch (error) {
    console.error('Collection stats API error:', error)
    return NextResponse.json({ error: 'Failed to load collection stats' }, { status: 500 })
  }
}



