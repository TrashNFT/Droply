'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { WalletMultiButton as CustomWalletButton } from '@/components/wallet/WalletMultiButton'

export default function WalletTestPage() {
  const { connected, publicKey, wallet } = useWallet()

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Wallet Connection Test</h1>
        
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
          <div className="space-y-2">
            <div>Connected: {connected ? '✅ Yes' : '❌ No'}</div>
            <div>Wallet: {wallet?.adapter.name || 'None'}</div>
            <div>Public Key: {publicKey ? publicKey.toString() : 'None'}</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Original Solana Wallet Button</h2>
          <WalletMultiButton />
        </div>

        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Custom Wallet Button</h2>
          <CustomWalletButton />
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Instructions</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>Try connecting with both buttons above</li>
            <li>Check if the connection status updates</li>
            <li>If connected, try visiting the dashboard</li>
            <li>Check browser console for any errors</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
