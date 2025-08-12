import { NextRequest, NextResponse } from 'next/server'
import { getConnection } from '@/lib/solana/umi'
import { Metaplex, keypairIdentity } from '@metaplex-foundation/js'
import { Keypair, PublicKey } from '@solana/web3.js'

// Caution: server-side signing requires a hot wallet. Use securely via env/private key.
const AIRDROP_SECRET = process.env.AIRDROP_WALLET_SECRET || ''

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { candyMachineAddress, to, quantity = 1, network = 'mainnet-beta', groupLabel } = body || {}
    if (!candyMachineAddress || !to || quantity <= 0) {
      return NextResponse.json({ error: 'Missing candyMachineAddress, to, or invalid quantity' }, { status: 400 })
    }
    if (!AIRDROP_SECRET) return NextResponse.json({ error: 'Server airdrop wallet not configured' }, { status: 500 })

    const secret = JSON.parse(AIRDROP_SECRET)
    const kp = Keypair.fromSecretKey(Uint8Array.from(secret))
    const connection = getConnection('mainnet-beta')
    const metaplex = Metaplex.make(connection).use(keypairIdentity(kp))
    const cm = await metaplex.candyMachines().findByAddress({ address: new PublicKey(candyMachineAddress) })

    const sigs: string[] = []
    for (let i = 0; i < Number(quantity); i++) {
      const { response } = await metaplex.candyMachines().mint({
        candyMachine: cm as any,
        collectionUpdateAuthority: metaplex.identity().publicKey as any,
        owner: new PublicKey(String(to)),
        ...(groupLabel ? { group: String(groupLabel) as any } : {}),
      } as any)
      sigs.push(response.signature)
    }
    return NextResponse.json({ ok: true, signatures: sigs })
  } catch (error) {
    console.error('Airdrop API error:', error)
    return NextResponse.json({ error: 'Airdrop failed' }, { status: 500 })
  }
}


