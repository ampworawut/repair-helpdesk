'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Location } from '@/types'
import { cn } from '@/lib/utils'

interface LocationPickerProps {
  value: string
  onChange: (v: string) => void
  error?: string
}

export default function LocationPicker({ value, onChange, error }: LocationPickerProps) {
  const [locations, setLocations] = useState<Location[]>([])
  const [isCustom, setIsCustom] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('locations').select('*').eq('is_active', true).order('sort_order')
      .then(({ data }) => setLocations(data as Location[] || []))
  }, [])

  const isInList = locations.some(l => l.name === value)

  if (isCustom || (!isInList && value && locations.length > 0)) {
    return (
      <div className="flex gap-2 items-start">
        <div className="flex-1">
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="ระบุสถานที่เอง..."
            className={cn(
              'w-full px-4 py-3 border rounded-lg outline-none transition',
              error ? 'border-red-400' : 'border-gray-300 focus:ring-2 focus:ring-blue-500'
            )}
          />
        </div>
        <button
          type="button"
          onClick={() => { setIsCustom(false); onChange('') }}
          className="mt-0 text-sm text-blue-600 hover:underline whitespace-nowrap py-3"
        >
          ← เลือกจากรายการ
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-2 items-start">
      <div className="flex-1">
        <select
          value={value}
          onChange={e => {
            if (e.target.value === '__custom__') { setIsCustom(true); onChange('') }
            else onChange(e.target.value)
          }}
          className={cn(
            'w-full px-4 py-3 border rounded-lg bg-white outline-none transition',
            error ? 'border-red-400' : 'border-gray-300 focus:ring-2 focus:ring-blue-500'
          )}
        >
          <option value="">-- เลือกสถานที่ --</option>
          {locations.map(loc => (
            <option key={loc.id} value={loc.name}>
              {loc.name} — {loc.building}{loc.floor ? ` ชั้น ${loc.floor}` : ''}
            </option>
          ))}
          <option value="__custom__">✏️ ระบุเอง...</option>
        </select>
      </div>
    </div>
  )
}
