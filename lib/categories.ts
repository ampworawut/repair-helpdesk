// lib/categories.ts — 2-level case classification (main + sub) with Thai keyword matching

export type CaseMainCategory =
  | 'hardware'
  | 'accident'
  | 'software'
  | 'network'
  | 'printer'
  | 'peripheral'
  | 'account'
  | 'other'

export type CaseSubCategory = string // dynamic, but typed per main category below

export interface CategoryResult {
  main: CaseMainCategory
  sub: string
}

/* ── Main category definitions ── */

export interface MainCategoryDef {
  key: CaseMainCategory
  label: string
  emoji: string
  color: string
  subs: string[]
}

export const MAIN_CATEGORIES: MainCategoryDef[] = [
  {
    key: 'hardware', label: 'ฮาร์ดแวร์', emoji: '🖥️',
    color: 'bg-red-100 text-red-800',
    subs: ['เครื่องไม่เปิด/เปิดไม่ติด', 'จอฟ้า/จอดำ/ค้าง', 'แบตเตอรี่/ชาร์จ', 'ฮาร์ดดิสก์/SSD', 'แรม', 'พัดลม/ความร้อน', 'เมนบอร์ด', 'จอภาพในตัว', 'อื่นๆ'],
  },
  {
    key: 'accident', label: 'อุบัติเหตุ', emoji: '💥',
    color: 'bg-pink-100 text-pink-800',
    subs: ['น้ำ/ของเหลวหก', 'ตก/กระแทก', 'จอแตก', 'ฝา/บอดี้เสียหาย', 'อื่นๆ'],
  },
  {
    key: 'software', label: 'ซอฟต์แวร์', emoji: '⚙️',
    color: 'bg-blue-100 text-blue-800',
    subs: ['Windows/OS', 'โปรแกรม/แอพ', 'ไวรัส/มัลแวร์', 'ไดร์เวอร์', 'อัพเดท', 'เครื่องช้า', 'อื่นๆ'],
  },
  {
    key: 'network', label: 'เน็ตเวิร์ค', emoji: '🌐',
    color: 'bg-green-100 text-green-800',
    subs: ['เน็ตหลุด/เชื่อมต่อไม่ได้', 'เน็ตช้า', 'WiFi', 'VPN', 'สายแลน/อุปกรณ์', 'อื่นๆ'],
  },
  {
    key: 'printer', label: 'ปริ้นเตอร์', emoji: '🖨️',
    color: 'bg-purple-100 text-purple-800',
    subs: ['พิมพ์ไม่ออก', 'หมึก/โทนเนอร์', 'กระดาษติด', 'สแกนเนอร์', 'อื่นๆ'],
  },
  {
    key: 'peripheral', label: 'อุปกรณ์ต่อพ่วง', emoji: '🖱️',
    color: 'bg-orange-100 text-orange-800',
    subs: ['เมาส์/คีย์บอร์ด', 'จอภายนอก', 'กล้อง/เว็บแคม', 'ลำโพง/หูฟัง', 'สาย/อะแดปเตอร์', 'อื่นๆ'],
  },
  {
    key: 'account', label: 'บัญชี/สิทธิ์', emoji: '👤',
    color: 'bg-yellow-100 text-yellow-800',
    subs: ['ลืมรหัสผ่าน', 'ล็อกอินไม่ได้', 'สิทธิ์การเข้าถึง', 'อีเมล', 'อื่นๆ'],
  },
  {
    key: 'other', label: 'อื่นๆ', emoji: '📦',
    color: 'bg-gray-100 text-gray-600',
    subs: [],
  },
]

/* ── Lookup helpers ── */

const MAIN_MAP = new Map<CaseMainCategory, MainCategoryDef>(MAIN_CATEGORIES.map(m => [m.key, m]))

export function getMainCategory(key: CaseMainCategory): MainCategoryDef {
  return MAIN_MAP.get(key) || MAIN_CATEGORIES[MAIN_CATEGORIES.length - 1]
}

export function getMainLabel(key: CaseMainCategory): string {
  const m = MAIN_MAP.get(key)
  return m ? `${m.emoji} ${m.label}` : key
}

export function getMainColor(key: CaseMainCategory): string {
  return MAIN_MAP.get(key)?.color || 'bg-gray-100 text-gray-600'
}

export function getSubCategories(main: CaseMainCategory): string[] {
  return MAIN_MAP.get(main)?.subs || []
}

/* ── Keyword rules — ordered by priority (first match wins) ── */

interface KeywordRule {
  main: CaseMainCategory
  sub: string
  keywords: string[]
}

const CATEGORY_RULES: KeywordRule[] = [
  // ── Accident (highest priority) ──
  { main: 'accident', sub: 'น้ำ/ของเหลวหก', keywords: ['น้ำหก', 'น้ำเข้า', 'ของเหลว', 'กาแฟหก', 'เปียก', 'น้ำรั่ว', 'โดนน้ำ', 'จมน้ำ', 'น้ำท่วม'] },
  { main: 'accident', sub: 'ตก/กระแทก', keywords: ['ตก', 'กระแทก', 'หล่น', 'ชน', 'ทับ', 'เหยียบ', 'กระชาก'] },
  { main: 'accident', sub: 'จอแตก', keywords: ['จอแตก', 'หน้าจอแตก', 'จอร้าว', 'หน้าจอร้าว', 'จอเสียหาย', 'led แตก', 'lcd แตก'] },
  { main: 'accident', sub: 'ฝา/บอดี้เสียหาย', keywords: ['ฝาแตก', 'ฝาร้าว', 'บอดี้แตก', 'body แตก', 'ฝาพัง', 'บานพับ', 'hinge', 'ฝาเครื่อง'] },

  // ── Hardware ──
  { main: 'hardware', sub: 'เครื่องไม่เปิด/เปิดไม่ติด', keywords: ['เปิดไม่ติด', 'ไม่ติด', 'เปิดเครื่องไม่', 'ไม่ขึ้น', 'ไม่บูท', 'no power', 'ไฟไม่เข้า', 'เสียบแล้วไม่', 'บูทไม่', 'boot ไม่', 'เปิดไม่ได้', 'ไม่ยอมเปิด'] },
  { main: 'hardware', sub: 'จอฟ้า/จอดำ/ค้าง', keywords: ['จอฟ้า', 'blue screen', 'bsod', 'จอดำ', 'ค้าง', 'hang', 'freeze', 'ไม่ตอบสนอง', 'กระตุก', 'ค้างบ่อย', 'รีสตาร์ทเอง', 'restart เอง', 'reboot เอง'] },
  { main: 'hardware', sub: 'แบตเตอรี่/ชาร์จ', keywords: ['แบต', 'battery', 'ชาร์จ', 'ถ่าน', 'ไฟหมด', 'แบตหมด', 'แบตเสื่อม', 'ชาร์จไม่เข้า', 'adapter', 'อะแดปเตอร์', 'ที่ชาร์จ', 'ปลั๊กไฟ'] },
  { main: 'hardware', sub: 'ฮาร์ดดิสก์/SSD', keywords: ['harddisk', 'hdd', 'ssd', 'ฮาร์ดดิสก์', 'ดิสก์', 'disk', 'storage', 'ข้อมูลหาย', 'ไฟล์หาย', 'ลง windows ไม่ได้', 'format', 'ฟอร์แมต'] },
  { main: 'hardware', sub: 'แรม', keywords: ['ram', 'แรม', 'memory', 'หน่วยความจำ', 'ใส่แรม', 'เพิ่มแรม', 'เปลี่ยนแรม'] },
  { main: 'hardware', sub: 'พัดลม/ความร้อน', keywords: ['พัดลม', 'fan', 'ร้อน', 'overheat', 'heat', 'ความร้อน', 'ระบายความร้อน', 'ซิลิโคน', 'thermal', 'เสียงพัดลม', 'พัดลมดัง'] },
  { main: 'hardware', sub: 'เมนบอร์ด', keywords: ['mainboard', 'เมนบอร์ด', 'motherboard', 'บอร์ด', 'board', 'power supply', 'psu', 'วงจร', 'chip', 'ชิป', 'ไบออส', 'bios'] },
  { main: 'hardware', sub: 'จอภาพในตัว', keywords: ['จอใน', 'หน้าจอใน', 'จอ notebook', 'จอโน้ตบุ๊ค', 'จอภาพ', 'display', 'หน้าจอ', 'จอมีเส้น', 'จอมีจุด', 'dead pixel', 'จอฟลิก', 'flicker', 'จอสั่น'] },

  // ── Software ──
  { main: 'software', sub: 'Windows/OS', keywords: ['windows', 'วินโดว์', 'win 10', 'win 11', 'win7', 'os', 'operating system', 'ลง windows', 'ติดตั้ง windows', 'activate', 'activation', 'license', 'ลิขสิทธิ์', 'genuine'] },
  { main: 'software', sub: 'โปรแกรม/แอพ', keywords: ['โปรแกรม', 'program', 'software', 'แอพ', 'app', 'ติดตั้ง', 'install', 'ใช้งานไม่', 'เปิดโปรแกรมไม่', 'error', 'bug', 'ไม่สามารถ', 'excel', 'word', 'pdf', 'chrome', 'browser', 'เบราเซอร์', 'outlook'] },
  { main: 'software', sub: 'ไวรัส/มัลแวร์', keywords: ['ไวรัส', 'virus', 'malware', 'มัลแวร์', 'ransomware', 'trojan', 'โทรจัน', 'spyware', 'สปายแวร์', 'โฆษณา', 'popup', 'pop-up', 'หน้าแปลก'] },
  { main: 'software', sub: 'ไดร์เวอร์', keywords: ['driver', 'ไดร์เวอร์', 'driver ไม่', 'ไดร์เวอร์ไม่', 'device driver', 'อุปกรณ์ไม่รู้จัก'] },
  { main: 'software', sub: 'อัพเดท', keywords: ['update', 'อัพเดท', 'patch', 'แพทช์', 'windows update', 'อัพเกรด', 'upgrade'] },
  { main: 'software', sub: 'เครื่องช้า', keywords: ['เครื่องช้า', 'ช้ามาก', 'อืด', 'slow', 'lag', 'หน่วง', 'ตอบสนองช้า', 'boot ช้า', 'เปิดเครื่องช้า'] },

  // ── Network ──
  { main: 'network', sub: 'เน็ตหลุด/เชื่อมต่อไม่ได้', keywords: ['เน็ตหลุด', 'เน็ตไม่', 'ต่อเน็ตไม่', 'เชื่อมต่อไม่', 'internet ไม่', 'เน็ตหาย', 'สัญญาณหาย', 'ไม่มีเน็ต', 'เล่นเน็ตไม่', 'เข้าเน็ตไม่', 'เน็ตใช้ไม่'] },
  { main: 'network', sub: 'เน็ตช้า', keywords: ['เน็ตช้า', 'internet ช้า', 'เน็ตอืด', 'โหลดช้า', 'ความเร็วเน็ต', 'speed test', 'bandwidth'] },
  { main: 'network', sub: 'WiFi', keywords: ['wifi', 'wi-fi', 'ไวไฟ', 'wireless', 'สัญญาณ wifi', 'wifi หลุด', 'wifi ไม่', 'เชื่อม wifi'] },
  { main: 'network', sub: 'VPN', keywords: ['vpn', 'วีพีเอ็น', 'remote access', 'เชื่อม vpn', 'vpn ไม่'] },
  { main: 'network', sub: 'สายแลน/อุปกรณ์', keywords: ['สายแลน', 'lan', 'ethernet', 'router', 'เร้าเตอร์', 'switch', 'access point', 'ap', 'network', 'ip', 'dns', 'proxy', 'firewall', 'mac address'] },

  // ── Printer ──
  { main: 'printer', sub: 'พิมพ์ไม่ออก', keywords: ['พิมพ์ไม่ออก', 'พิมพ์ไม่', 'print ไม่', 'ไม่พิมพ์', 'สั่งพิมพ์ไม่', 'ปริ้นไม่', 'ปริ้นไม่ออก'] },
  { main: 'printer', sub: 'หมึก/โทนเนอร์', keywords: ['หมึก', 'toner', 'ink', 'ตลับหมึก', 'หมึกหมด', 'หมึกจาง', 'เติมหมึก', 'เปลี่ยนหมึก', 'ribbon', 'ผ้าหมึก'] },
  { main: 'printer', sub: 'กระดาษติด', keywords: ['กระดาษติด', 'paper jam', 'กระดาษยับ', 'กระดาษไม่เข้า', 'ดึงกระดาษ'] },
  { main: 'printer', sub: 'สแกนเนอร์', keywords: ['สแกน', 'scan', 'scanner', 'สแกนเนอร์', 'สแกนไม่', 'scan ไม่'] },

  // ── Peripheral ──
  { main: 'peripheral', sub: 'เมาส์/คีย์บอร์ด', keywords: ['เมาส์', 'mouse', 'คีย์บอร์ด', 'keyboard', 'พิมพ์ไม่', 'คลิกไม่', 'เมาส์ไม่', 'คีย์บอร์ดไม่', 'touchpad', 'ทัชแพด', 'แป้นพิมพ์'] },
  { main: 'peripheral', sub: 'จอภายนอก', keywords: ['จอนอก', 'monitor', 'จอคอม', 'จอแยก', 'จอที่สอง', 'จอ external', 'hdmi', 'vga', 'displayport', 'ต่อจอไม่', 'จอไม่ขึ้น'] },
  { main: 'peripheral', sub: 'กล้อง/เว็บแคม', keywords: ['กล้อง', 'camera', 'webcam', 'เว็บแคม', 'กล้องไม่', 'camera ไม่'] },
  { main: 'peripheral', sub: 'ลำโพง/หูฟัง', keywords: ['ลำโพง', 'speaker', 'หูฟัง', 'headphone', 'earphone', 'เสียงไม่', 'ไม่มีเสียง', 'ไมค์', 'mic', 'microphone'] },
  { main: 'peripheral', sub: 'สาย/อะแดปเตอร์', keywords: ['สาย', 'cable', 'adapter', 'อะแดปเตอร์', 'ups', 'ปลั๊ก', 'dock', 'docking', 'hub', 'usb hub'] },

  // ── Account ──
  { main: 'account', sub: 'ลืมรหัสผ่าน', keywords: ['ลืมรหัส', 'ลืม password', 'ลืม pass', 'จำรหัสไม่', 'เปลี่ยนรหัส', 'reset password', 'forgot password', 'forget password'] },
  { main: 'account', sub: 'ล็อกอินไม่ได้', keywords: ['ล็อกอินไม่', 'login ไม่', 'เข้าไม่', 'sign in ไม่', 'เข้าระบบไม่', 'ล็อค', 'lock', 'locked', 'ถูก lock', 'ถูกระงับ', 'disabled'] },
  { main: 'account', sub: 'สิทธิ์การเข้าถึง', keywords: ['ไม่มีสิทธิ์', 'permission', 'access denied', 'สิทธิ์ไม่', 'ขอสิทธิ์', 'authorization', 'ไม่ได้รับอนุญาต'] },
  { main: 'account', sub: 'อีเมล', keywords: ['email', 'อีเมล', 'เมล', 'mail', 'outlook', 'gmail', 'ส่งเมลไม่', 'รับเมลไม่'] },
]

/* ── Classification function ── */

/**
 * Classify a case based on title + description text.
 * Returns main + sub category, or 'other' if nothing matches.
 */
export function classifyCase(title: string, description?: string): CategoryResult {
  const text = `${title} ${description || ''}`.toLowerCase()

  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw.toLowerCase())) {
        return { main: rule.main, sub: rule.sub }
      }
    }
  }

  return { main: 'other', sub: '' }
}

/* ── Legacy compatibility (for gradual migration) ── */

// Keep old type alias for backward compat
export type CaseCategory = CaseMainCategory

export const CATEGORY_LABELS: Record<string, string> = {}
for (const m of MAIN_CATEGORIES) {
  CATEGORY_LABELS[m.key] = `${m.emoji} ${m.label}`
}

export const CATEGORY_COLORS: Record<string, string> = {}
for (const m of MAIN_CATEGORIES) {
  CATEGORY_COLORS[m.key] = m.color
}
