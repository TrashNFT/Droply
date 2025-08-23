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
      const { uris = [], baseUri, start, end, suffix = '.json', collectionAddress, concurrency: userConcurrency, skipIfPresent = true, preferGateway = 'cloudflare', returnGateway = 'irys' } = body
      if ((!Array.isArray(uris) || uris.length === 0) && (typeof baseUri !== 'string' || baseUri.length === 0)) {
        return NextResponse.json({ error: 'Missing uris or baseUri' }, { status: 400 })
      }
      if (!collectionAddress) {
        return NextResponse.json({ error: 'Missing collectionAddress' }, { status: 400 })
      }

      const resolveUri = (u: string) => {
        const s = String(u).trim()
        if (s.startsWith('ar://')) return `https://arweave.net/${s.slice('ar://'.length)}`
        if (s.startsWith('ipfs://')) {
          const rest = s.slice('ipfs://'.length)
          const [cid, ...path] = rest.split('/')
          const suffixPath = path.length ? `/${path.join('/')}` : ''
          if (preferGateway === 'w3s') return `https://${cid}.ipfs.w3s.link${suffixPath}`
          if (preferGateway === 'ipfs') return `https://ipfs.io/ipfs/${cid}${suffixPath}`
          return `https://cloudflare-ipfs.com/ipfs/${cid}${suffixPath}`
        }
        return s
      }

      const warmArweaveGateways = async (txId: string) => {
        const urls = [
          `https://arweave.net/${txId}`,
          `https://gateway.irys.xyz/${txId}`,
          `https://ar-io.net/${txId}`,
        ]
        await Promise.all(urls.map(async (url) => {
          try { await fetch(url, { method: 'HEAD', cache: 'no-store' }) } catch {}
          try { await fetch(url, { method: 'GET', cache: 'no-store' }) } catch {}
        }))
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
      const concurrency = Math.max(1, Math.min(Number(userConcurrency ?? 12), 32))
      let index = 0

      const worker = async () => {
        while (index < list.length) {
          const current = index++
          const srcUri = list[current]
          try {
            const httpUri = resolveUri(srcUri)
            // Robust fetch with small retries for flaky gateways
            let resp: Response | null = null
            let lastErr: any
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                resp = await fetch(httpUri, { cache: 'no-store' })
                if (resp.ok) break
              } catch (e) { lastErr = e }
              await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
            }
            if (!resp || !resp.ok) throw new Error(`Fetch failed`)            
            if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`)
            const json = await resp.json()
            if (skipIfPresent && json?.collection?.key && String(json.collection.key) === String(collectionAddress)) {
              // Already has the right key; no re-upload needed
              results[srcUri] = httpUri
              continue
            }
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
            if (uploaded?.transactionId) {
              await warmArweaveGateways(uploaded.transactionId)
            }
            const outUrl = returnGateway === 'irys' && uploaded?.transactionId
              ? `https://gateway.irys.xyz/${uploaded.transactionId}`
              : uploaded.url
            results[srcUri] = outUrl
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





