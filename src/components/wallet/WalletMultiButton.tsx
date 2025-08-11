'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton as SolanaWalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { Button } from '@/components/ui/Button'
import { Wallet, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'

export const WalletMultiButton = () => {
  const { connected, disconnect } = useWallet()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Prevent hydration mismatch by not rendering on server
  if (!mounted) {
    return (
      <div className="bg-primary-600 hover:bg-primary-700 text-white border-0 rounded-lg px-4 py-2 text-sm font-medium">
        Connect Wallet
      </div>
    )
  }

  if (connected) {
    return (
      <div className="flex items-center space-x-2">
        <SolanaWalletMultiButton className="!bg-primary-600 hover:!bg-primary-700 !text-white !border-0 !rounded-lg !px-4 !py-2 !text-sm !font-medium" />
        <Button
          variant="outline"
          size="sm"
          onClick={disconnect}
          className="flex items-center space-x-1"
        >
          <LogOut className="h-4 w-4" />
          <span>Disconnect</span>
        </Button>
      </div>
    )
  }

  return (
    <SolanaWalletMultiButton className="!bg-primary-600 hover:!bg-primary-700 !text-white !border-0 !rounded-lg !px-4 !py-2 !text-sm !font-medium" />
  )
}

