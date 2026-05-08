'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Asset } from '@/types'
import { cn } from '@/lib/utils'
import { Search, Loader2 } from 'lucide-react'

interface Props {
  value: string
  asset: Asset | null
  onSelect: (asset: Asset) => void
  onClear: () => void
  error?: string
}

export default function AssetAutocomplete({ value, asset, onSelect, onClear, error }: Props) {
  const [query, setQuery] = useState(value || '')
  const [results, setResults] = useState<Asset[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const supabaseRef = useRef(createClient())
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Sync external value changes (e.g. form reset)
  useEffect(() => {
    if (!asset) setQuery('')
  }, [asset])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const searchAssets = useCallback(async (q: string) => {
    if (q.length < 1) {
      setResults([])
      setOpen(false)
      return
    }

    setLoading(true)
    const { data } = await supabaseRef.current
      .from('assets')
      .select('*, vendor:vendor_id(id, name)')
      .or(`asset_code.ilike.%${q}%,model.ilike.%${q}%,serial_number.ilike.%${q}%`)
      .eq('is_active', true)
      .order('asset_code')
      .limit(20)

    setResults((data as Asset[]) || [])
    setLoading(false)
    setOpen(true)
    setHighlightIdx(-1)
  }, [])

  function handleInputChange(val: string) {
    setQuery(val)
    onClear()
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchAssets(val), 250)
  }

  function handleSelect(a: Asset) {
    setQuery(a.asset_code)
    setOpen(false)
    setHighlightIdx(-1)
    onSelect(a)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightIdx(i => Math.min(i + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightIdx(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightIdx >= 0 && results[highlightIdx]) {
          handleSelect(results[highlightIdx])
        }
        break
      case 'Escape':
        setOpen(false)
        inputRef.current?.blur()
        break
    }
  }

  // Scroll highlighted into view
  useEffect(() => {
    if (highlightIdx >= 0 && listRef.current) {
      const el = listRef.current.children[highlightIdx] as HTMLElement
      if (el) el.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightIdx])

  const highlightMatch = (text: string) => {
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1 || !query) return <span>{text}</span>
    return (
      <span>
        {text.slice(0, idx)}
        <mark className="bg-yellow-200 text-inherit rounded-sm">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </span>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Input with clear button */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={() => { if (query.length >= 1) searchAssets(query) }}
          onKeyDown={handleKeyDown}
          placeholder="พิมพ์รหัสเครื่อง, รุ่น, หรือ serial number..."
          className={cn(
            'w-full pl-10 pr-10 py-3 border rounded-lg outline-none transition text-sm',
            error ? 'border-red-400' : 'border-gray-300 focus:ring-2 focus:ring-blue-500'
          )}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
        )}
      </div>

      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}

      {/* Dropdown */}
      {open && (
        <ul
          ref={listRef}
          className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto text-sm"
        >
          {results.length === 0 && !loading ? (
            <li className="px-4 py-3 text-gray-400 text-center">ไม่พบข้อมูล</li>
          ) : (
            results.map((a, i) => (
              <li
                key={a.id}
                onClick={() => handleSelect(a)}
                className={cn(
                  'px-4 py-3 cursor-pointer transition flex items-center justify-between',
                  i === highlightIdx ? 'bg-blue-50' : 'hover:bg-gray-50'
                )}
              >
                <div>
                  <span className="font-mono text-xs font-semibold text-gray-800">
                    {highlightMatch(a.asset_code)}
                  </span>
                  {a.model && (
                    <span className="text-gray-500 ml-2 text-xs">{highlightMatch(a.model)}</span>
                  )}
                </div>
                {a.serial_number && (
                  <span className="text-gray-400 text-xs font-mono">{a.serial_number}</span>
                )}
              </li>
            ))
          )}
        </ul>
      )}

      {/* Selected asset info */}
      {asset && (
        <div className="mt-3 p-4 bg-blue-50 rounded-lg text-sm space-y-1 border border-blue-100">
          <div className="flex items-center justify-between">
            <div className="font-mono text-sm font-bold text-blue-900">{asset.asset_code}</div>
            <button
              type="button"
              onClick={() => { setQuery(''); onClear() }}
              className="text-xs text-blue-500 hover:text-blue-700 hover:underline"
            >
              เปลี่ยน
            </button>
          </div>
          <div className="text-gray-600">📋 <strong>รุ่น:</strong> {asset.model || '-'}</div>
          <div className="text-gray-600">🏢 <strong>ผู้ให้เช่า:</strong> {asset.vendor?.name || 'ไม่ระบุ'}</div>
          <div className="text-gray-600">📍 <strong>ตำแหน่งปัจจุบัน:</strong> {asset.location || 'ไม่ระบุ'}</div>
          <div className="text-gray-600">📦 <strong>สถานะ:</strong> {asset.status}</div>
        </div>
      )}
    </div>
  )
}
