import type { Metadata } from 'next'
import { Noto_Sans_Thai } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'
import AppLayout from '@/components/layout/app-layout'

const notoSansThai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-sans-thai',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'RepairDesk',
  description: 'RepairDesk - Computer Repair Helpdesk',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th" className={notoSansThai.variable}>
      <body className={notoSansThai.className}>
        <AppLayout>{children}</AppLayout>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
