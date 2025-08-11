import { WebBundlr } from '@bundlr-network/client'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import BigNumber from 'bignumber.js'
import { Buffer } from 'buffer'

export type SupportedNetwork = 'mainnet-beta' | 'devnet'

const getBundlrUrl = (network: SupportedNetwork) =>
  network === 'devnet' ? 'https://devnet.bundlr.network' : 'https://node1.bundlr.network'

export const createBundlr = async (walletAdapter: any, network: SupportedNetwork, rpcUrl: string) => {
  const bundlr = new WebBundlr(getBundlrUrl(network), 'solana', walletAdapter, { providerUrl: rpcUrl })
  await bundlr.ready()
  return bundlr
}

// Poll the Arweave gateway until the content is available (HTTP 200)
const waitForAvailability = async (url: string, timeoutMs = 120_000, intervalMs = 2_000) => {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'HEAD', cache: 'no-store' })
      if (res.ok) return
    } catch {
      // ignore network errors and retry
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  // Final attempt to trigger caching on some gateways
  try { await fetch(url, { method: 'GET', cache: 'no-store' }) } catch {}
}

const fundIfNeeded = async (bundlr: any, bytes: number, safetyMultiplier = 1.5) => {
  const price = await bundlr.getPrice(bytes)
  const balance = await bundlr.getLoadedBalance()
  if (balance.isLessThan(price)) {
    const toFund = new BigNumber(price.multipliedBy(safetyMultiplier).minus(balance).toString()).integerValue(BigNumber.ROUND_CEIL)
    if (toFund.isGreaterThan(0)) {
      await bundlr.fund(toFund)
    }
  }
}

// Pre-fund once for a total bytes amount with a safety multiplier (default 20%).
export const fundForTotalBytes = async (
  bundlr: any,
  totalBytes: number,
  safetyMultiplier = 1.2,
  opts?: { maxSolCap?: number }
) => {
  const price = await bundlr.getPrice(totalBytes)
  const amount = new BigNumber(price.multipliedBy(safetyMultiplier).toString()).integerValue(BigNumber.ROUND_CEIL)
  const balance = await bundlr.getLoadedBalance()
  let toFund = amount.minus(balance)
  // Optional cap to avoid large upfront funding
  const maxSolCap = opts?.maxSolCap ?? Number(process.env.NEXT_PUBLIC_BUNDLR_PREFUND_SOL_CAP ?? 0)
  if (maxSolCap > 0) {
    const capLamports = new BigNumber(Math.floor(maxSolCap * LAMPORTS_PER_SOL))
    if (toFund.isGreaterThan(capLamports)) {
      toFund = capLamports
    }
  }
  if (toFund.isGreaterThan(0)) {
    await bundlr.fund(toFund)
  }
}

export const uploadFileToBundlr = async (bundlr: any, file: File): Promise<string> => {
  const data = Buffer.from(await file.arrayBuffer())
  await fundIfNeeded(bundlr, data.byteLength)
  let tx
  try {
    tx = await bundlr.upload(data, {
      tags: [{ name: 'Content-Type', value: file.type || 'application/octet-stream' }],
    })
  } catch (e: any) {
    if (String(e?.message || '').toLowerCase().includes('not enough funds')) {
      // Top up and retry once with a generous margin
      await fundIfNeeded(bundlr, data.byteLength, 2.0)
      tx = await bundlr.upload(data, {
        tags: [{ name: 'Content-Type', value: file.type || 'application/octet-stream' }],
      })
    } else {
      throw e
    }
  }
  const url = `https://arweave.net/${tx.id}`
  await waitForAvailability(url)
  return url
}

export const uploadJsonToBundlr = async (bundlr: any, json: any): Promise<string> => {
  const data = Buffer.from(JSON.stringify(json))
  await fundIfNeeded(bundlr, data.byteLength)
  let tx
  try {
    tx = await bundlr.upload(data, {
      tags: [{ name: 'Content-Type', value: 'application/json' }],
    })
  } catch (e: any) {
    if (String(e?.message || '').toLowerCase().includes('not enough funds')) {
      await fundIfNeeded(bundlr, data.byteLength, 2.0)
      tx = await bundlr.upload(data, {
        tags: [{ name: 'Content-Type', value: 'application/json' }],
      })
    } else {
      throw e
    }
  }
  const url = `https://arweave.net/${tx.id}`
  await waitForAvailability(url)
  return url
}

// Upload many files concurrently with a controlled pool.
export const uploadManyFiles = async (
  bundlr: any,
  files: File[],
  opts: { concurrency?: number; onProgress?: (done: number, total: number) => void } = {}
): Promise<string[]> => {
  const concurrency = Math.max(1, opts.concurrency ?? 8)
  const urls: string[] = new Array(files.length)
  let next = 0
  let done = 0
  const worker = async () => {
    while (true) {
      const i = next++
      if (i >= files.length) return
      const file = files[i]
      const data = Buffer.from(await file.arrayBuffer())
      await fundIfNeeded(bundlr, data.byteLength)
      let tx
      try {
        tx = await bundlr.upload(data, {
          tags: [{ name: 'Content-Type', value: file.type || 'application/octet-stream' }],
        })
      } catch (e: any) {
        if (String(e?.message || '').toLowerCase().includes('not enough funds')) {
          await fundIfNeeded(bundlr, data.byteLength, 2.0)
          tx = await bundlr.upload(data, {
            tags: [{ name: 'Content-Type', value: file.type || 'application/octet-stream' }],
          })
        } else {
          throw e
        }
      }
      const url = `https://arweave.net/${tx.id}`
      await waitForAvailability(url)
      urls[i] = url
      done++
      opts.onProgress?.(done, files.length)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  return urls
}

export const uploadManyJson = async (
  bundlr: any,
  payloads: any[],
  opts: { concurrency?: number; onProgress?: (done: number, total: number) => void } = {}
): Promise<string[]> => {
  const concurrency = Math.max(1, opts.concurrency ?? 8)
  const urls: string[] = new Array(payloads.length)
  let next = 0
  let done = 0
  const worker = async () => {
    while (true) {
      const i = next++
      if (i >= payloads.length) return
      const data = Buffer.from(JSON.stringify(payloads[i]))
      await fundIfNeeded(bundlr, data.byteLength)
      const tx = await bundlr.upload(data, {
        tags: [{ name: 'Content-Type', value: 'application/json' }],
      })
      const url = `https://arweave.net/${tx.id}`
      await waitForAvailability(url)
      urls[i] = url
      done++
      opts.onProgress?.(done, payloads.length)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  return urls
}

// Lightweight local cache of content hashes to Arweave URLs to skip re-uploads.
const CACHE_PREFIX = 'bundlr-url-cache:'
export const getCachedUrl = (hash: string): string | null => {
  try { return localStorage.getItem(CACHE_PREFIX + hash) } catch { return null }
}
export const setCachedUrl = (hash: string, url: string) => {
  try { localStorage.setItem(CACHE_PREFIX + hash, url) } catch {}
}

export const sha256Hex = async (data: ArrayBuffer): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(digest)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}
export const hashFile = async (file: File): Promise<string> => {
  const buf = await file.arrayBuffer()
  return sha256Hex(buf)
}


