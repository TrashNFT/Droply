import { NextRequest, NextResponse } from 'next/server'
import { getConnection } from '@/lib/solana/umi'
import { Metaplex, keypairIdentity } from '@metaplex-foundation/js'
import { Keypair, PublicKey } from '@solana/web3.js'
import { uploadMetadata } from '@/lib/arweave/client'

const SECRET = process.env.AIRDROP_WALLET_SECRET || ''

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body || {}
    if (!action) return NextResponse.json({ error: 'Missing action' }, { status: 400 })

    const { network = 'mainnet-beta' } = body
    const connection = getConnection('mainnet-beta')
    const kp = SECRET ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(SECRET))) : null
    const metaplex = kp ? Metaplex.make(connection).use(keypairIdentity(kp)) : null

    if (action === 'burn') {
      if (!metaplex) return NextResponse.json({ error: 'Server wallet not configured' }, { status: 500 })
      const { mintAddress } = body
      if (!mintAddress) return NextResponse.json({ error: 'Missing mintAddress' }, { status: 400 })
      const { response } = await metaplex.nfts().delete({ mintAddress: new PublicKey(mintAddress) } as any)
      return NextResponse.json({ ok: true, signature: response.signature })
    }

    if (action === 'updateMetadata') {
      if (!metaplex) return NextResponse.json({ error: 'Server wallet not configured' }, { status: 500 })
      const { mintAddress, newUri } = body
      if (!mintAddress || !newUri) return NextResponse.json({ error: 'Missing mintAddress or newUri' }, { status: 400 })
      const nft = await metaplex.nfts().findByMint({ mintAddress: new PublicKey(mintAddress) } as any)
      const { response } = await metaplex.nfts().update({ nft: nft as any, uri: String(newUri) } as any)
      return NextResponse.json({ ok: true, signature: response.signature })
    }

    if (action === 'multisend') {
      if (!metaplex) return NextResponse.json({ error: 'Server wallet not configured' }, { status: 500 })
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

    if (action === 'rebuildMetadataWithCollection') {
      const { uris = [], baseUri, start, end, suffix = '.json', collectionAddress } = body
      if ((!Array.isArray(uris) || uris.length === 0) && (typeof baseUri !== 'string' || baseUri.length === 0)) {
        return NextResponse.json({ error: 'Missing uris or baseUri' }, { status: 400 })
      }
      if (!collectionAddress) {
        return NextResponse.json({ error: 'Missing collectionAddress' }, { status: 400 })
      }

      const resolveUri = (u: string) => {
        const s = String(u).trim()
        if (s.startsWith('ar://')) return `https://arweave.net/${s.slice('ar://'.length)}`
        if (s.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${s.slice('ipfs://'.length)}`
        return s
      }

      let list: string[] = []
      if (Array.isArray(uris) && uris.length > 0) {
        list = uris
      } else {
        const from = Number.isFinite(Number(start)) ? Number(start) : 0
        const to = Number.isFinite(Number(end)) ? Number(end) : from
        if (to < from || to - from > 10000) {
          return NextResponse.json({ error: 'Invalid range' }, { status: 400 })
        }
        const normalizedBase = String(baseUri).endsWith('/') ? String(baseUri) : `${String(baseUri)}/`
        list = Array.from({ length: to - from + 1 }, (_, i) => `${normalizedBase}${from + i}${suffix}`)
      }

      const results: Record<string, string> = {}
      const errors: Record<string, string> = {}

      // Process in small concurrent batches to avoid serverless timeouts
      const concurrency = 5
      let index = 0

      const worker = async () => {
        while (index < list.length) {
          const current = index++
          const srcUri = list[current]
          try {
            const httpUri = resolveUri(srcUri)
            const resp = await fetch(httpUri, { cache: 'no-store' })
            if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`)
            const json = await resp.json()
            const next = {
              ...json,
              collection: {
                ...(json?.collection ?? {}),
                key: String(collectionAddress),
              },
            }
            const uploaded = await uploadMetadata(next, {
              'Content-Type': 'application/json',
              'App-Name': 'Solana-NFT-Launchpad',
              'Action': 'rebuild-with-collection',
            })
            results[srcUri] = uploaded.url
          } catch (e: any) {
            errors[srcUri] = e?.message || 'Unknown error'
          }
        }
      }

      await Promise.all(new Array(concurrency).fill(0).map(() => worker()))

      return NextResponse.json({ ok: true, results, errors, total: list.length, succeeded: Object.keys(results).length, failed: Object.keys(errors).length })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Utils API error:', error)
    return NextResponse.json({ error: 'Utils API failed' }, { status: 500 })
  }
}





