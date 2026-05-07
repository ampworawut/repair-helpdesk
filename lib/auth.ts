import { createClient } from './supabase'
import { UserProfile } from '@/types'

export async function getCurrentUser(): Promise<UserProfile | null> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null

  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  return data as UserProfile | null
}

export async function getCurrentRole(): Promise<string | null> {
  const user = await getCurrentUser()
  return user?.role || null
}

export function canCreateCase(role: string | null): boolean {
  return role !== null && role !== 'vendor_staff'
}

export function canCloseCase(role: string | null, isOwner: boolean): boolean {
  if (!role) return false
  if (role === 'admin' || role === 'supervisor') return true
  if (role === 'helpdesk' && isOwner) return true
  return false
}

export function canChangeOwner(role: string | null): boolean {
  return role === 'admin' || role === 'supervisor'
}

export function isAdmin(role: string | null): boolean {
  return role === 'admin'
}
