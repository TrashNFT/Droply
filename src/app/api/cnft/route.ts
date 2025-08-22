import { NextRequest, NextResponse } from 'next/server'
import { getUmiBubblegum } from '@/lib/solana/umi'
import { generateSigner, publicKey as umiPublicKey } from '@metaplex-foundation/umi'
import bs58 from 'bs58'

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
      const { network = 'mainnet-beta', treeAddress, to, name = 'Compressed NFT', uri, sellerFeeBasisPoints = 0, symbol = '', collectionMint } = body || {}
      if (!treeAddress || !to || !uri) {
        return NextResponse.json({ error: 'Missing treeAddress, to, or uri' }, { status: 400 })
      }
      const umi = getUmiBubblegum(network as any)
      const bubblegum: any = await import('@metaplex-foundation/mpl-bubblegum')
      const argsBase: any = {
        merkleTree: umiPublicKey(treeAddress),
        leafOwner: umiPublicKey(to),
        metadata: {
          name,
          uri,
          symbol,
          sellerFeeBasisPoints,
        },
      }
      let res
      try {
        if (collectionMint) {
          const fn = bubblegum?.mintToCollectionV1
          if (!fn) throw new Error('mintToCollectionV1 not available')
          res = await fn(umi, {
            ...argsBase,
            collectionMint: umiPublicKey(collectionMint),
            collectionAuthority: (umi as any).identity,
          } as any).sendAndConfirm(umi)
        } else {
          const fn = bubblegum?.mintV1 || bubblegum?.mint
          if (!fn) throw new Error('mintV1 not available')
          res = await fn(umi, argsBase).sendAndConfirm(umi)
        }
      } catch (e: any) {
        const msg = e?.message || String(e)
        try {
          const logs = typeof e?.getLogs === 'function' ? await e.getLogs() : undefined
          return NextResponse.json({ error: msg, logs }, { status: 500 })
        } catch {
          return NextResponse.json({ error: msg }, { status: 500 })
        }
      }
      let signature: string
      try {
        signature = bs58.encode((res as any)?.signature as Uint8Array)
      } catch {
        signature = String((res as any)?.signature)
      }
      return NextResponse.json({ ok: true, signature })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('cNFT API error:', error)
    return NextResponse.json({ error: 'cNFT API failed' }, { status: 500 })
  }
}


