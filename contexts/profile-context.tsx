'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { UserProfile } from '@/types'

interface ProfileContextType {
  profile: UserProfile | null
  loading: boolean
}

const ProfileContext = createContext<ProfileContextType>({ profile: null, loading: true })

export function useProfile() {
  return useContext(ProfileContext)
}

export function ProfileProvider({
  children,
  profile,
  loading,
}: {
  children: ReactNode
  profile: UserProfile | null
  loading: boolean
}) {
  return (
    <ProfileContext.Provider value={{ profile, loading }}>
      {children}
    </ProfileContext.Provider>
  )
}
