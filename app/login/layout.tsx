import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'เข้าสู่ระบบ - ระบบแจ้งซ่อมคอมพิวเตอร์',
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}