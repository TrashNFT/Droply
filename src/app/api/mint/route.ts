import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// Single POST handler that supports sub-actions via body.action.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body || {}

    if (action === 'check') {
      const { wallet, collectionAddress, quantity = 1, phase } = body || {}
      if (!wallet || !collectionAddress) {
        return NextResponse.json({ error: 'Missing wallet or collectionAddress' }, { status: 400 })
      }
      // Resolve collection
      const col = await query(
        `SELECT id, phases FROM collections 
         WHERE collection_address = $1 OR candy_machine_address = $1 OR id::text = $1 
         LIMIT 1`,
        [collectionAddress]
      )
      if (!col.rows.length) return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
      const collectionId = col.rows[0].id
      // Parse phases
      let serverPhases: any[] = []
      try {
        const p = col.rows[0].phases
        serverPhases = Array.isArray(p) ? p : (p ? JSON.parse(p) : [])
      } catch {}
      const nowTs = Date.now()
      const resolveActive = (phs: any[]) => phs.find((x: any) => {
        const s = x?.startDate ? new Date(x.startDate).getTime() : -Infinity
        const e = x?.endDate ? new Date(x.endDate).getTime() : Infinity
        return nowTs >= s && nowTs <= e
      })
      const phaseByName = (n?: string) => serverPhases.find((x: any) => x?.name === n)
      let active = phase?.name ? phaseByName(phase.name) : resolveActive(serverPhases)
      if (phase?.name && !active) active = resolveActive(serverPhases)

      // No live phase when phases exist -> block
      if (serverPhases.length > 0 && !active) {
        return NextResponse.json({ ok: false, reason: 'no_live_phase', allowed: 0, already: 0, phase: null })
      }

      // Allowlist check
      if (active) {
        let listed = true
        if (Array.isArray(active.allowlist)) {
          if (active.allowlist.length > 0) {
            listed = active.allowlist.map((a: string) => a.trim()).includes(String(wallet))
          } else {
            listed = true
          }
        } else {
          try {
            const wl = await query<{ exists: boolean }>(
              `SELECT EXISTS(
                 SELECT 1 FROM phase_allowlist
                 WHERE collection_id = $1 AND phase_name = $2 AND wallet_address = $3
               ) as exists`,
              [collectionId, active.name || '', String(wallet)]
            )
            listed = Boolean(wl.rows[0]?.exists)
          } catch { listed = true }
        }
        if (!listed) {
          return NextResponse.json({ ok: false, reason: 'allowlist', allowed: 0, already: 0, phase: active?.name || null })
        }
      }

      // Per-phase wallet mint count
      let already = 0
      try {
        const countRes = await query<{ sum: string }>(
          `SELECT COALESCE(SUM(quantity), 0) as sum
           FROM mint_transactions
           WHERE collection_id = $1 AND minter_address = $2 AND status = 'confirmed' AND phase_name = $3`,
          [collectionId, wallet, active?.name || null]
        )
        already = Number(countRes.rows[0]?.sum || 0)
      } catch {
        // Legacy schema without phase_name
        const countRes = await query<{ sum: string }>(
          `SELECT COALESCE(SUM(quantity), 0) as sum
           FROM mint_transactions
           WHERE collection_id = $1 AND minter_address = $2 AND status = 'confirmed'`,
          [collectionId, wallet]
        )
        already = Number(countRes.rows[0]?.sum || 0)
      }
      const maxPerWallet = Number(active?.maxPerWallet || 0)
      const allowed = maxPerWallet > 0 ? Math.max(0, maxPerWallet - already) : Infinity
      if (maxPerWallet > 0 && already >= maxPerWallet) {
        return NextResponse.json({ ok: false, reason: 'limit', already, allowed: 0, phase: active?.name || null })
      }
      if (maxPerWallet > 0 && Number(quantity) > allowed) {
        return NextResponse.json({ ok: true, reason: null, already, allowed, phase: active?.name || null })
      }
      return NextResponse.json({ ok: true, reason: null, already, allowed, phase: active?.name || null })
    }

    if (action === 'reserve') {
      const { wallet, collectionAddress, quantity = 1, phase, price = 0, network = 'mainnet-beta' } = body
      if (!wallet || !collectionAddress) {
        return NextResponse.json({ error: 'Missing wallet or collectionAddress' }, { status: 400 })
      }

      // Look up collection by on-chain address; be flexible and also accept candy machine address or id
      const col = await query(
        `SELECT id, phases FROM collections 
         WHERE collection_address = $1 OR candy_machine_address = $1 OR id::text = $1 
         LIMIT 1`,
        [collectionAddress]
      )
      if (!col.rows.length) {
        return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
      }
      const collectionId = col.rows[0].id

      // Server-side phase resolution and allowlist enforcement
      let serverPhases: any[] = []
      try {
        const p = col.rows[0].phases
        serverPhases = Array.isArray(p) ? p : (p ? JSON.parse(p) : [])
      } catch {}
      const nowTs = Date.now()
      const resolveActive = (phs: any[]) => phs.find((x: any) => {
        const s = x?.startDate ? new Date(x.startDate).getTime() : -Infinity
        const e = x?.endDate ? new Date(x.endDate).getTime() : Infinity
        return nowTs >= s && nowTs <= e
      })
      const phaseByName = (n?: string) => serverPhases.find((x: any) => x?.name === n)
      let active = phase?.name ? phaseByName(phase.name) : resolveActive(serverPhases)
      // Be lenient: if client provided an unknown phase name, fallback to server-resolved active phase (if any)
      if (phase?.name && !active) {
        active = resolveActive(serverPhases)
      }
      if (active) {
        let listed = true
        if (Array.isArray(active.allowlist)) {
          // If allowlist array exists: empty = Public (auto-allowed), non-empty = enforce list
          if (active.allowlist.length > 0) {
            listed = active.allowlist.map((a: string) => a.trim()).includes(String(wallet))
          } else {
            listed = true // explicit Public phase
          }
        } else {
          // No array provided: optional DB-backed allowlist; if missing table, treat as public
          try {
            const wl = await query<{ exists: boolean }>(
              `SELECT EXISTS(
                 SELECT 1 FROM phase_allowlist
                 WHERE collection_id = $1 AND phase_name = $2 AND wallet_address = $3
               ) as exists`,
              [collectionId, active.name || '', String(wallet)]
            )
            listed = Boolean(wl.rows[0]?.exists)
          } catch {
            listed = true
          }
        }
        if (!listed) {
          return NextResponse.json({ ok: false, reason: 'allowlist', phase: active?.name || null }, { status: 200 })
        }
      }

      // Count existing confirmed mints for this wallet in the CURRENT PHASE only
      let already = 0
      try {
        const countRes = await query<{ sum: string }>(
          `SELECT COALESCE(SUM(quantity), 0) as sum
           FROM mint_transactions
           WHERE collection_id = $1 AND minter_address = $2 AND status = 'confirmed' AND phase_name = $3`,
          [collectionId, wallet, active?.name || null]
        )
        already = Number(countRes.rows[0]?.sum || 0)
      } catch (e: any) {
        // Fallback if phase_name column is missing (legacy). In that case, do not block by other phases.
        try {
          const countRes = await query<{ sum: string }>(
            `SELECT COALESCE(SUM(quantity), 0) as sum
             FROM mint_transactions
             WHERE collection_id = $1 AND minter_address = $2 AND status = 'confirmed'`,
            [collectionId, wallet]
          )
          already = Number(countRes.rows[0]?.sum || 0)
        } catch {}
      }
      const maxPerWallet = Number(active?.maxPerWallet || 0)
      if (maxPerWallet > 0 && already + Number(quantity) > maxPerWallet) {
        return NextResponse.json({ ok: false, reason: 'limit', already, allowed: Math.max(0, maxPerWallet - already) }, { status: 200 })
      }

      // Enforce per-phase max supply against confirmed mints only
      if (active?.maxSupply && Number(active.maxSupply) > 0) {
        let used = 0
        try {
          const usedRes = await query<{ sum: string }>(
            `SELECT COALESCE(SUM(quantity), 0) as sum
             FROM mint_transactions
             WHERE collection_id = $1 AND status = 'confirmed' AND phase_name = $2`,
            [collectionId, active?.name || null]
          )
          used = Number(usedRes.rows[0]?.sum || 0)
        } catch (e: any) {
          // Fallback for older schemas without phase_name column
          try {
            const usedRes = await query<{ sum: string }>(
              `SELECT COALESCE(SUM(quantity), 0) as sum
               FROM mint_transactions
               WHERE collection_id = $1 AND status = 'confirmed'`,
              [collectionId]
            )
            used = Number(usedRes.rows[0]?.sum || 0)
          } catch {}
        }
        if (used + Number(quantity) > Number(active.maxSupply)) {
          return NextResponse.json({ ok: false, reason: 'phase_sold_out' }, { status: 200 })
        }
      }

      // Atomically reserve next item indices for the full quantity
      const priceNum = Number(price) || 0
      const qtyNum = Math.max(1, Number(quantity) || 1)
      const totalPaid = priceNum * qtyNum
      let insert
      try {
        insert = await query(
          `INSERT INTO mint_transactions
           (collection_id, minter_address, nft_address, transaction_signature, mint_price, platform_fee, total_paid, quantity, status, network, phase_name)
           VALUES ($1,$2,NULL,NULL,$3,0,$4,$5,'pending',$6,$7)
           RETURNING id`,
          [collectionId, wallet, priceNum, totalPaid, qtyNum, network, active?.name || null]
        )
      } catch (e: any) {
        // Fallback for older schemas without phase_name column
        insert = await query(
          `INSERT INTO mint_transactions
           (collection_id, minter_address, nft_address, transaction_signature, mint_price, platform_fee, total_paid, quantity, status, network)
           VALUES ($1,$2,NULL,NULL,$3,0,$4,$5,'pending',$6)
           RETURNING id`,
          [collectionId, wallet, priceNum, totalPaid, qtyNum, network]
        )
      }
      // Allocate a contiguous block of indices [start, start+qty-1]
      let reservedStart: number | null = null
      let reservedIndices: number[] = []
      try {
        const up = await query<{ items_reserved: number }>(
          `UPDATE collections
             SET items_reserved = items_reserved + $2,
                 updated_at = NOW()
           WHERE id = $1
           RETURNING items_reserved`,
          [collectionId, qtyNum]
        )
        const newVal = Number(up.rows?.[0]?.items_reserved || qtyNum)
        reservedStart = newVal - qtyNum
        reservedIndices = Array.from({ length: qtyNum }, (_, i) => (reservedStart as number) + i)
      } catch {}

      return NextResponse.json({ ok: true, reservationId: insert.rows[0].id, already, reservedStart, reservedIndices })
    }

    if (action === 'confirm') {
      const { reservationId, signature, nftAddress } = body
      if (!reservationId || !signature) {
        return NextResponse.json({ error: 'Missing reservationId or signature' }, { status: 400 })
      }
      // Normalize signature to base58 string and clamp length to 200 chars for DB safety
      const normalizedSig = typeof signature === 'string' ? signature.slice(0, 200) : Buffer.from(signature).toString('base64').slice(0, 200)
      const updated = await query<{ collection_id: string; quantity: number }>(
        `UPDATE mint_transactions 
         SET status = 'confirmed', transaction_signature = $1, nft_address = $2, updated_at = NOW() 
         WHERE id = $3::uuid
         RETURNING collection_id, quantity`,
        [normalizedSig, nftAddress || null, reservationId]
      )
      if (!updated.rows?.length) {
        return NextResponse.json({ ok: false, error: 'Reservation not found' }, { status: 404 })
      }
      // Decrement reserved count now that this reservation is finalized
      try {
        const row = updated.rows[0]
        await query(
          `UPDATE collections
           SET items_reserved = GREATEST(items_reserved - $2, 0), updated_at = NOW()
           WHERE id = $1`,
          [row.collection_id, Number(row.quantity) || 0]
        )
      } catch {}
      // Update collection.items_minted to reflect latest total of confirmed mints only
      try {
        await query(
          `UPDATE collections c
           SET items_minted = sub.minted, updated_at = NOW()
           FROM (
             SELECT collection_id, COALESCE(SUM(quantity),0) AS minted
             FROM mint_transactions
             WHERE collection_id = (SELECT collection_id FROM mint_transactions WHERE id = $1)
               AND status = 'confirmed'
             GROUP BY collection_id
           ) AS sub
           WHERE c.id = sub.collection_id`,
          [reservationId]
        )
      } catch {}
      return NextResponse.json({ ok: true })
    }

    if (action === 'fail') {
      const { reservationId } = body
      if (!reservationId) {
        return NextResponse.json({ error: 'Missing reservationId' }, { status: 400 })
      }
      // Find reservation details to release reserved items
      let details: { collection_id: string; quantity: number } | null = null
      try {
        const r = await query<{ collection_id: string; quantity: number }>(
          `SELECT collection_id, quantity FROM mint_transactions WHERE id = $1::uuid`,
          [reservationId]
        )
        if (r.rows?.length) details = r.rows[0]
      } catch {}
      await query(`UPDATE mint_transactions SET status = 'failed', updated_at = NOW() WHERE id = $1::uuid`, [reservationId])
      if (details) {
        try {
          await query(
            `UPDATE collections
             SET items_reserved = GREATEST(items_reserved - $2, 0), updated_at = NOW()
             WHERE id = $1`,
            [details.collection_id, Number(details.quantity) || 0]
          )
        } catch {}
      }
      return NextResponse.json({ ok: true })
    }

    if (action === 'confirm_direct') {
      const { collectionAddress, wallet, quantity = 1, price = 0, network = 'mainnet-beta', signature, nftAddress, phaseName } = body || {}
      if (!collectionAddress || !wallet || !signature) {
        return NextResponse.json({ error: 'Missing collectionAddress, wallet or signature' }, { status: 400 })
      }
      // Normalize signature to base58 string and clamp length to 200 chars for DB safety
      const normalizedSig = typeof signature === 'string' ? signature.slice(0, 200) : Buffer.from(signature).toString('base64').slice(0, 200)
      // Resolve collection id
      const col = await query(
        `SELECT id FROM collections 
         WHERE collection_address = $1 OR candy_machine_address = $1 OR id::text = $1 
         LIMIT 1`,
        [collectionAddress]
      )
      if (!col.rows.length) {
        return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
      }
      const collectionId = col.rows[0].id
      // Insert a confirmed row
      try {
        await query(
          `INSERT INTO mint_transactions (collection_id, minter_address, nft_address, transaction_signature, mint_price, platform_fee, total_paid, quantity, status, network, phase_name)
           VALUES ($1,$2,$3,$4,$5,0,$6,$7,'confirmed',$8,$9)
            ON CONFLICT DO NOTHING`,
          [collectionId, wallet, nftAddress || null, normalizedSig, Number(price) || 0, Number(price) * Number(quantity), Number(quantity), network, phaseName || null]
        )
      } catch (e: any) {
        await query(
          `INSERT INTO mint_transactions (collection_id, minter_address, nft_address, transaction_signature, mint_price, platform_fee, total_paid, quantity, status, network)
           VALUES ($1,$2,$3,$4,$5,0,$6,$7,'confirmed',$8)
            ON CONFLICT DO NOTHING`,
          [collectionId, wallet, nftAddress || null, normalizedSig, Number(price) || 0, Number(price) * Number(quantity), Number(quantity), network]
        )
      }
      // Refresh aggregate
      try {
        await query(
          `UPDATE collections c
           SET items_minted = sub.minted, updated_at = NOW()
           FROM (
             SELECT collection_id, COALESCE(SUM(quantity),0) AS minted
             FROM mint_transactions
             WHERE collection_id = $1 AND status = 'confirmed'
             GROUP BY collection_id
           ) AS sub
           WHERE c.id = sub.collection_id`,
          [collectionId]
        )
      } catch {}
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Mint API error:', error)
    // Provide more context during development to help diagnose
    const details = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Mint API failed', details },
      { status: 500 }
    )
  }
}

// Optional helper GET endpoint retained for candy machine info (no conflict with POST).
import { createMintService, getPlatformWalletAddress, PLATFORM_FEE_USD } from '@/lib/services/mintService'
import { PublicKey } from '@solana/web3.js'
import { getConnection } from '@/lib/solana/umi'
import { createCandyMachineService } from '@/lib/solana/candyMachine'

export async function GET(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      candyMachineAddress, 
      walletAddress, 
      creatorAddress,
      mintPrice = 0,
      quantity = 1,
      network = 'mainnet-beta'
    } = body
    
    console.log('Mint request received:', {
      candyMachineAddress,
      walletAddress,
      creatorAddress,
      mintPrice,
      quantity,
      network
    })
    
    // Validate required parameters
    if (!candyMachineAddress || !walletAddress || !creatorAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: candyMachineAddress, walletAddress, creatorAddress' },
        { status: 400 }
      )
    }

    // Validate addresses
    try {
      new PublicKey(walletAddress)
      new PublicKey(creatorAddress)
      new PublicKey(candyMachineAddress)
    } catch (error) {
      console.error('Address validation error:', error)
      console.error('Addresses received:', { walletAddress, creatorAddress, candyMachineAddress })
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid wallet or candy machine address format',
          details: {
            walletAddress: walletAddress?.substring(0, 10) + '...',
            creatorAddress: creatorAddress?.substring(0, 10) + '...',
            candyMachineAddress: candyMachineAddress?.substring(0, 10) + '...',
            validationError: error instanceof Error ? error.message : 'Unknown validation error'
          }
        },
        { status: 400 }
      )
    }

    // Create mock wallet adapter for server-side processing
    // In production, this would be handled client-side with actual wallet signing
    const mockWallet = {
      adapter: {
        publicKey: { toString: () => walletAddress },
        signTransaction: async () => { 
          throw new Error('Server-side signing not implemented - use client-side minting') 
        },
        signAllTransactions: async () => { 
          throw new Error('Server-side signing not implemented - use client-side minting') 
        },
      }
    }

    // Create candy machine service with real Solana connection
    const connection = getConnection('mainnet-beta')
    const candyMachineService = createCandyMachineService(connection, mockWallet as any)

    // Calculate total cost including platform fee
    const mintService = createMintService(mockWallet as any, 'mainnet-beta')
    const costBreakdown = await mintService.calculateTotalCost(mintPrice, quantity)
    
    // Get platform fee info
    const platformFeeInfo = await mintService.getPlatformFeeInfo()

    // For demo purposes, return success with cost breakdown
    // In production, you would execute the actual mint transaction client-side
    const mockMintResult = {
      success: true,
      message: 'Mint prepared successfully - execute client-side',
      mintAddresses: Array.from({ length: quantity }, () => 
        `NFT${Math.random().toString(36).substr(2, 9)}`
      ),
      transactionInfo: {
        totalCost: costBreakdown.total,
        mintCost: costBreakdown.mintCost,
        platformFee: costBreakdown.platformFee,
        platformFeeUSD: PLATFORM_FEE_USD,
        platformWallet: getPlatformWalletAddress(),
        creatorWallet: creatorAddress,
        breakdown: costBreakdown.breakdown,
      },
      platformFeeInfo,
      metadata: Array.from({ length: quantity }, (_, i) => ({
        name: `Sample NFT #${Math.floor(Math.random() * 1000)}`,
        image: `https://via.placeholder.com/400x400?text=NFT+${Math.floor(Math.random() * 1000)}`,
        attributes: [
          {
            trait_type: 'Rarity',
            value: 'Common',
          },
          {
            trait_type: 'Edition',
            value: (i + 1).toString(),
          },
        ],
      })),
    }

    return NextResponse.json(mockMintResult)
    
  } catch (error) {
    console.error('Mint preparation error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Mint preparation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
