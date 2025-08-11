/**
 * Platform Configuration
 * 
 * This file contains all platform-specific settings that can be customized
 * for different deployments or environments.
 */

// Platform wallet address - Change this to your own wallet address
export const PLATFORM_CONFIG = {
  // Main platform wallet that receives all platform fees
  PLATFORM_WALLET_ADDRESS: "J17NcCGvRzY82yp5nw2RYngfdQy6RivravcTnJfKSne3",
  
  // Platform fee in USD (charged per mint)
  PLATFORM_FEE_USD: 1.0,
  // Fixed platform fee in SOL (overrides USD-based fee when used)
  PLATFORM_FEE_SOL: 0.005,
  
  // Platform name and branding
  PLATFORM_NAME: "Droply",
  PLATFORM_DESCRIPTION: "Droply — No‑code NFT Launchpad for Solana using Candy Machine v3",
  PLATFORM_LOGO_SRC: "/logo.png", // Place your logo file under `public/logo.png`
  PLATFORM_FAVICON_SRC: "/logo.png",
  
  // Network settings
  DEFAULT_NETWORK: "mainnet-beta" as const,
  
  // RPC endpoints
  RPC_ENDPOINTS: {
    "mainnet-beta": process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  },
  
  // Fee structure
  FEES: {
    // Platform fee per mint (in USD)
    PLATFORM_FEE_USD: 1.0,
    
    // Creator fee percentage (basis points, 500 = 5%)
    DEFAULT_CREATOR_FEE_BPS: 500,
    
    // Maximum creator fee allowed (basis points, 1000 = 10%)
    MAX_CREATOR_FEE_BPS: 1000,
  },
  
  // Collection limits
  LIMITS: {
    // Maximum number of NFTs per collection
    MAX_COLLECTION_SIZE: 10000,
    
    // Maximum file size for uploads (in MB)
    MAX_FILE_SIZE_MB: 10,
    
    // Maximum number of files per upload
    MAX_FILES_PER_UPLOAD: 1000,
  },
  
  // Supported file types
  SUPPORTED_FILE_TYPES: [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
  ],
  
  // External services
  SERVICES: {
    // Arweave configuration
    ARWEAVE_HOST: "arweave.net",
    ARWEAVE_PORT: 443,
    ARWEAVE_PROTOCOL: "https",
    
    // Price oracle (for SOL/USD conversion)
    PRICE_ORACLE_URL: "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
    FALLBACK_SOL_PRICE_USD: 20.0, // Fallback if oracle fails
  },
}

/**
 * Environment-specific overrides
 */
export const getConfig = () => {
  const config = { ...PLATFORM_CONFIG }
  
  // Override with environment variables if available
  if (process.env.PLATFORM_WALLET_ADDRESS) {
    config.PLATFORM_WALLET_ADDRESS = process.env.PLATFORM_WALLET_ADDRESS
  }
  
  if (process.env.PLATFORM_FEE_USD) {
    config.PLATFORM_FEE_USD = parseFloat(process.env.PLATFORM_FEE_USD)
    config.FEES.PLATFORM_FEE_USD = parseFloat(process.env.PLATFORM_FEE_USD)
  }
  if (process.env.PLATFORM_FEE_SOL) {
    config.PLATFORM_FEE_SOL = parseFloat(process.env.PLATFORM_FEE_SOL)
  }

  // Optional branding overrides via env
  if (process.env.PLATFORM_NAME) {
    config.PLATFORM_NAME = process.env.PLATFORM_NAME
  }
  if (process.env.PLATFORM_DESCRIPTION) {
    config.PLATFORM_DESCRIPTION = process.env.PLATFORM_DESCRIPTION
  }
  if (process.env.PLATFORM_LOGO_SRC) {
    config.PLATFORM_LOGO_SRC = process.env.PLATFORM_LOGO_SRC
  }
  if (process.env.PLATFORM_FAVICON_SRC) {
    config.PLATFORM_FAVICON_SRC = process.env.PLATFORM_FAVICON_SRC
  }
  
  return config
}

/**
 * Validation functions
 */
export const validatePlatformConfig = () => {
  const config = getConfig()
  const errors: string[] = []
  
  // Validate wallet address format
  try {
    // This would normally use @solana/web3.js PublicKey validation
    if (config.PLATFORM_WALLET_ADDRESS.length < 32) {
      errors.push("Invalid platform wallet address format")
    }
  } catch (error) {
    errors.push("Invalid platform wallet address")
  }
  
  // Validate fee amounts
  if (config.PLATFORM_FEE_USD <= 0) {
    errors.push("Platform fee must be greater than 0")
  }
  
  if (config.FEES.DEFAULT_CREATOR_FEE_BPS < 0 || config.FEES.DEFAULT_CREATOR_FEE_BPS > 10000) {
    errors.push("Creator fee must be between 0 and 10000 basis points")
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    config,
  }
}

// Export commonly used values
export const {
  PLATFORM_WALLET_ADDRESS,
  PLATFORM_FEE_USD,
  PLATFORM_NAME,
  DEFAULT_NETWORK,
} = PLATFORM_CONFIG

// Also export logo paths for convenience
export const { PLATFORM_LOGO_SRC, PLATFORM_FAVICON_SRC, PLATFORM_DESCRIPTION } = PLATFORM_CONFIG

