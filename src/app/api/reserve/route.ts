import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getConnection } from '@/lib/solana/umi'
import { Metaplex, keypairIdentity } from '@metaplex-foundation/js'
import { Keypair, PublicKey } from '@solana/web3.js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { candyMachineAddress, to, quantity = 1, network = 'mainnet-beta', groupLabel } = body || {}
    if (!candyMachineAddress || !to || quantity <= 0) {
      return NextResponse.json({ error: 'Missing candyMachineAddress, to or invalid quantity' }, { status: 400 })
    }
    const connection = getConnection('mainnet-beta')
    // Use a single hot wallet for all server-side mints (airdrop/reserve/cNFT)
    const SECRET = process.env.AIRDROP_WALLET_SECRET || ''
    if (!SECRET) return NextResponse.json({ error: 'Server mint wallet not configured' }, { status: 500 })
    const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(SECRET)))
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
    console.error('Reserve API error:', error)
    return NextResponse.json({ error: 'Reserve API failed' }, { status: 500 })
  }
}


