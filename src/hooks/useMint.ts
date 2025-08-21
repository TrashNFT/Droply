import { useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import { createCandyMachineService } from '@/lib/solana/candyMachine'
import { Metaplex, walletAdapterIdentity, getMerkleProof, TransactionBuilder } from '@metaplex-foundation/js'
import { getConnection } from '@/lib/solana/umi'
import { createMintService, PLATFORM_WALLET_ADDRESS } from '@/lib/services/mintService'
import { getUmiCore, getUmi } from '@/lib/solana/umi'
import { create as coreCreate } from '@metaplex-foundation/mpl-core'
import { transferSol } from '@metaplex-foundation/mpl-toolbox'
import { generateSigner, publicKey as umiPublicKey, lamports } from '@metaplex-foundation/umi'
import toast from 'react-hot-toast'
import bs58 from 'bs58'

export interface MintResult {
  success: boolean
  nftAddress?: string
  transactionSignature?: string
  error?: string
}

export function useMint() {
  const { connected, publicKey, signTransaction, signAllTransactions, wallet } = useWallet()
  const [minting, setMinting] = useState(false)

  // Best-effort background confirmer for cases where network hiccups prevented confirm
  useEffect(() => {
    const flush = async () => {
      try {
        const raw = localStorage.getItem('pending-mint-confirms')
        const pending: Array<{ reservationId?: string; signature: string; nftAddress?: string; fallback?: { collectionKey: string; wallet: string; quantity: number; price: number; network: 'mainnet-beta' | 'devnet' } }> = raw ? JSON.parse(raw) : []
        if (!Array.isArray(pending) || pending.length === 0) return
        const rest: typeof pending = []
        for (const item of pending) {
          try {
            const res = await fetch('/api/mint', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'confirm', reservationId: item.reservationId, signature: item.signature, nftAddress: item.nftAddress || null })
            })
            if (!res.ok) {
              // Try direct confirm if reservation missing and we have fallback info
              if (item.fallback && item.fallback.collectionKey && item.fallback.wallet) {
                try {
                  const d = await fetch('/api/mint', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'confirm_direct',
                      collectionAddress: item.fallback.collectionKey,
                      wallet: item.fallback.wallet,
                      quantity: item.fallback.quantity,
                      price: item.fallback.price,
                      network: item.fallback.network,
                      signature: item.signature,
                      nftAddress: item.nftAddress || null,
                    })
                  })
                  if (!d.ok) rest.push(item)
                } catch {
                  rest.push(item)
                }
              } else {
                rest.push(item)
              }
            }
          } catch {
            rest.push(item)
          }
        }
        if (rest.length > 0) localStorage.setItem('pending-mint-confirms', JSON.stringify(rest))
        else localStorage.removeItem('pending-mint-confirms')
      } catch {}
    }
    // Flush on mount and when wallet connects
    flush()
  }, [connected])

  const mintNFT = async (params: {
    collectionId?: string
    candyMachineAddress: string
    mintPrice: number
    creatorAddress: string
    quantity?: number
    network?: 'mainnet-beta' | 'devnet'
    standard?: 'core' | 'legacy' | 'cnft'
    metadataUri?: string
    name?: string
    selectedPhaseName?: string
    phases?: Array<{
      name: string
      price: number
      maxPerWallet: number
      startDate?: string | Date
      endDate?: string | Date
      allowlist?: string[]
    }>
  }): Promise<MintResult> => {
    if (!connected || !publicKey) {
      return {
        success: false,
        error: 'Wallet not connected'
      }
    }

    if (!signTransaction || !signAllTransactions) {
      return {
        success: false,
        error: 'Wallet does not support transaction signing'
      }
    }

    setMinting(true)

    try {
      const { candyMachineAddress, mintPrice, creatorAddress, quantity = 1, network = 'mainnet-beta', standard = 'legacy', metadataUri, name, phases = [], selectedPhaseName } = params

      // Ensure a real wallet adapter instance is available
      if (!wallet?.adapter) {
        throw new Error('Wallet adapter not ready')
      }

      // Determine the phase to mint in. If user selected a phase, honor it; otherwise WL prioritized if eligible, else Public if live.
      const now = Date.now()
      const activePhases = phases.filter((p) => {
        const start = p.startDate ? new Date(p.startDate).getTime() : -Infinity
        const end = p.endDate ? new Date(p.endDate).getTime() : Infinity
        return now >= start && now <= end
      })
      const isAllowlisted = (list?: string[]) => {
        if (!list || list.length === 0) return true
        return list.map((a) => a.trim()).includes(publicKey.toString())
      }
      let phaseSelected = selectedPhaseName ? activePhases.find((p) => String(p.name) === String(selectedPhaseName)) || null : null
      if (phaseSelected && Array.isArray(phaseSelected.allowlist) && phaseSelected.allowlist.length > 0 && !isAllowlisted(phaseSelected.allowlist)) {
        throw new Error('Wallet not eligible for selected phase')
      }
      // Fallback: choose an eligible phase if none explicitly selected
      const eligibleWl = activePhases.filter((p) => Array.isArray(p.allowlist) && p.allowlist.length > 0 && isAllowlisted(p.allowlist))
      const eligiblePub = activePhases.filter((p) => !Array.isArray(p.allowlist) || p.allowlist.length === 0)
      const chosenPhase = phaseSelected || eligibleWl[0] || eligiblePub[0] || null
      if (activePhases.length > 0 && !chosenPhase) {
        // There are live phases but user isn't eligible for WL and no Public is live
        throw new Error('Wallet not eligible for the current phase; Public phase not live')
      }
      // If maxSupply is set, backend will enforce remaining supply via reservations; here we only relay phase info.
      const effectivePrice = chosenPhase ? chosenPhase.price : mintPrice

      // Reserve on server to enforce limits and ensure DB tracking, even for Public phase
      let reservationId: string | undefined
      {
        const body: any = {
          action: 'reserve',
          wallet: publicKey.toString(),
          collectionAddress: params.collectionId || candyMachineAddress || metadataUri || name || '',
          quantity,
          price: effectivePrice,
          network,
        }
        if (chosenPhase) body.phase = chosenPhase
        const reserveRes = await fetch('/api/mint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const reserveJson = await reserveRes.json()
        if (!reserveRes.ok || reserveJson?.ok === false) {
          // Map known reasons to clearer messages
          if (reserveJson?.reason === 'limit') {
            throw new Error(`Mint limit reached for this phase. Already: ${reserveJson.already}, remaining: ${reserveJson.allowed}`)
          }
          if (reserveJson?.reason === 'allowlist') {
            const p = reserveJson?.phase ? ` (${reserveJson.phase})` : ''
            throw new Error(`Wallet not on allowlist${p}`)
          }
          if (reserveJson?.reason === 'phase_sold_out') {
            throw new Error('This phase is sold out')
          }
          const extra = reserveJson?.details ? `: ${reserveJson.details}` : ''
          throw new Error((reserveJson?.error || 'Reservation failed') + extra)
        }
        reservationId = reserveJson?.reservationId
        // Use reserved index for unique metadata when available
        const reservedIndex: number | undefined = typeof reserveJson?.reservedIndex === 'number' ? reserveJson.reservedIndex : undefined
        if (reservedIndex != null && Array.isArray(params.phases)) {
          ;(params as any).__reservedIndex = reservedIndex
        }
      }
      const mintService = createMintService((wallet as any), network)
      const costBreakdown = await mintService.calculateTotalCost(effectivePrice, quantity)

      console.log('Minting NFT with real Solana transaction:', {
        candyMachineAddress,
        mintPrice: effectivePrice,
        creatorAddress,
        quantity,
        costBreakdown
      })

      // Build the mint in a single transaction when possible (legacy/CMv3).
      const connection = getConnection(network)
      const metaplex = Metaplex.make(connection).use(walletAdapterIdentity(wallet.adapter))
      const feeInfo = await mintService.getPlatformFeeInfo()
      let responseSig = ''
      let mintedAddress: string | undefined
      if (standard === 'core') {
        // Create Core assets; support multi-quantity by repeating the create instruction
        const mintsToDo = Math.max(1, Number(quantity) || 1)
        // Use Umi with mpl-core plugin enabled
        const umi = getUmiCore(network, wallet.adapter)
        // Start with platform fee transfer for all items
        let builder = transferSol(umi as any, {
          destination: umiPublicKey(PLATFORM_WALLET_ADDRESS.toString()),
          amount: lamports(BigInt(feeInfo.feeLamports * mintsToDo)),
        } as any)
        const firstSigner = generateSigner(umi)
        // First item
        if (!metadataUri) {
          throw new Error('Missing metadata URI for Core mint')
        }
        builder = builder.add(coreCreate(umi, {
          asset: firstSigner,
          name: name || 'Core Asset',
          uri: metadataUri,
          authority: (umi as any).identity,
          payer: (umi as any).payer ?? (umi as any).identity,
        } as any))
        // Additional items (reuse same metadataUri for now)
        for (let i = 1; i < mintsToDo; i++) {
          const signer = generateSigner(umi)
          builder = builder.add(coreCreate(umi, {
            asset: signer,
            name: name || 'Core Asset',
            uri: metadataUri,
            authority: (umi as any).identity,
            payer: (umi as any).payer ?? (umi as any).identity,
          } as any))
        }
        const res = await builder.sendAndConfirm(umi)
        try {
          const sigBytes = (res as any)?.signature as Uint8Array
          responseSig = bs58.encode(sigBytes)
        } catch {
          responseSig = String((res as any)?.signature)
        }
        mintedAddress = (firstSigner.publicKey as any).toString()
      } else if (standard === 'legacy') {
        const cm = await metaplex.candyMachines().findByAddress({ address: new PublicKey(candyMachineAddress) })
        // Use phase name as Candy Guard group label when present
        const groupLabel = chosenPhase?.name ? String(chosenPhase.name).slice(0, 32) : undefined

        // Build a single transaction: platform fee + (optional) allowlist route + mint
        const builderParts: TransactionBuilder[] = []

        // Optional allowlist route
        if (chosenPhase?.allowlist && chosenPhase.allowlist.length > 0) {
          try {
            const normalized = chosenPhase.allowlist.map((a) => a.trim())
            const merkleProof = getMerkleProof(normalized, publicKey.toBase58())
            const routeBuilder = await (metaplex.candyMachines() as any).builders().callGuardRoute({
              candyMachine: cm as any,
              guard: 'allowList' as any,
              settings: { path: 'proof', merkleProof } as any,
              ...(groupLabel ? { group: groupLabel as any } : {}),
            })
            builderParts.push(routeBuilder)
          } catch (e) {
            throw new Error('Wallet is not on the allowlist for this phase')
          }
        }

        // Mint builders (repeat for quantity)
        const mintsToDo = Math.max(1, Number(quantity) || 1)
        for (let i = 0; i < mintsToDo; i++) {
          const mintBuilder = await (metaplex.candyMachines() as any).builders().mint({
            candyMachine: cm as any,
            // Do not override collectionUpdateAuthority; the Candy Machine authority/record will verify collection
            ...(groupLabel ? { group: groupLabel as any } : {}),
          })
          builderParts.push(mintBuilder)
        }

        // Combine builders and prepend platform fee transfer
        const combined = (TransactionBuilder as any).make()
        builderParts.forEach((b) => combined.add(b))
        combined.prepend({
          instruction: SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: PLATFORM_WALLET_ADDRESS,
            lamports: feeInfo.feeLamports * Math.max(1, Number(quantity) || 1),
          }),
          signers: [],
          key: 'platformFee',
        })
        const res = await combined.sendAndConfirm(metaplex)
        try {
          const sigBytes = (res as any)?.signature as Uint8Array
          responseSig = bs58.encode(sigBytes)
        } catch {
          responseSig = String((res as any)?.signature)
        }
        // Minted NFT address is not trivial to extract from logs here
      } else if (standard === 'cnft') {
        // For cNFT, keep platform-fee as a separate transfer for now since the mint is performed server-side.
        // Execute fee transfer first to avoid failing after server mint.
        if (!metadataUri) {
          throw new Error('Missing metadata URI for cNFT mint')
        }
        const feeTx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: PLATFORM_WALLET_ADDRESS,
            lamports: feeInfo.feeLamports * Math.max(1, Number(quantity) || 1),
          })
        )
        const feeSig = await wallet.adapter.sendTransaction(feeTx, connection, { preflightCommitment: 'confirmed' })
        await connection.confirmTransaction(feeSig, 'confirmed')
        // For cNFT, call API to mint compressed NFT via server signer
        const cnftRes = await fetch('/api/cnft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'mint',
            network,
            treeAddress: (params as any)?.merkleTreeAddress,
            to: publicKey.toString(),
            name: name || 'Compressed NFT',
            uri: metadataUri,
            sellerFeeBasisPoints:  (params as any)?.sellerFeeBasisPoints ?? 0,
            symbol: (params as any)?.symbol || '',
          })
        })
        const cnftJson = await cnftRes.json()
        if (!cnftRes.ok) throw new Error(cnftJson?.error || 'cNFT mint failed')
        try {
          // Some backends may return signature as bytes; normalize to base58 string when possible
          responseSig = typeof cnftJson.signature === 'string' ? cnftJson.signature : bs58.encode(cnftJson.signature)
        } catch {
          responseSig = String(cnftJson.signature)
        }
        mintedAddress = cnftJson.assetId
      }

      console.log('Mint successful. Signature:', responseSig)

      // Confirm reservation for analytics if exists
        if (reservationId && responseSig) {
          // Retry confirm a few times; persist to localStorage if it still fails
          const payload = { action: 'confirm', reservationId, signature: responseSig, nftAddress: mintedAddress }
          let ok = false
          for (let i = 0; i < 3 && !ok; i++) {
            try {
              const res = await fetch('/api/mint', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
              ok = res.ok
              if (!ok) await new Promise(r => setTimeout(r, 500 * (i + 1)))
            } catch {
              await new Promise(r => setTimeout(r, 500 * (i + 1)))
            }
          }
          if (!ok) {
            try {
              const raw = localStorage.getItem('pending-mint-confirms')
              const arr = raw ? JSON.parse(raw) : []
              arr.push({ reservationId, signature: responseSig, nftAddress: mintedAddress, fallback: { collectionKey: params.collectionId || candyMachineAddress || metadataUri || name || '', wallet: publicKey.toString(), quantity, price: effectivePrice, network, phaseName: chosenPhase?.name } })
              localStorage.setItem('pending-mint-confirms', JSON.stringify(arr))
            } catch {}

            // Also attempt a direct confirm immediately as a fallback path
            try {
              await fetch('/api/mint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'confirm_direct',
                  collectionAddress: params.collectionId || candyMachineAddress || metadataUri || name || '',
                  wallet: publicKey.toString(),
                  quantity,
                  price: effectivePrice,
                  network,
                  signature: responseSig,
                  nftAddress: mintedAddress,
                  phaseName: chosenPhase?.name,
                })
              })
            } catch {}
          }
        }

        // If reservation was not created for some reason, attempt direct confirm insert
        if (!reservationId && responseSig) {
          try {
            await fetch('/api/mint', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'confirm_direct',
                collectionAddress: params.collectionId || candyMachineAddress || metadataUri || name || '',
                wallet: publicKey.toString(),
                quantity,
                price: effectivePrice,
                network,
                signature: responseSig,
                nftAddress: mintedAddress,
              })
            })
          } catch {}
        }

      return {
        success: true,
        nftAddress: mintedAddress,
        transactionSignature: responseSig,
      }

    } catch (error) {
      console.error('Mint error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown mint error'
      }
    } finally {
      setMinting(false)
    }
  }

  const calculateMintCost = async (mintPrice: number, quantity: number = 1, network: 'mainnet-beta' | 'devnet' = 'mainnet-beta') => {
    if (!connected || !publicKey) {
      throw new Error('Wallet not connected')
    }

    const walletAdapter = {
      adapter: {
        publicKey,
        signTransaction: () => Promise.reject(new Error('Not needed for cost calculation')),
        signAllTransactions: () => Promise.reject(new Error('Not needed for cost calculation')),
      }
    }

    const mintService = createMintService(walletAdapter as any, network)
    return await mintService.calculateTotalCost(mintPrice, quantity)
  }

  return {
    mintNFT,
    calculateMintCost,
    minting,
    connected,
    publicKey: publicKey?.toString(),
  }
}
