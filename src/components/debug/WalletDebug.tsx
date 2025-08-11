'use client'

import { useWallet } from '@solana/wallet-adapter-react'

export const WalletDebug = () => {
  const { 
    connected, 
    connecting, 
    disconnecting, 
    publicKey, 
    wallet,
    wallets 
  } = useWallet()

  return (
    <div className="fixed bottom-4 right-4 bg-black text-white p-4 rounded-lg text-xs max-w-sm z-50">
      <h4 className="font-bold mb-2">Wallet Debug Info:</h4>
      <div>Connected: {connected ? '✅' : '❌'}</div>
      <div>Connecting: {connecting ? '🔄' : '❌'}</div>
      <div>Disconnecting: {disconnecting ? '🔄' : '❌'}</div>
      <div>PublicKey: {publicKey ? publicKey.toString().slice(0, 8) + '...' : 'None'}</div>
      <div>Current Wallet: {wallet?.adapter.name || 'None'}</div>
      <div>Available Wallets: {wallets.length}</div>
      <div className="mt-2 text-xs">
        Wallets: {wallets.map(w => w.adapter.name).join(', ')}
      </div>
    </div>
  )
}
