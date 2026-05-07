import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'sonner'
import AppLayout from '@/components/layout/app-layout'

export const metadata: Metadata = {
  title: 'ระบบแจ้งซ่อมคอมพิวเตอร์',
  description: 'NSTDA Computer Repair Helpdesk',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <body>
        <AppLayout>{children}</AppLayout>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
