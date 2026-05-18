'use client'

import { useEffect } from 'react'
import { loadSLAConfig } from '@/lib/sla'

export function SLAInit() {
  useEffect(() => {
    loadSLAConfig()
  }, [])
  return null
}
