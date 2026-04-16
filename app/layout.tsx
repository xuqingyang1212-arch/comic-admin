import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import GlobalToast from '@/components/global-toast'
import './globals.css'

export const metadata: Metadata = {
  title: '漫剧运营后台',
  description: '漫剧内容运营管理系统',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
        <GlobalToast />
        <Analytics />
      </body>
    </html>
  )
}
