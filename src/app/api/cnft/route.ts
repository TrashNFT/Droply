import { NextRequest, NextResponse } from 'next/server'
import { getUmiBubblegum } from '@/lib/solana/umi'
import { generateSigner } from '@metaplex-foundation/umi'

// POST actions: initTree, mint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body || {}
    if (!action) return NextResponse.json({ error: 'Missing action' }, { status: 400 })

    if (action === 'initTree') {
      const { network = 'devnet', depth = 14, bufferSize = 64, canopyDepth = 14 } = body
      const umi = getUmiBubblegum(network as any)
      const tree = generateSigner(umi)
      try {
        const bubblegum: any = await import('@metaplex-foundation/mpl-bubblegum')
        const createTreeFn = bubblegum?.createTree || bubblegum?.create
        if (!createTreeFn) throw new Error('createTree not found in mpl-bubblegum')
        await createTreeFn(umi, {
          merkleTree: tree,
          maxDepth: depth,
          maxBufferSize: bufferSize,
          canopyDepth,
          treeCreator: (umi as any).identity,
          treeDelegate: (umi as any).identity,
        } as any).sendAndConfirm(umi)
        return NextResponse.json({ ok: true, treeAddress: (tree.publicKey as any).toString() })
      } catch (e: any) {
        return NextResponse.json({ error: 'initTree not available in this build', details: e?.message || String(e) }, { status: 501 })
      }
    }

    if (action === 'mint') {
      return NextResponse.json({ error: 'cNFT mint not supported in this build. Please mint client-side using Umi bubblegum or upgrade server libs.' }, { status: 501 })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('cNFT API error:', error)
    return NextResponse.json({ error: 'cNFT API failed' }, { status: 500 })
  }
}


