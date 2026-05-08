// lib/categories.ts — automatic case classification by keyword matching

export type CaseCategory =
  | 'hardware'
  | 'software'
  | 'network'
  | 'printer'
  | 'peripheral'
  | 'account'
  | 'other'

export const CATEGORY_LABELS: Record<CaseCategory, string> = {
  hardware: '🖥️ ฮาร์ดแวร์',
  software: '⚙️ ซอฟต์แวร์',
  network: '🌐 เน็ตเวิร์ค',
  printer: '🖨️ ปริ้นเตอร์',
  peripheral: '🖱️ อุปกรณ์เสริม',
  account: '👤 บัญชี',
  other: '📦 อื่นๆ',
}

export const CATEGORY_COLORS: Record<CaseCategory, string> = {
  hardware: 'bg-red-100 text-red-800',
  software: 'bg-blue-100 text-blue-800',
  network: 'bg-green-100 text-green-800',
  printer: 'bg-purple-100 text-purple-800',
  peripheral: 'bg-orange-100 text-orange-800',
  account: 'bg-yellow-100 text-yellow-800',
  other: 'bg-gray-100 text-gray-600',
}

// Keyword patterns — order matters (first match wins)
const CATEGORY_RULES: { category: CaseCategory; keywords: string[] }[] = [
  {
    category: 'printer',
    keywords: [
      'ปริ้น', 'printer', 'พิมพ์', 'หมึก', 'toner', 'ink', 'กระดาษติด',
      'พิมพ์ไม่ออก', 'พิมพ์ไม่ชัด', 'ตัวพิมพ์', 'fax', 'แฟกซ์',
    ],
  },
  {
    category: 'network',
    keywords: [
      'เน็ต', 'internet', 'network', 'wifi', 'wi-fi', 'lan', 'vpn',
      'เชื่อมต่อ', 'สัญญาณ', 'หลุด', 'สายแลน', 'ip', 'dns', 'proxy',
      'firewall', 'เร้าเตอร์', 'router', 'switch', 'access point',
      'เน็ตหลุด', 'เน็ตช้า', 'ต่อเน็ตไม่',
    ],
  },
  {
    category: 'peripheral',
    keywords: [
      'เมาส์', 'mouse', 'คีย์บอร์ด', 'keyboard', 'จอ', 'monitor', 'display',
      'webcam', 'เว็บแคม', 'กล้อง', 'ลำโพง', 'speaker', 'หูฟัง', 'headphone',
      'สาย', 'cable', 'adapter', 'อะแดปเตอร์', 'ups', 'ปลั๊ก', 'dock',
    ],
  },
  {
    category: 'hardware',
    keywords: [
      'เปิดไม่ติด', 'จอฟ้า', 'blue screen', 'จอดำ', 'ค้าง', 'hang', 'freeze',
      'แบต', 'battery', 'ชาร์จ', 'พัดลม', 'fan', 'ร้อน', 'overheat',
      'ram', 'แรม', 'harddisk', 'hdd', 'ssd', 'hardware', 'พัง', 'เสีย',
      'เปลี่ยนอุปกรณ์', 'mainboard', 'เมนบอร์ด', 'power supply', 'โน๊ตบุ๊ค',
      'คอม', 'computer', 'notebook', 'laptop', 'เครื่อง', 'ไม่ติด',
      'เสียงดัง', 'ฝา', 'บอดี้', 'body', 'จอแตก', 'หน้าจอแตก',
    ],
  },
  {
    category: 'software',
    keywords: [
      'windows', 'วินโดว์', 'win', 'office', 'ออฟฟิศ', 'โปรแกรม', 'program',
      'software', 'แอพ', 'app', 'ติดตั้ง', 'install', 'update', 'อัพเดท',
      'ไวรัส', 'virus', 'malware', 'ช้า', 'slow', 'error', 'bug',
      'license', 'ลิขสิทธิ์', 'pdf', 'chrome', 'browser', 'เบราเซอร์',
      'เครื่องช้า', 'ไม่สามารถ', 'ใช้งานไม่', 'driver', 'ไดร์เวอร์',
    ],
  },
  {
    category: 'account',
    keywords: [
      'รหัส', 'password', 'pass', 'ล็อกอิน', 'login', 'แอคเคาท์', 'account',
      'email', 'อีเมล', 'เมล', 'sign in', 'ลืม', 'เปลี่ยนรหัส',
      'เข้าไม่ได้', 'ไม่มีสิทธิ์', 'permission', 'access',
    ],
  },
]

/**
 * Classify a case based on title + description text.
 * Returns the best matching category, or 'other' if nothing matches.
 */
export function classifyCase(title: string, description?: string): CaseCategory {
  const text = `${title} ${description || ''}`.toLowerCase()

  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw.toLowerCase())) {
        return rule.category
      }
    }
  }

  return 'other'
}
