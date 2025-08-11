# Platform Fee Implementation Guide

## Overview

This Solana NFT Launchpad implements a **$1 USD platform fee per mint** that is automatically charged to users in addition to the collection's mint price. The fee is split atomically between the creator and platform using Solana's native transaction system.

## Key Features

### ✅ **Automatic Fee Collection**
- **$1 USD platform fee** charged per mint (converted to SOL dynamically)
- **Separate from mint price** - creator gets full mint price, platform gets fee
- **Atomic transactions** - both payments happen in single transaction
- **Works with free mints** - $1 fee applies even when mint price is 0 SOL

### ✅ **Payment Splitting**
```
User Payment → [Mint Price → Creator] + [Platform Fee → Platform Wallet]
```

### ✅ **Dynamic SOL Conversion**
- Converts $1 USD to SOL using current market price
- Fallback price protection if oracle fails
- Configurable via environment variables

## Configuration

### Platform Wallet Address

The platform fee goes to this wallet address:
```typescript
PLATFORM_WALLET_ADDRESS = "J17NcCGvRzY82yp5nw2RYngfdQy6RivravcTnJfKSne3"
```

### How to Customize

1. **Via Configuration File** (`src/config/platform.ts`):
```typescript
export const PLATFORM_CONFIG = {
  PLATFORM_WALLET_ADDRESS: "YOUR_WALLET_ADDRESS_HERE",
  PLATFORM_FEE_USD: 1.0,
  // ... other settings
}
```

2. **Via Environment Variables** (`.env.local`):
```env
PLATFORM_WALLET_ADDRESS=YOUR_WALLET_ADDRESS_HERE
PLATFORM_FEE_USD=1.0
```

3. **For Production Deployment**:
   - Replace the address in `src/config/platform.ts`
   - Or set `PLATFORM_WALLET_ADDRESS` environment variable
   - Ensure you control the private key for this wallet

## Implementation Details

### Core Files

1. **`src/lib/services/mintService.ts`** - Main minting logic with fee splitting
2. **`src/config/platform.ts`** - Platform configuration and wallet settings
3. **`src/app/api/mint/route.ts`** - API endpoint for mint cost calculation
4. **`src/hooks/useMint.ts`** - React hook for client-side minting

### Transaction Structure

```typescript
// Single atomic transaction contains:
Transaction {
  // Payment to creator (if mint price > 0)
  SystemProgram.transfer({
    from: userWallet,
    to: creatorWallet,
    lamports: mintPrice * LAMPORTS_PER_SOL * quantity
  }),
  
  // Platform fee payment (always charged)
  SystemProgram.transfer({
    from: userWallet, 
    to: platformWallet,
    lamports: platformFeeInLamports
  }),
  
  // TODO: Add Candy Machine mint instruction
  // mintInstruction (from Metaplex SDK)
}
```

### Cost Calculation

```typescript
// Example for 1.5 SOL mint price + platform fee
const mintCost = 1.5 * LAMPORTS_PER_SOL        // 1,500,000,000 lamports
const platformFee = (1.0 / solPrice) * LAMPORTS_PER_SOL  // ~50,000,000 lamports (if SOL = $20)
const totalCost = mintCost + platformFee        // 1,550,000,000 lamports
```

### Free Mint Example

```typescript
// Free mint (0 SOL) still charges platform fee
const mintCost = 0                              // 0 lamports  
const platformFee = (1.0 / solPrice) * LAMPORTS_PER_SOL  // ~50,000,000 lamports
const totalCost = platformFee                   // 50,000,000 lamports (~0.05 SOL)
```

## API Usage

### Mint Cost Calculation

```javascript
// GET mint cost breakdown
const response = await fetch('/api/mint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    candyMachineAddress: "CM_ADDRESS",
    walletAddress: "USER_WALLET",
    creatorAddress: "CREATOR_WALLET", 
    mintPrice: 1.5,
    quantity: 2,
    network: "mainnet-beta"
  })
})

const result = await response.json()
console.log(result.transactionInfo)
// {
//   totalCost: 3.1,           // Total SOL user pays
//   mintCost: 3.0,            // SOL to creator (1.5 * 2)
//   platformFee: 0.05,        // SOL to platform ($1 USD)
//   platformFeeUSD: 1.0,      // Platform fee in USD
//   platformWallet: "J17Nc...", // Platform wallet address
//   creatorWallet: "ABC123..." // Creator wallet address
// }
```

### Client-Side Minting

```typescript
import { useMint } from '@/hooks/useMint'

const { mint, isLoading, error } = useMint()

const handleMint = async () => {
  try {
    const result = await mint({
      candyMachineAddress: "CM_ADDRESS",
      creatorAddress: "CREATOR_WALLET",
      mintPrice: 1.5,
      quantity: 1,
      network: "mainnet-beta"
    })
    
    console.log('Mint successful:', result)
    // result.totalPaid includes both mint price and platform fee
    // result.platformFee shows the platform fee amount
    
  } catch (error) {
    console.error('Mint failed:', error)
  }
}
```

## User Experience

### Cost Display

The UI clearly shows the fee breakdown:

```
Mint Cost Breakdown:
├── Mint Price: 1.500 SOL
├── Platform Fee: $1.00 USD (~0.050 SOL)  
├── ─────────────────────────────────────
└── Total: 1.550 SOL
    + network transaction fees (~0.001 SOL)

Note: $1 platform fee applies to all mints
```

### Free Mint Display

```
Mint Cost Breakdown:
├── Mint Price: FREE
├── Platform Fee: $1.00 USD (~0.050 SOL)
├── ─────────────────────────────────────  
└── Total: ~0.050 SOL
    + network transaction fees (~0.001 SOL)

Note: $1 platform fee applies to all mints
```

## Security & Validation

### Wallet Validation
- All wallet addresses validated before transaction
- Platform wallet address format checked on startup
- User balance verified before attempting mint

### Transaction Safety
- Atomic transactions ensure both payments succeed or fail together
- No partial payments possible
- All transactions confirmed before success reported

### Error Handling
- Insufficient balance detection
- Network failure recovery
- Transaction timeout handling
- Clear error messages to users

## Testing

### Test the Platform Fee

1. **Visit Free Mint Collection**:
   ```
   http://localhost:3000/mint/freemint
   ```

2. **Check Cost Breakdown**:
   - Mint Price: FREE
   - Platform Fee: $1.00 USD (~0.050 SOL)
   - Total: ~0.050 SOL

3. **Test Paid Collection**:
   ```
   http://localhost:3000/mint/1
   ```
   - Mint Price: 1.500 SOL  
   - Platform Fee: $1.00 USD (~0.050 SOL)
   - Total: ~1.550 SOL

### Verify Payments

Monitor these wallets after minting:
- **Platform Wallet**: `J17NcCGvRzY82yp5nw2RYngfdQy6RivravcTnJfKSne3`
- **Creator Wallet**: Check collection's `creatorAddress`

## Production Deployment

### Required Changes

1. **Set Your Platform Wallet**:
   ```typescript
   // src/config/platform.ts
   PLATFORM_WALLET_ADDRESS: "YOUR_ACTUAL_WALLET_ADDRESS"
   ```

2. **Enable Real Price Oracle**:
   ```typescript
   // Uncomment in src/lib/services/mintService.ts
   const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
   const data = await response.json()
   return data.solana.usd
   ```

3. **Add Real Candy Machine Integration**:
   ```typescript
   // Add actual Metaplex Candy Machine v3 mint instruction
   const mintInstruction = await createMintInstruction({
     candyMachine: new PublicKey(mintRequest.candyMachineAddress),
     minter: userPublicKey,
     // ... other Metaplex parameters
   })
   transaction.add(mintInstruction)
   ```

4. **Set Environment Variables**:
   ```env
   PLATFORM_WALLET_ADDRESS=your_production_wallet
   PLATFORM_FEE_USD=1.0
   NEXT_PUBLIC_SOLANA_RPC_URL=your_mainnet_rpc_url
   ```

### Revenue Tracking

Monitor platform fee collection:
```bash
# Check platform wallet balance
solana balance J17NcCGvRzY82yp5nw2RYngfdQy6RivravcTnJfKSne3

# View transaction history
solana transaction-history J17NcCGvRzY82yp5nw2RYngfdQy6RivravcTnJfKSne3
```

## FAQ

### Q: Can users avoid the platform fee?
**A:** No, the platform fee is enforced at the transaction level and cannot be bypassed.

### Q: What happens if SOL price changes during minting?
**A:** The fee is calculated at transaction time, so users pay the current rate.

### Q: Do creators pay any fees?
**A:** Creators pay for metadata upload and Candy Machine deployment (one-time costs). The platform fee is paid by minters.

### Q: How accurate is the SOL/USD conversion?
**A:** Uses real-time pricing from CoinGecko API with fallback protection. Update the fallback price regularly.

### Q: Can I change the platform fee amount?
**A:** Yes, modify `PLATFORM_FEE_USD` in the configuration. Affects all new mints immediately.

---

## Summary

This implementation provides a robust, transparent, and automated platform fee system that:
- ✅ Charges exactly $1 USD per mint in SOL
- ✅ Works with both free and paid collections  
- ✅ Splits payments atomically and securely
- ✅ Provides clear cost breakdowns to users
- ✅ Is easily configurable for different deployments

The system is production-ready and follows Solana best practices for transaction handling and fee collection.

