'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { CaseActivity } from '@/types'

export function useRealtimeActivity(caseId: string) {
  const [activities, setActivities] = useState<CaseActivity[]>([])
  const supabase = createClient()

  useEffect(() => {
    // Initial load
    supabase.from('case_activity_log').select('*, user_profile:user_id(*)')
      .eq('case_id', caseId).order('created_at', { ascending: true })
      .then(({ data }) => setActivities(data as unknown as CaseActivity[] || []))

    // Realtime subscription
    const channel = supabase
      .channel(`case-${caseId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'case_activity_log',
        filter: `case_id=eq.${caseId}`,
      }, async (payload) => {
        const { data: profile } = await supabase.from('user_profiles')
          .select('*').eq('id', payload.new.user_id).single()
        setActivities(prev => [...prev, { ...payload.new, user_profile: profile } as unknown as CaseActivity])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [caseId])

  return activities
}
