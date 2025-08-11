# 🚀 Production Setup Guide - Solana NFT Launchpad

This guide will help you deploy your Solana NFT Launchpad to production with real mainnet functionality.

## 🔧 Prerequisites

1. **Solana Wallet** (Phantom, Solflare, etc.)
2. **SOL Balance** (at least 2-3 SOL for deployment and fees)
3. **Arweave Account** (for decentralized storage)
4. **Domain Name** (optional but recommended)

## 📋 Environment Configuration

### 1. Create `.env.local` file

Copy the example and configure your production settings:

```bash
cp env.example .env.local
```

### 2. Configure Platform Wallet (CRITICAL!)

**⚠️ IMPORTANT**: Change the platform wallet address to your own wallet where you want to receive platform fees.

```env
# Platform Configuration - CHANGE THIS!
PLATFORM_WALLET_ADDRESS=YOUR_WALLET_ADDRESS_HERE
PLATFORM_FEE_USD=1.0
```

### 3. Configure Solana Network

For production, use mainnet:

```env
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
```

### 4. Configure Arweave Storage

Get your Arweave private key from [Arweave Wallet](https://arweave.app):

```env
ARWEAVE_PRIVATE_KEY=your_arweave_private_key_here
BUNDLR_NETWORK_URL=https://node1.bundlr.network
```

## 🏗️ Deployment Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the Application

```bash
npm run build
```

### 3. Deploy to Your Platform

Choose your deployment platform:

#### Vercel (Recommended)
```bash
npm install -g vercel
vercel --prod
```

#### Netlify
```bash
npm install -g netlify-cli
netlify deploy --prod
```

#### Self-Hosted
```bash
npm start
```

## 🔐 Security Checklist

- [ ] Changed platform wallet address
- [ ] Set up proper environment variables
- [ ] Configured Arweave storage
- [ ] Tested wallet connections
- [ ] Verified transaction signing
- [ ] Set up monitoring/logging

## 🧪 Testing Before Production

### 1. Test Wallet Connection
- Connect Phantom/Solflare wallet
- Verify balance display
- Test transaction signing

### 2. Test Collection Creation
- Upload test images
- Create a test collection
- Verify Candy Machine deployment

### 3. Test Minting
- Create a test mint
- Verify transaction execution
- Check NFT creation

## 💰 Platform Fee Configuration

The platform charges a $1 USD fee per mint. This fee is:

1. **Converted to SOL** at current market rate
2. **Sent to your platform wallet** (PLATFORM_WALLET_ADDRESS)
3. **Separate from creator royalties**

### Fee Breakdown Example:
- Mint Price: 0.5 SOL
- Platform Fee: $1.00 USD (~0.02 SOL at $50/SOL)
- Total: 0.52 SOL
- Creator receives: 0.5 SOL
- Platform receives: 0.02 SOL

## 🚨 Important Notes

### Real Transactions
- All transactions now execute on Solana mainnet
- Real SOL will be spent for deployment and minting
- Real NFTs will be created and stored on Arweave

### Gas Fees
- Deployment: ~0.01-0.05 SOL
- Minting: ~0.001-0.005 SOL per NFT
- Platform fees are additional

### Storage
- Images stored on Arweave (decentralized)
- Metadata stored on Arweave
- Permanent and immutable storage

## 📊 Monitoring

### Transaction Tracking
- All transactions are logged to console
- Transaction signatures are returned
- Monitor your platform wallet for fee collection

### Error Handling
- Invalid addresses are caught and reported
- Failed transactions show detailed errors
- Network issues are handled gracefully

## 🆘 Troubleshooting

### Common Issues

1. **"Invalid wallet address format"**
   - Ensure wallet is connected
   - Check address validation

2. **"Transaction failed"**
   - Check SOL balance
   - Verify network connection
   - Check transaction logs

3. **"Upload failed"**
   - Check Arweave configuration
   - Verify file size limits
   - Check network connectivity

## 🎉 Launch Checklist

- [ ] Environment configured
- [ ] Platform wallet set
- [ ] Arweave configured
- [ ] Tested all functionality
- [ ] Deployed to production
- [ ] Monitored first transactions
- [ ] Ready for users!

## 📞 Support

For issues or questions:
1. Check console logs for errors
2. Verify environment configuration
3. Test with small amounts first
4. Monitor transaction status on Solana Explorer

---

**🎯 Your Solana NFT Launchpad is now ready for production!**

Users can now:
- ✅ Create real NFT collections
- ✅ Deploy Candy Machine v3 on mainnet
- ✅ Mint real NFTs with platform fees
- ✅ Store assets on Arweave
- ✅ Earn platform fees automatically

Good luck with your launch! 🚀
