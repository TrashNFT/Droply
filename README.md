# Droply

Droply is a no-code NFT Launchpad platform for Solana using Candy Machine v3. This platform allows users to create and launch NFT collections without writing any code.

## Features

- 🔗 **Wallet Connection**: Connect with Phantom, Solflare, and other Solana wallets
- 📤 **Asset Upload**: Upload NFT images and metadata or create layered traits
- ⚙️ **Candy Machine v3**: Automatic deployment using Metaplex SDK
- 💰 **Mint Configuration**: Set mint price, supply, and start date
- 🎨 **Mint Page Preview**: Preview your collection before launch
- 📊 **Dashboard**: Track mints and collection statistics
- 🌐 **Arweave Storage**: Decentralized storage for NFT assets
- 💸 **Platform Fee System**: $1 USD platform fee per mint (separate from creator pricing)
- 🆓 **Free Mint Support**: Full support for 0 SOL collections with platform fee handling

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Blockchain**: Solana Web3.js, Metaplex JS SDK
- **Storage**: Arweave (via Bundlr)
- **Wallets**: Solana Wallet Adapter
- **Forms**: React Hook Form, Zod validation

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Solana wallet (Phantom, Solflare, etc.)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd solana-nft-launchpad
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Configure your environment variables:
```env
# Solana Configuration
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta

# Platform Configuration (IMPORTANT!)
PLATFORM_WALLET_ADDRESS=J17NcCGvRzY82yp5nw2RYngfdQy6RivravcTnJfKSne3
PLATFORM_FEE_USD=1.0

# Arweave/Bundlr Configuration (for production)
ARWEAVE_PRIVATE_KEY=your_arweave_private_key
BUNDLR_NETWORK_URL=https://node1.bundlr.network

# Optional: For development
NEXT_PUBLIC_SOLANA_RPC_URL_DEV=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_NETWORK_DEV=devnet
```

**⚠️ IMPORTANT**: Before deploying to production, change `PLATFORM_WALLET_ADDRESS` to your own wallet address where you want to receive platform fees.

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages
│   ├── create/           # NFT creation pages
│   └── mint/             # Mint pages
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── wallet/           # Wallet connection components
│   └── forms/            # Form components
├── lib/                  # Utility libraries
│   ├── solana/           # Solana blockchain utilities
│   ├── arweave/          # Arweave storage utilities
│   └── candy-machine/    # Candy Machine utilities
├── types/                # TypeScript type definitions
└── utils/                # Helper functions
```

## Usage

1. **Connect Wallet**: Connect your Solana wallet to the platform
2. **Upload Assets**: Upload your NFT images and metadata
3. **Configure Collection**: Set mint price, supply, and start date
   - **Set price to 0 SOL for FREE MINT collections**
4. **Deploy**: Deploy your Candy Machine v3 collection to Solana mainnet
5. **Share**: Share your mint page with your community
6. **Track**: Monitor your collection's performance in the dashboard

## Platform Fee System

This launchpad charges a **$1 USD platform fee per mint** that is automatically collected in addition to the collection's mint price:

### How It Works
- **Creators set their mint price** (can be 0 SOL for free mints)
- **Platform charges $1 USD extra** (converted to SOL dynamically)
- **Atomic payment splitting**: Creator gets mint price, platform gets $1 fee
- **Works with free mints**: Even 0 SOL collections have the $1 platform fee

### Cost Examples
```
Paid Collection (1.5 SOL mint price):
├── Mint Price: 1.500 SOL → Creator Wallet
├── Platform Fee: ~0.050 SOL ($1 USD) → Platform Wallet
└── Total User Pays: ~1.550 SOL + gas fees

Free Collection (0 SOL mint price):
├── Mint Price: FREE → Creator Wallet  
├── Platform Fee: ~0.050 SOL ($1 USD) → Platform Wallet
└── Total User Pays: ~0.050 SOL + gas fees
```

### Revenue Distribution
- **Platform earns**: $1 per mint × total mints
- **Creators earn**: Full mint price × total mints
- **Creators pay**: One-time deployment costs (metadata upload, Candy Machine creation)

### Free Mint Collections

The platform fully supports **FREE MINT** collections:
- Set the mint price to **0 SOL** during collection creation
- Users pay $1 platform fee + network transaction fees (~0.001 SOL)
- Perfect for community airdrops and promotional campaigns
- Automatic detection and special UI indicators for free mints

### Testing the Platform

1. **Visit the dashboard**: http://localhost:3000/dashboard
2. **Test Free Mint**: http://localhost:3000/mint/freemint
   - Notice "FREE MINT" indicators
   - See platform fee breakdown: $1 USD (~0.050 SOL)
3. **Test Paid Mint**: http://localhost:3000/mint/1
   - See full cost breakdown: Mint price + Platform fee
4. **Connect your wallet** and test the minting flow

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details

