import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getConnection } from '@/lib/solana/umi'
import { Metaplex, keypairIdentity } from '@metaplex-foundation/js'
import { Keypair, PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'

// Token Metadata (Legacy) handled via JS high-level API in this route

const SECRET = process.env.AIRDROP_WALLET_SECRET || ''

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body || {}
    if (!action) return NextResponse.json({ error: 'Missing action' }, { status: 400 })

    const { network = 'mainnet-beta' } = body
    const connection = getConnection(network as any)

    // Load server signer (required to create TM collection once if needed)
    let serverKp: Keypair | null = null
    if (SECRET) {
      try {
        const trimmed = SECRET.trim()
        const secretBytes = trimmed.startsWith('[')
          ? Uint8Array.from(JSON.parse(trimmed))
          : bs58.decode(trimmed)
        serverKp = Keypair.fromSecretKey(secretBytes)
      } catch {
        return NextResponse.json({ error: 'Invalid AIRDROP_WALLET_SECRET format' }, { status: 500 })
      }
    }

    // Ensure a Legacy TM collection mint exists for a Core collection
    if (action === 'ensureTmCollection') {
      const { collectionId, name, symbol, uri, updateAuthority } = body || {}
      if (!collectionId || !name || !symbol || !uri) {
        return NextResponse.json({ error: 'Missing collectionId, name, symbol or uri' }, { status: 400 })
      }
      if (!serverKp) {
        return NextResponse.json({ error: 'Server wallet not configured' }, { status: 500 })
      }

      // Check if exists
      const res = await query('SELECT tm_collection_mint FROM collections WHERE id = $1 LIMIT 1', [collectionId])
      const existing = res.rows?.[0]?.tm_collection_mint as string | undefined
      if (existing && existing.length > 0) {
        return NextResponse.json({ ok: true, tmCollectionMint: existing })
      }

      // Create a minimal Legacy collection NFT using JS SDK (simplest path)
      const mx = Metaplex.make(connection).use(keypairIdentity(serverKp))
      const { nft } = await mx.nfts().create({
        name,
        symbol,
        uri,
        isCollection: true,
        sellerFeeBasisPoints: 0,
        updateAuthority: updateAuthority ? new PublicKey(updateAuthority) : serverKp.publicKey,
      } as any)

      const tmMint = nft.address.toBase58()
      await query('UPDATE collections SET tm_collection_mint = $1, updated_at = NOW() WHERE id = $2', [tmMint, collectionId])
      return NextResponse.json({ ok: true, tmCollectionMint: tmMint })
    }

    // Mirror a Core asset into Token Metadata as a Legacy NFT and verify to the TM collection
    if (action === 'mirrorMint') {
      const { to, name, symbol = '', uri, tmCollectionMint, sellerFeeBasisPoints = 0 } = body || {}
      if (!to || !name || !uri || !tmCollectionMint) {
        return NextResponse.json({ error: 'Missing to, name, uri or tmCollectionMint' }, { status: 400 })
      }
      if (!serverKp) {
        return NextResponse.json({ error: 'Server wallet not configured' }, { status: 500 })
      }

      const mx = Metaplex.make(connection).use(keypairIdentity(serverKp))
      // Create a minimal NFT with same URI and verify to the TM collection
      const { nft, response } = await mx.nfts().create({
        name,
        symbol,
        uri,
        sellerFeeBasisPoints: Number(sellerFeeBasisPoints) || 0,
        tokenOwner: new PublicKey(to),
        // Attach and verify collection in one go
        collection: new PublicKey(tmCollectionMint),
        collectionAuthority: serverKp,
        // Programmable features disabled
        isMutable: true,
        // Keep supply 1 default
      } as any)

      return NextResponse.json({ ok: true, mint: nft.address.toBase58(), signature: response.signature })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    console.error('TM API error:', e)
    return NextResponse.json({ error: 'TM API failed' }, { status: 500 })
  }
}


