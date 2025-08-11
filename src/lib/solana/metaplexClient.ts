import { Connection } from '@solana/web3.js'
import { Metaplex, irysStorage, walletAdapterIdentity, toMetaplexFile } from '@metaplex-foundation/js'

export const createMetaplexClient = (
  walletAdapter: any,
  network: 'mainnet-beta' | 'devnet' = 'devnet'
) => {
  const rpcUrl = network === 'devnet'
    ? process.env.NEXT_PUBLIC_SOLANA_RPC_URL_DEV || 'https://api.devnet.solana.com'
    : process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'

  const connection = new Connection(rpcUrl, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 120_000,
  })

  const bundlerAddress = network === 'devnet'
    ? 'https://devnet.irys.xyz'
    : 'https://node1.irys.xyz'

  const metaplex = Metaplex.make(connection)
    .use(walletAdapterIdentity(walletAdapter))
    .use(irysStorage({ address: bundlerAddress, providerUrl: rpcUrl, timeout: 60_000 }))

  return metaplex
}

export const toMxFileFromBrowserFile = async (file: File) => {
  const buffer = await file.arrayBuffer()
  return toMetaplexFile(new Uint8Array(buffer), file.name, { contentType: file.type })
}


