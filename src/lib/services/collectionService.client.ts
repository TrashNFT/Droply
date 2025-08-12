import { PublicKey } from '@solana/web3.js'
import { createMetaplexClient, toMxFileFromBrowserFile } from '@/lib/solana/metaplexClient'
import { getUmiCore } from '@/lib/solana/umi'
import { create as coreCreateCollection, createCollection } from '@metaplex-foundation/mpl-core'
import { publicKey, generateSigner } from '@metaplex-foundation/umi'
import { createBundlr, uploadFileToBundlr, uploadJsonToBundlr, fundForTotalBytes, uploadManyFiles, uploadManyJson, hashFile, getCachedUrl, setCachedUrl } from '@/lib/storage/bundlrClient'
import type { UploadedAsset, CreateCollectionFormData, NFTMetadata } from '@/types'
import { toBigNumber, sol, getMerkleRoot } from '@metaplex-foundation/js'

export interface RealDeploymentResult {
  success: boolean
  collectionMint: string
  candyMachineAddress: string
  mintPageUrl: string
  itemUris?: string[]
  collectionImageUri?: string
  error?: string
}

export const deployCollectionClient = async (
  walletAdapter: any,
  formData: CreateCollectionFormData,
  assets: UploadedAsset[],
  network: 'mainnet-beta' | 'devnet' = 'devnet',
  onProgress?: (stage: string, progress: number) => void
): Promise<RealDeploymentResult> => {
  try {
    if (!walletAdapter?.publicKey) {
      throw new Error('Wallet not connected')
    }

    const metaplex = createMetaplexClient(walletAdapter, network)
    // getUmiCore is pinned to mainnet-only typings; always pass 'mainnet-beta'
    const umi = getUmiCore('mainnet-beta', walletAdapter)
    onProgress?.('Uploading assets to Bundlr', 10)

    // Use Bundlr client directly to avoid storage confirm timeouts
    const rpcUrl = network === 'devnet'
      ? process.env.NEXT_PUBLIC_SOLANA_RPC_URL_DEV || 'https://api.devnet.solana.com'
      : process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
    const bundlr = await createBundlr(walletAdapter, network, rpcUrl)

    const uploadFileWithRetry = async (file: File, attempts = 3): Promise<string> => {
      let lastError: any
      for (let i = 0; i < attempts; i++) {
        try {
          return await uploadFileToBundlr(bundlr, file)
        } catch (err) {
          lastError = err
          await new Promise(res => setTimeout(res, 1000 * (i + 1)))
        }
      }
      throw lastError
    }

    const uploadJsonWithRetry = async (json: any, attempts = 3): Promise<string> => {
      let lastError: any
      for (let i = 0; i < attempts; i++) {
        try {
          return await uploadJsonToBundlr(bundlr, json)
        } catch (err) {
          lastError = err
          await new Promise(res => setTimeout(res, 1000 * (i + 1)))
        }
      }
      throw lastError
    }

    // If pre-provided URIs exist, skip uploads entirely
    let collectionImageUri: string = ''
    let itemUris: string[] = []
    if (formData.itemUris && formData.itemUris.length > 0) {
      onProgress?.('Using provided metadata URIs', 50)
      itemUris = formData.itemUris
      // Try to extract a collection image from first metadata
      try {
        const res = await fetch(itemUris[0])
        const meta = await res.json()
        collectionImageUri = meta?.image || ''
      } catch {}
    } else {
      // Pre-fund once and upload concurrently
    const files = assets.map(a => a.file as File)
    const fileSizes = await Promise.all(files.map(async f => (await f.arrayBuffer()).byteLength))
    const estJsonSizes = files.map(() => 800)
    const totalBytes = fileSizes.reduce((a, b) => a + b, 0) + estJsonSizes.reduce((a, b) => a + b, 0)
    await fundForTotalBytes(bundlr, totalBytes, 1.2)

      // Upload collection image
      const firstFile = assets[0]?.file as File
      if (!firstFile) throw new Error('At least one asset file is required')
      const [collectionImageUriLocal] = await uploadManyFiles(bundlr, [firstFile], { concurrency: 1 })
      collectionImageUri = collectionImageUriLocal

      // Upload item images concurrently
      onProgress?.('Uploading images', 30)
      // Skip re-uploading identical files if cached
      const preHashes = await Promise.all(files.map(f => hashFile(f)))
      let imageUris = await uploadManyFiles(bundlr, files, {
        concurrency: 8,
        onProgress: (done, total) => onProgress?.('Uploading images', 30 + Math.floor((done / total) * 20)),
      })
      // Cache results by hash
      preHashes.forEach((h, i) => setCachedUrl(h, imageUris[i]))

      // Build metadata payloads and upload concurrently
      onProgress?.('Uploading metadata', 55)
      let metadataPayloads = assets.map((asset, i) => {
        const file = asset.file as File
        const provided = (asset as any)?.metadata
        const itemImageUri = imageUris[i]
        return provided && typeof provided === 'object' ? {
          ...provided,
          image: provided.image || itemImageUri,
        } : {
          name: `${formData.name} #${i + 1}`,
          symbol: formData.symbol,
          description: formData.description,
          image: itemImageUri,
          attributes: [
            { trait_type: 'Collection', value: formData.name },
            { trait_type: 'Edition', value: `${i + 1}` },
          ],
          properties: {
            files: [{ uri: itemImageUri, type: file.type }],
            category: 'image',
          },
        }
      })
      // Optionally shuffle items to randomize mint order
      if ((formData as any)?.shuffleItems) {
        const paired = imageUris.map((uri, i) => ({ uri, meta: metadataPayloads[i] }))
        for (let i = paired.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[paired[i], paired[j]] = [paired[j], paired[i]]
        }
        imageUris = paired.map(p => p.uri)
        // reorder metadata payloads accordingly
        // @ts-ignore
        metadataPayloads = paired.map(p => p.meta)
      }

      itemUris = await uploadManyJson(bundlr, metadataPayloads, {
        concurrency: 8,
        onProgress: (done, total) => onProgress?.('Uploading metadata', 55 + Math.floor((done / total) * 20)),
      })
    }

    let candyMachineAddress = ''
    let collectionMintAddress = ''
    let mintPageUrl = ''

    // Branch by standard
    if (formData.standard === 'core') {
      onProgress?.('Creating Core collection', 55)
      // Ensure required signers are provided as Signer objects, not just public keys
      const metadataUri = await uploadJsonWithRetry({
        name: formData.name,
        symbol: formData.symbol,
        description: formData.description,
        image: collectionImageUri,
      })

      // The Core program requires the new `collection` account to be a signer.
      // Generate it client-side and include it in the instruction.
      const collectionSigner = generateSigner(umi)

      try {
        await (createCollection as any)(umi, {
          collection: collectionSigner,
          name: formData.name,
          uri: metadataUri,
          // Required signers
          updateAuthority: (umi as any).identity,
          payer: (umi as any).payer ?? (umi as any).identity,
          authority: (umi as any).identity,
        } as any).sendAndConfirm(umi)
      } catch (err: any) {
        // Surface on-chain logs to the console to debug simulation failures
        if (typeof err?.getLogs === 'function') {
          try {
            const logs = await err.getLogs()
            // eslint-disable-next-line no-console
            console.error('Core createCollection logs:', logs)
          } catch {}
        }
        throw err
      }

      // Use the created collection address
      collectionMintAddress = (collectionSigner.publicKey as any).toString()
      mintPageUrl = `/mint/${collectionMintAddress}`
    } else if (formData.standard === 'cnft') {
      // cNFT scaffolding: upload items only, no CMv3; save itemUris for client mint
      onProgress?.('Preparing cNFT configuration', 65)
      collectionMintAddress = walletAdapter.publicKey.toString()
      candyMachineAddress = ''
      mintPageUrl = `/mint/${collectionMintAddress}`
    } else {
      // Legacy (Candy Machine v3)
      onProgress?.('Creating collection NFT', 55)
      const collectionMetadataUri = await uploadJsonWithRetry({
        name: formData.name,
        symbol: formData.symbol,
        description: formData.description,
        image: collectionImageUri,
      })
      const creatorPk = new PublicKey(walletAdapter.publicKey.toString())
      const { nft: collectionNft } = await metaplex.nfts().create({
        name: formData.name,
        symbol: formData.symbol,
        uri: collectionMetadataUri,
        sellerFeeBasisPoints: formData.sellerFeeBasisPoints ?? 500,
        isCollection: true,
        creators: (Array.isArray((formData as any)?.creators) && (formData as any).creators.length > 0)
          ? (formData as any).creators.map((c: any) => ({ address: new PublicKey(c.address), share: Number(c.share) || 0 }))
          : [ { address: creatorPk, share: 100 } ],
      })

      onProgress?.('Creating Candy Machine', 70)
      // Prepare on-chain guard configuration
      const baseGuards: any = {}
      if ((formData.price ?? 0) > 0) {
        baseGuards.solPayment = { amount: sol(formData.price), destination: metaplex.identity().publicKey }
      }
      if (formData.startDate) {
        baseGuards.startDate = { date: new Date(formData.startDate) as any }
      }
      if (formData.endDate) {
        // End date guard limits mint window
        baseGuards.endDate = { date: new Date(formData.endDate) as any }
      }

      // Map UI phases to Candy Guard groups (label + per-phase guards)
      const guardGroups = Array.isArray(formData.phases) && formData.phases.length > 0
        ? formData.phases.map((phase, idx) => {
            const phaseGuards: any = {}
            // Per-phase price overrides
            if (typeof phase.price === 'number' && phase.price >= 0) {
              phaseGuards.solPayment = { amount: sol(phase.price), destination: metaplex.identity().publicKey }
            }
            // Per-phase window
            if (phase.startDate) {
              phaseGuards.startDate = { date: new Date(phase.startDate) as any }
            }
            if (phase.endDate) {
              phaseGuards.endDate = { date: new Date(phase.endDate) as any }
            }
            // Per-wallet mint limit
            if (typeof phase.maxPerWallet === 'number' && phase.maxPerWallet > 0) {
              phaseGuards.mintLimit = { id: (idx + 1), limit: phase.maxPerWallet }
            }
            // Allowlist via Merkle root if addresses are provided client-side
            if (Array.isArray(phase.allowlist) && phase.allowlist.length > 0) {
              try {
                const root = getMerkleRoot(phase.allowlist.map((a) => a.trim()))
                phaseGuards.allowList = { merkleRoot: root }
              } catch (e) {
                console.warn('Failed to compute merkle root for phase allowlist; skipping allowList guard', e)
              }
            }
          // Optional freeze: charge SOL and freeze mints until thawed
          if ((phase as any)?.freezeSolPaymentLamports && (phase as any)?.freezeUntil) {
            phaseGuards.freezeSolPayment = {
              lamports: BigInt(Math.floor((phase as any).freezeSolPaymentLamports)),
              destination: metaplex.identity().publicKey,
              // Freeze time in seconds from epoch
              // @ts-ignore
              start: BigInt(Math.floor(Date.now() / 1000)),
              period: BigInt(Math.max(1, Math.floor(((new Date((phase as any).freezeUntil)).getTime() - Date.now()) / 1000))),
            }
          }
            return { label: String(phase.name || '').slice(0, 32), guards: phaseGuards }
          })
        : undefined

      const { candyMachine } = await metaplex.candyMachines().create({
        itemsAvailable: toBigNumber(assets.length),
        sellerFeeBasisPoints: formData.sellerFeeBasisPoints ?? 500,
        collection: { address: collectionNft.address, updateAuthority: metaplex.identity() },
        guards: baseGuards,
        ...(guardGroups && { groups: guardGroups }),
      })

      await metaplex.candyMachines().insertItems({
        candyMachine,
        items: itemUris.map((uri, i) => ({ name: `${formData.name} #${i + 1}`.slice(0, 32), uri })),
      })

      candyMachineAddress = candyMachine.address.toBase58()
      collectionMintAddress = collectionNft.address.toBase58()
      mintPageUrl = `/mint/${collectionMintAddress}`
    }

    onProgress?.('Done', 100)
    return {
      success: true,
      collectionMint: collectionMintAddress,
      candyMachineAddress: candyMachineAddress,
      mintPageUrl,
      itemUris,
      collectionImageUri,
    }
  } catch (error) {
    return {
      success: false,
      collectionMint: '',
      candyMachineAddress: '',
      mintPageUrl: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}


