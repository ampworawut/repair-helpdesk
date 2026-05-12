import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return '-'
  const d = new Date(dateString)
  return d.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function formatDateTime(dateString: string | null): string {
  if (!dateString) return '-'
  const d = new Date(dateString)
  return d.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function timeAgo(dateString: string): string {
  const now = new Date()
  const d = new Date(dateString)
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (mins < 1) return 'เมื่อสักครู่'
  if (mins < 60) return `${mins} นาทีที่แล้ว`
  if (hours < 24) return `${hours} ชม. ที่แล้ว`
  return `${days} วันที่แล้ว`
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

export async function generateCaseNumber(supabase: any): Promise<string> {
  // Get current year
  const yy = new Date().getFullYear().toString().slice(-2);
  
  // Get the highest case number for this year
  const { data: cases } = await supabase
    .from('repair_cases')
    .select('case_no')
    .like('case_no', `REP-${yy}-%`)
    .order('case_no', { ascending: false })
    .limit(1);

  let nextNumber = 1;
  
  if (cases && cases.length > 0) {
    const lastCaseNo = cases[0].case_no;
    const match = lastCaseNo.match(new RegExp(`^REP-${yy}-(\\d+)$`));
    
    if (match) {
      nextNumber = parseInt(match[1]) + 1;
    } else {
      // Handle cases with non-standard format
      const { data: allCases } = await supabase
        .from('repair_cases')
        .select('case_no')
        .like('case_no', `REP-${yy}-%`);
      
      if (allCases) {
        const numbers = allCases
          .map((c: any) => {
            const numMatch = c.case_no.match(new RegExp(`^REP-${yy}-(\\d+)$`));
            return numMatch ? parseInt(numMatch[1]) : 0;
          })
          .filter((n: number) => n > 0);
        
        nextNumber = Math.max(...numbers, 0) + 1;
      }
    }
  }

  return `REP-${yy}-${nextNumber.toString().padStart(4, '0')}`;
}