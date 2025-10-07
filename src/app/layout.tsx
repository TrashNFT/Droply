import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { WalletProvider } from '@/components/wallet/WalletProvider'
import { Toaster } from 'react-hot-toast'
import { PLATFORM_CONFIG } from '@/config/platform'
import { Analytics } from '@vercel/analytics/react'

const fontSans = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400','500','600','700','800'] })

export const metadata: Metadata = {
  title: PLATFORM_CONFIG.PLATFORM_NAME,
  description: PLATFORM_CONFIG.PLATFORM_DESCRIPTION,
  icons: {
    icon: PLATFORM_CONFIG.PLATFORM_FAVICON_SRC || '/logo.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={fontSans.className}>
        <WalletProvider>
          {children}
          <Toaster position="top-right" />
          <Analytics />
        </WalletProvider>
      </body>
    </html>
  )
}

