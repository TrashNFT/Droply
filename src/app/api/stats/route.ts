import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const creator = searchParams.get('creator')

    const totals = creator
      ? await query(
          `SELECT 
             COALESCE(SUM(mt.quantity),0) AS total_minted,
             COALESCE(SUM(mt.total_paid),0) AS total_revenue,
             COALESCE(COUNT(DISTINCT mt.minter_address),0) AS unique_minters
           FROM mint_transactions mt
           JOIN collections c ON mt.collection_id = c.id
           WHERE mt.status = 'confirmed' AND c.creator_address = $1`,
          [creator]
        )
      : await query(`
          SELECT 
            COALESCE(SUM(quantity),0) AS total_minted,
            COALESCE(SUM(total_paid),0) AS total_revenue,
            COALESCE(COUNT(DISTINCT minter_address),0) AS unique_minters
          FROM mint_transactions
          WHERE status = 'confirmed'
        `)

    const history = creator
      ? await query(
          `SELECT 
             DATE_TRUNC('day', mt.created_at) AS day,
             COALESCE(SUM(mt.quantity),0) AS mints,
             COALESCE(SUM(mt.total_paid),0) AS revenue
           FROM mint_transactions mt
           JOIN collections c ON mt.collection_id = c.id
           WHERE mt.status = 'confirmed' AND c.creator_address = $1
           GROUP BY 1
           ORDER BY 1 DESC
           LIMIT 14`,
          [creator]
        )
      : await query(`
          SELECT 
            DATE_TRUNC('day', created_at) AS day,
            COALESCE(SUM(quantity),0) AS mints,
            COALESCE(SUM(total_paid),0) AS revenue
          FROM mint_transactions
          WHERE status = 'confirmed'
          GROUP BY 1
          ORDER BY 1 DESC
          LIMIT 14
        `)

    return NextResponse.json({
      totalMinted: Number(totals.rows?.[0]?.total_minted || 0),
      totalRevenue: Number(totals.rows?.[0]?.total_revenue || 0),
      uniqueMinters: Number(totals.rows?.[0]?.unique_minters || 0),
      averageMintTime: 0,
      mintHistory: history.rows.map((r: any) => ({ timestamp: r.day, mints: Number(r.mints), revenue: Number(r.revenue) })),
    })
  } catch (error) {
    console.error('Stats API error:', error)
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
  }
}



