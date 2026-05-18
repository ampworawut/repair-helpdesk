import type { Metadata } from 'next'
import { Noto_Sans_Thai } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'
import AppLayout from '@/components/layout/app-layout'
import { ThemeProvider } from '@/contexts/theme-context'
import { SLAInit } from '@/components/sla-init'
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts'

const notoSansThai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-sans-thai',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'RepairDesk',
  description: 'RepairDesk - Computer Repair Helpdesk',
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th" className={notoSansThai.variable}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563eb" />
      </head>
      <body className={notoSansThai.className}>
        <ThemeProvider>
          <SLAInit />
          <KeyboardShortcuts />
          <AppLayout>{children}</AppLayout>
          <Toaster position="top-right" richColors />
        </ThemeProvider>
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js');
          }
        `}} />
      </body>
    </html>
  )
}
