import { NextRequest, NextResponse } from 'next/server'
import { getConnection } from '@/lib/solana/umi'
import { Metaplex, keypairIdentity } from '@metaplex-foundation/js'
import { Keypair, PublicKey } from '@solana/web3.js'

const SECRET = process.env.AIRDROP_WALLET_SECRET || ''

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body || {}
    if (!action) return NextResponse.json({ error: 'Missing action' }, { status: 400 })
    if (!SECRET) return NextResponse.json({ error: 'Server wallet not configured' }, { status: 500 })

    const { network = 'mainnet-beta' } = body
    const connection = getConnection(network as any)
    const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(SECRET)))
    const metaplex = Metaplex.make(connection).use(keypairIdentity(kp))

    if (action === 'burn') {
      const { mintAddress } = body
      if (!mintAddress) return NextResponse.json({ error: 'Missing mintAddress' }, { status: 400 })
      const { response } = await metaplex.nfts().delete({ mintAddress: new PublicKey(mintAddress) } as any)
      return NextResponse.json({ ok: true, signature: response.signature })
    }

    if (action === 'updateMetadata') {
      const { mintAddress, newUri } = body
      if (!mintAddress || !newUri) return NextResponse.json({ error: 'Missing mintAddress or newUri' }, { status: 400 })
      const nft = await metaplex.nfts().findByMint({ mintAddress: new PublicKey(mintAddress) } as any)
      const { response } = await metaplex.nfts().update({ nft: nft as any, uri: String(newUri) } as any)
      return NextResponse.json({ ok: true, signature: response.signature })
    }

    if (action === 'multisend') {
      const { candyMachineAddress, toList = [], quantityPerWallet = 1 } = body
      if (!candyMachineAddress || !Array.isArray(toList) || toList.length === 0) {
        return NextResponse.json({ error: 'Missing candyMachineAddress or empty toList' }, { status: 400 })
      }
      const cm = await metaplex.candyMachines().findByAddress({ address: new PublicKey(candyMachineAddress) })
      const sigs: string[] = []
      for (const addr of toList) {
        for (let i = 0; i < Number(quantityPerWallet || 1); i++) {
          const { response } = await metaplex.candyMachines().mint({
            candyMachine: cm as any,
            collectionUpdateAuthority: metaplex.identity().publicKey as any,
            owner: new PublicKey(String(addr)),
          } as any)
          sigs.push(response.signature)
        }
      }
      return NextResponse.json({ ok: true, signatures: sigs })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Utils API error:', error)
    return NextResponse.json({ error: 'Utils API failed' }, { status: 500 })
  }
}





