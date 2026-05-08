'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { UserProfile, UserRole, ROLE_LABELS } from '@/types'
import { NAV_ITEMS, NavItem } from '@/lib/permissions'
import { cn, getInitials } from '@/lib/utils'
import {
  LayoutDashboard,
  ClipboardList,
  PlusCircle,
  Settings,
  Users,
  Building2,
  Monitor,
  MapPin,
  BarChart3,
  Bell,
  Menu,
  X,
  LogOut,
  ChevronDown,
  ChevronRight,
  Layers,
  FileText,
} from 'lucide-react'
import Link from 'next/link'

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, ClipboardList, PlusCircle, Settings,
  Users, Building2, Monitor, MapPin, BarChart3,
  Layers, FileText,
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set())
  const [notifCount, setNotifCount] = useState(0)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const isAuthPage = pathname === '/login' || pathname === '/auth/callback'

  useEffect(() => {
    if (isAuthPage) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return router.push('/login')
      supabase.from('user_profiles').select('*').eq('id', session.user.id).single()
        .then(({ data }) => setProfile(data as UserProfile))
    })

    // Realtime notifications
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile?.id}`,
      }, () => {
        setNotifCount(c => c + 1)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Load unread count
  useEffect(() => {
    if (!profile?.id) return
    supabase.from('notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id).eq('is_read', false)
      .then(({ count }) => setNotifCount(count || 0))
  }, [profile?.id])

  const role = profile?.role as UserRole | null

  const visibleNav = NAV_ITEMS.filter(item => role && item.roles.includes(role))

  function toggleExpand(key: string) {
    const next = new Set(expandedMenus)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setExpandedMenus(next)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!profile && !isAuthPage) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
    </div>
  }

  // On auth pages (login, callback), render children without the app shell
  if (isAuthPage) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r shadow-sm flex flex-col transition-transform lg:translate-x-0 lg:static lg:z-auto',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">🔧</div>
          <div>
            <div className="text-sm font-bold text-gray-900">ระบบแจ้งซ่อม</div>
            <div className="text-xs text-gray-500">คอมพิวเตอร์</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto px-3 space-y-1">
          {visibleNav.map(item => {
            const isActive = pathname === item.href
            const hasChildren = item.children && item.children.length > 0
            const isExpanded = expandedMenus.has(item.label)
            const Icon = ICON_MAP[item.icon]

            return (
              <div key={item.label}>
                <Link
                  href={hasChildren ? '#' : item.href}
                  onClick={(e) => {
                    if (hasChildren) { e.preventDefault(); toggleExpand(item.label) }
                    else setSidebarOpen(false)
                  }}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                    isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  {Icon && <Icon className="w-5 h-5 shrink-0" />}
                  <span className="flex-1">{item.label}</span>
                  {hasChildren && (
                    isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                  )}
                </Link>

                {/* Children */}
                {hasChildren && isExpanded && (
                  <div className="ml-8 mt-1 space-y-1">
                    {item.children!.map(child => {
                      const childActive = pathname === child.href
                      const ChildIcon = ICON_MAP[child.icon]
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setSidebarOpen(false)}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                            childActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
                          )}
                        >
                          {ChildIcon && <ChildIcon className="w-4 h-4" />}
                          {child.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
              {profile ? getInitials(profile.display_name) : '??'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">{profile?.display_name}</div>
              <div className="text-xs text-gray-500">{role && ROLE_LABELS[role]}</div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="h-16 bg-white border-b flex items-center justify-between px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex-1" />

          <Link
            href="/"
            className="relative p-2 rounded-lg hover:bg-gray-100"
          >
            <Bell className="w-5 h-5 text-gray-600" />
            {notifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </Link>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}