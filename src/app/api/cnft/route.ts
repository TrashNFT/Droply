import { NextRequest, NextResponse } from 'next/server'
import { getUmiBubblegum } from '@/lib/solana/umi'
import { generateSigner } from '@metaplex-foundation/umi'
import { Metaplex, keypairIdentity } from '@metaplex-foundation/js'
import { Keypair, PublicKey } from '@solana/web3.js'
import { getConnection } from '@/lib/solana/umi'

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
      const { network = 'devnet', treeAddress, to, name, uri, sellerFeeBasisPoints = 500, symbol = '' } = body
      if (!treeAddress || !to || !name || !uri) {
        return NextResponse.json({ error: 'Missing treeAddress, to, name or uri' }, { status: 400 })
      }
      // For server-side mint, use a dedicated signer (same secret as airdrop/reserve or CNFT_WALLET_SECRET)
      const SECRET = process.env.AIRDROP_WALLET_SECRET || ''
      if (!SECRET) return NextResponse.json({ error: 'Server cNFT wallet not configured' }, { status: 500 })
      const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(SECRET)))
      const connection = getConnection(network as any)
      const metaplex = Metaplex.make(connection).use(keypairIdentity(kp))
      const treePk = new PublicKey(String(treeAddress))
      const ownerPk = new PublicKey(String(to))
      const { response, nft } = await metaplex.nfts().createNft({
        name,
        uri,
        sellerFeeBasisPoints: Number(sellerFeeBasisPoints) || 0,
        tree: treePk,
        tokenOwner: ownerPk,
        symbol,
      } as any)
      const assetId = (nft as any)?.address?.toBase58 ? (nft as any).address.toBase58() : ((nft as any)?.address || null)
      return NextResponse.json({ ok: true, signature: response.signature, assetId })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('cNFT API error:', error)
    return NextResponse.json({ error: 'cNFT API failed' }, { status: 500 })
  }
}


