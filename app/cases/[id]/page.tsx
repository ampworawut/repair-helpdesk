'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { evaluateSLA, formatMet, getEscalationLevel, calculatePausedDuration, adjustDeadlineForPause } from '@/lib/sla'
import { canCloseCase, canUpdateCase, canAssignTechnician, canChangeCaseOwner, canPauseResumeSLA, canConfirmResolution } from '@/lib/permissions'
import { cn, formatDateTime, timeAgo, getInitials } from '@/lib/utils'
import { CATEGORY_LABELS, CATEGORY_COLORS, type CaseCategory } from '@/lib/categories'
import {
  RepairCase, CaseStatus, CasePriority, UserProfile, CaseAttachment,
  CaseActivity, Asset, Vendor, Location,
  STATUS_LABELS, PRIORITY_LABELS, STATUS_COLORS, PRIORITY_COLORS, ROLE_LABELS,
  TicketComment, ConfirmationStatus, CONFIRMATION_STATUS_LABELS,
} from '@/types'
import Link from 'next/link'
import {
  ArrowLeft, Send, Paperclip, X, Image as ImageIcon,
  UserPlus, ChevronDown, Clock, MapPin, Monitor, Building2,
  CheckCircle2, XCircle, AlertTriangle, ExternalLink, Download,
  PauseCircle, PlayCircle, ShieldAlert, MessageSquare, Pencil,
} from 'lucide-react'
import ConfirmModal from '@/components/ui/confirm-modal'

/* ── Status Flow (valid transitions) ── */
const STATUS_FLOW: Record<CaseStatus, CaseStatus[]> = {
  pending:    ['responded', 'cancelled'],
  responded:  ['in_progress', 'on_hold', 'cancelled'],
  in_progress: ['resolved', 'on_hold', 'cancelled'],
  on_hold:    ['in_progress', 'cancelled'],
  resolved:   ['closed'],
  closed:     [],
  cancelled:  [],
}

const STATUS_ACTION_LABELS: Record<CaseStatus, string> = {
  pending:    'ตอบรับเรื่อง',
  responded:  'เริ่มดำเนินการ',
  in_progress: 'ดำเนินการเสร็จสิ้น',
  on_hold:    'พักการดำเนินการ',
  resolved:   'ปิดรายการ',
  closed:     'ปิดรายการแล้ว',
  cancelled:  'ยกเลิกรายการแล้ว',
}

/* ── Target status labels for dropdown ── */
const TARGET_STATUS_LABELS: Record<string, string> = {
  responded:   '📌 ตอบรับเรื่อง',
  in_progress: '🔧 ช่างเข้าดำเนินการ',
  on_hold:     '⏸️ พักการดำเนินการ',
  resolved:    '✅ ดำเนินการเสร็จสิ้น',
  closed:      '🔒 ปิดรายการ',
  cancelled:   '❌ ยกเลิกรายการ',
}

/* ── Page ── */
export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [c, setCase] = useState<RepairCase | null>(null)
  const [asset, setAsset] = useState<Asset | null>(null)
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [vendorGroup, setVendorGroup] = useState<{ id: string; name: string } | null>(null)
  const [attachments, setAttachments] = useState<CaseAttachment[]>([])
  const [activities, setActivities] = useState<CaseActivity[]>([])
  const [comments, setComments] = useState<TicketComment[]>([])
  const [loading, setLoading] = useState(true)

  // Update form
  const [comment, setComment] = useState('')
  const [updateFiles, setUpdateFiles] = useState<File[]>([])
  const [updatePreviews, setUpdatePreviews] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Comment form
  const [newComment, setNewComment] = useState('')
  const [newCommentInternal, setNewCommentInternal] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)

  // Gallery
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  // Dropdowns
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [showCategoryEdit, setShowCategoryEdit] = useState(false)

  // Confirm modal for status change
  const [confirmStatus, setConfirmStatus] = useState<{ newStatus: CaseStatus; title: string; message: string } | null>(null)

  // Vendor staff list (for assignment)
  const [vendorStaff, setVendorStaff] = useState<UserProfile[]>([])

  // Category editing
  const [editingCategory, setEditingCategory] = useState(false)
  const [editCategoryValue, setEditCategoryValue] = useState<CaseCategory>('other')
  const CATEGORIES: CaseCategory[] = ['hardware', 'software', 'network', 'printer', 'peripheral', 'account', 'other']

  // SLA display — reactive countdown
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  /* ─── load data ─── */
  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return router.push('/login')

    const { data: prof } = await supabase.from('user_profiles').select('*').eq('id', sessionData.session.user.id).single()
    setProfile(prof as UserProfile)

    // Fetch case first (no joins to avoid RLS cascade failures)
    const { data: caseData, error: caseError } = await supabase
      .from('repair_cases')
      .select('*')
      .eq('id', id)
      .single()

    console.log('caseData:', caseData, 'caseError:', caseError)

    if (!caseData) { setLoading(false); return }
    const rc = caseData as unknown as RepairCase
    setCase(rc)

    // Fetch asset separately
    if (rc.asset_id) {
      const { data: assetData } = await supabase
        .from('assets')
        .select('*')
        .eq('id', rc.asset_id)
        .single()
      if (assetData) {
        setAsset(assetData as Asset)
        // Fetch vendor for this asset
        if ((assetData as any).vendor_id) {
          const { data: vendorData } = await supabase
            .from('vendors')
            .select('*')
            .eq('id', (assetData as any).vendor_id)
            .single()
          if (vendorData) {
            setVendor(vendorData as unknown as Vendor)
            // Fetch vendor group separately
            if ((vendorData as any).group_id) {
              const { data: vgData } = await supabase
                .from('vendor_groups')
                .select('*')
                .eq('id', (vendorData as any).group_id)
                .single()
              if (vgData) setVendorGroup(vgData as { id: string; name: string })
            }
          }
        }
      }
    }

    // Fetch related user profiles separately
    const profileIds = [rc.created_by, rc.assigned_to, rc.closed_by].filter(Boolean) as string[]
    if (profileIds.length > 0) {
      const { data: relatedProfiles } = await supabase
        .from('user_profiles')
        .select('*')
        .in('id', profileIds)
      if (relatedProfiles) {
        const profileMap = new Map(relatedProfiles.map(p => [p.id, p]))
        ;(rc as any).created_by_profile = profileMap.get(rc.created_by) || null
        ;(rc as any).assigned_to_profile = profileMap.get(rc.assigned_to || '') || null
        ;(rc as any).closed_by_profile = profileMap.get(rc.closed_by || '') || null
      }
    }

    // Attachments
    const { data: atts } = await supabase.from('case_attachments').select('*').eq('case_id', id).order('created_at', { ascending: true })
    setAttachments(atts as CaseAttachment[] || [])

    // Activity log
    const { data: acts } = await supabase
      .from('case_activity_log')
      .select('*')
      .eq('case_id', id)
      .order('created_at', { ascending: true })

    const actsData = acts as unknown as CaseActivity[] || []

    // Fetch user profiles for activity log separately
    if (actsData.length > 0) {
      const actUserIds = [...new Set(actsData.map(a => a.user_id).filter(Boolean))] as string[]
      if (actUserIds.length > 0) {
        const { data: actUsers } = await supabase
          .from('user_profiles')
          .select('id, display_name')
          .in('id', actUserIds)
        if (actUsers) {
          const actUserMap = new Map(actUsers.map(u => [u.id, u]))
          for (const act of actsData) {
            ;(act as any).user_profile = actUserMap.get(act.user_id) || null
          }
        }
      }
    }

    setActivities(actsData)

    // Ticket comments
    const { data: cmts } = await supabase
      .from('ticket_comments')
      .select('*')
      .eq('case_id', id)
      .order('created_at', { ascending: true })

    const commentsData = cmts as TicketComment[] || []

    // Fetch author profiles separately
    if (commentsData.length > 0) {
      const authorIds = [...new Set(commentsData.map(c => c.author_id).filter(Boolean))] as string[]
      if (authorIds.length > 0) {
        const { data: authors } = await supabase
          .from('user_profiles')
          .select('id, display_name')
          .in('id', authorIds)
        if (authors) {
          const authorMap = new Map(authors.map(a => [a.id, a]))
          for (const cmt of commentsData) {
            ;(cmt as any).author = authorMap.get(cmt.author_id) || null
          }
        }
      }
    }

    setComments(commentsData)

    // Vendor staff for assignment — load all staff in the vendor group
    if (rc.asset?.vendor_id) {
      const vendorData = (rc as any).asset?.vendor
      const groupId = vendorData?.vendor_group?.id || vendorData?.group_id
      let staffQuery = supabase.from('user_profiles').select('*').eq('is_active', true).eq('role', 'vendor_staff')
      if (groupId) {
        staffQuery = staffQuery.eq('vendor_group_id', groupId)
      } else {
        staffQuery = staffQuery.eq('vendor_id', (rc.asset as any).vendor_id)
      }
      const { data: staff } = await staffQuery
      setVendorStaff(staff as UserProfile[] || [])
    }

    setLoading(false)
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  /* ─── permissions ─── */
  const role = profile?.role ?? null
  const userId = profile?.id ?? ''
  const isOwner = c?.created_by === userId
  const vendorMatch = !!(vendor?.id && (profile?.vendor_id === vendor.id || (vendorGroup != null && profile?.vendor_group_id === vendorGroup.id)))

  const canUpdate = role && userId ? canUpdateCase(role, c?.created_by || '', userId, vendorMatch) : false
  const canClose = role && userId ? canCloseCase(role, c?.created_by || '', userId) : false
  const canAssign = canAssignTechnician(role)
  const canChangeOwner = canChangeCaseOwner(role)
  const canPause = canPauseResumeSLA(role)
  const canConfirm = canConfirmResolution(role, c?.created_by || '', userId)

  /* ─── SLA ─── */
  // Calculate paused duration for adjusting deadlines
  const totalPausedMs = c ? calculatePausedDuration(c.sla_paused_total_seconds, c.sla_paused_at) : 0
  const hasPausedTime = totalPausedMs > 0

  // Adjusted deadlines
  const adjustedResponseDl = c?.sla_response_dl && hasPausedTime ? adjustDeadlineForPause(c.sla_response_dl, totalPausedMs).toISOString() : c?.sla_response_dl ?? null
  const adjustedOnsiteDl = c?.sla_onsite_dl && hasPausedTime ? adjustDeadlineForPause(c?.sla_onsite_dl, totalPausedMs).toISOString() : c?.sla_onsite_dl ?? null

  const responseSLA = !c?.responded_at ? evaluateSLA(adjustedResponseDl) : { status: 'ok' as const, label: formatMet(c.created_at, c.responded_at), remainingMs: null }
  const onsiteSLA = c?.status !== 'pending' && c?.status !== 'cancelled' && !c?.onsite_at
    ? evaluateSLA(adjustedOnsiteDl)
    : c?.onsite_at
      ? { status: 'ok' as const, label: `✅ ช่างมาถึง ${formatDateTime(c.onsite_at)}`, remainingMs: null }
      : { status: 'ok' as const, label: c?.status === 'pending' ? 'รอตอบรับก่อน' : '-', remainingMs: null }

  // Escalation info
  const escalationLevel = c?.escalation_level ?? 0
  const escalationInfo = escalationLevel > 0 ? getEscalationLevel(escalationLevel) : null

  /* ─── actions ─── */
  async function changeStatus(newStatus: CaseStatus) {
    if (!c) return
    setShowStatusMenu(false)
    const updates: any = { status: newStatus }

    if (newStatus === 'responded' && !c.responded_at) updates.responded_at = new Date().toISOString()
    if (newStatus === 'resolved') {
      updates.resolved_at = new Date().toISOString()
      updates.confirmation_status = 'pending'
    }
    if (newStatus === 'closed') { updates.closed_at = new Date().toISOString(); updates.closed_by = userId }
    if (newStatus === 'in_progress') updates.onsite_at = c.onsite_at || new Date().toISOString()

    // SLA pause/resume
    if (newStatus === 'on_hold') {
      updates.sla_paused_at = new Date().toISOString()
    }
    if (c.status === 'on_hold' && newStatus === 'in_progress') {
      updates.sla_paused_at = null
      if (c.sla_paused_at) {
        const elapsed = Math.floor((Date.now() - new Date(c.sla_paused_at).getTime()) / 1000)
        updates.sla_paused_total_seconds = (c.sla_paused_total_seconds || 0) + elapsed
      }
    }

    await supabase.from('repair_cases').update(updates).eq('id', c.id)
    await supabase.from('case_activity_log').insert({
      case_id: c.id, user_id: userId,
      action: 'status_change',
      old_value: c.status, new_value: newStatus,
      metadata: { old_status: c.status, new_status: newStatus },
    })

    // Add status change comment
    const statusMessage: Record<string, string> = {
      responded: '📌 ตอบรับเรื่องแล้ว',
      in_progress: '🔧 ช่างเข้าดำเนินการ',
      on_hold: '⏸️ พักการดำเนินการ',
      resolved: '✅ ดำเนินการเสร็จสิ้น',
      closed: '🔒 ปิดรายการ',
      cancelled: '❌ ยกเลิกรายการ',
    }
    const msg = statusMessage[newStatus]
    if (msg) {
      await supabase.from('ticket_comments').insert({
        case_id: c.id,
        author_id: userId,
        content: msg,
        is_internal: false,
      })
    }

    // LINE notification
    const statusToEvent: Record<string, string> = {
      in_progress: 'case_in_progress',
      on_hold: 'case_on_hold',
      resolved: 'case_resolved',
      closed: 'case_closed',
      cancelled: 'case_cancelled',
    }
    const event = statusToEvent[newStatus]
    if (event) {
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: c.id, event }),
      }).catch(() => {})
    }

    loadData()
  }

  async function handleConfirm(status: ConfirmationStatus) {
    if (!c) return
    await supabase.from('repair_cases').update({
      confirmation_status: status,
      ...(status === 'confirmed' ? {} : { status: 'in_progress' }),
    }).eq('id', c.id)
    await supabase.from('case_activity_log').insert({
      case_id: c.id, user_id: profile!.id,
      action: 'confirmation', metadata: { confirmation_status: status },
    })
    loadData()
  }

  async function handleSubmitUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!comment.trim() && updateFiles.length === 0) return
    if (!c || !profile) return
    setSubmitting(true)

    try {
      // Activity log
      const { data: act } = await supabase.from('case_activity_log').insert({
        case_id: c.id, user_id: profile.id,
        action: 'comment',
        metadata: { content: comment.trim() || 'แนบรูปภาพ' },
      }).select('id').single()

      const activityId = act?.id

      // Upload files
      for (const file of updateFiles) {
        const filePath = `${c.id}/${Date.now()}_${file.name}`
        const { error: uploadError } = await supabase.storage.from('repair-attachments').upload(filePath, file)
        if (uploadError) { console.error(uploadError); continue }

        await supabase.from('case_attachments').insert({
          case_id: c.id, file_path: filePath,
          file_name: file.name, file_size: file.size,
          uploaded_by: profile.id,
          activity_id: activityId || null,
        })
      }

      // Reset
      setComment('')
      updatePreviews.forEach(u => URL.revokeObjectURL(u))
      setUpdateFiles([])
      setUpdatePreviews([])
      loadData()
    } catch (err) { console.error(err) }
    finally { setSubmitting(false) }
  }

  async function handleSubmitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim() || !c || !profile) return
    setSubmittingComment(true)
    try {
      await supabase.from('ticket_comments').insert({
        case_id: c.id,
        author_id: profile.id,
        content: newComment.trim(),
        is_internal: newCommentInternal,
      })
      setNewComment('')
      setNewCommentInternal(false)
      loadData()
    } catch (err) { console.error(err) }
    finally { setSubmittingComment(false) }
  }

  async function handleAssign(userId: string) {
    if (!c) return
    setShowAssign(false)
    await supabase.from('repair_cases').update({ assigned_to: userId }).eq('id', c.id)
    await supabase.from('case_activity_log').insert({
      case_id: c.id, user_id: profile!.id,
      action: 'technician_assigned', new_value: userId,
      metadata: { assigned_to: userId },
    })
    loadData()
  }

  async function saveCategory(cat: CaseCategory) {
    if (!c) return
    setShowCategoryEdit(false)
    await supabase.from('repair_cases').update({ category: cat }).eq('id', c.id)
    await supabase.from('case_activity_log').insert({
      case_id: c.id, user_id: profile!.id,
      action: 'category_change',
      old_value: c.category || 'other',
      new_value: cat,
    })
    loadData()
  }

  function handleUpdateFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    const valid = files.filter(f => f.size <= 5 * 1024 * 1024)
    setUpdateFiles(prev => [...prev, ...valid])
    valid.forEach(f => setUpdatePreviews(prev => [...prev, URL.createObjectURL(f)]))
  }

  function removeUpdateFile(i: number) {
    URL.revokeObjectURL(updatePreviews[i])
    setUpdateFiles(prev => prev.filter((_, j) => j !== i))
    setUpdatePreviews(prev => prev.filter((_, j) => j !== i))
  }

  /* ─── Activity log display helper ─── */
  function renderActivityContent(act: CaseActivity) {
    const meta = act.metadata as Record<string, unknown> | null

    switch (act.action) {
      case 'status_change':
        return (
          <p className="text-sm mt-0.5">
            <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', STATUS_COLORS[act.old_value as CaseStatus] || 'bg-gray-100')}>{STATUS_LABELS[act.old_value as CaseStatus] || act.old_value}</span>
            <span className="mx-1 text-gray-400">→</span>
            <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', STATUS_COLORS[act.new_value as CaseStatus] || 'bg-gray-100')}>{STATUS_LABELS[act.new_value as CaseStatus] || act.new_value}</span>
          </p>
        )
      case 'comment':
        return <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{(meta?.content as string) || ''}</p>
      case 'create_case':
        return <p className="text-sm text-gray-700 mt-0.5">สร้างเคส</p>
      case 'technician_assigned':
        return <p className="text-sm text-gray-700 mt-0.5">มอบหมายช่าง</p>
      case 'confirmation':
        return <p className="text-sm text-gray-700 mt-0.5">ยืนยันสถานะ: {meta?.confirmation_status ? CONFIRMATION_STATUS_LABELS[meta.confirmation_status as ConfirmationStatus] || String(meta.confirmation_status) : '-'}</p>
      case 'escalation':
        return <p className="text-sm text-gray-700 mt-0.5">ยกระดับเรื่อง: ระดับ {String(meta?.escalation_level ?? '-')}</p>
      default:
        return <p className="text-sm text-gray-700 mt-0.5">{act.action}</p>
    }
  }

  /* ─── loading ─── */
  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
    </div>
  }

  if (!c) {
    return <div className="text-center py-20 text-gray-400">ไม่พบเคสนี้</div>
  }

  /* ─── render ─── */
  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/cases" className="p-2 hover:bg-gray-100 rounded-lg transition"><ArrowLeft className="w-5 h-5 text-gray-500" /></Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{c.case_no}</h1>
              <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold', PRIORITY_COLORS[c.priority])}>{PRIORITY_LABELS[c.priority]}</span>
              <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold', STATUS_COLORS[c.status])}>{STATUS_LABELS[c.status]}</span>
              {/* Category badge */}
              {(profile?.role === 'admin' || profile?.role === 'supervisor') ? (
                <div className="relative">
                  <button
                    onClick={() => { setShowCategoryEdit(!showCategoryEdit); setEditCategoryValue((c.category as CaseCategory) || 'other') }}
                    className={cn('px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer hover:opacity-80 transition', CATEGORY_COLORS[(c.category as CaseCategory) || 'other'])}
                  >
                    {CATEGORY_LABELS[(c.category as CaseCategory) || 'other']} ▾
                  </button>
                  {showCategoryEdit && (
                    <div className="absolute top-full mt-1 left-0 bg-white border rounded-lg shadow-lg z-20 py-1 min-w-[180px]">
                      {CATEGORIES.map(cat => (
                        <button key={cat} type="button" onClick={() => saveCategory(cat)}
                          className={cn('w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition flex items-center gap-2',
                            (c.category || 'other') === cat && 'bg-blue-50 font-medium')}
                        >
                          {CATEGORY_LABELS[cat]}
                          {(c.category || 'other') === cat && <span className="text-blue-600 ml-auto">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold', CATEGORY_COLORS[(c.category as CaseCategory) || 'other'])}>
                  {CATEGORY_LABELS[(c.category as CaseCategory) || 'other']}
                </span>
              )}
              {escalationInfo && (
                <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold', escalationInfo.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' : escalationInfo.color === 'orange' ? 'bg-orange-100 text-orange-800' : escalationInfo.color === 'red' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800')}>
                  <ShieldAlert className="w-3 h-3 inline mr-1" />{escalationInfo.label}
                </span>
              )}
            </div>
            <p className="text-lg text-gray-700 mt-0.5">{c.title}</p>
          </div>
        </div>
      </div>

      {/* Confirmation banner — resolved & pending */}
      {c.status === 'resolved' && c.confirmation_status === 'pending' && canConfirm && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800">เคสนี้รอยืนยันผลการแก้ไข</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleConfirm('confirmed')} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm">
              <CheckCircle2 className="w-4 h-4" /> ยืนยัน
            </button>
            <button onClick={() => handleConfirm('rejected')} className="flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-medium text-sm">
              <XCircle className="w-4 h-4" /> ไม่ยอมรับ
            </button>
          </div>
        </div>
      )}

      {/* Confirmation badge — confirmed */}
      {c.status === 'resolved' && c.confirmation_status === 'confirmed' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <span className="text-sm font-medium text-green-800">ยืนยันผลการแก้ไขแล้ว</span>
        </div>
      )}

      {/* Confirmation badge — rejected (status reverts to in_progress) */}
      {c.confirmation_status === 'rejected' && c.status !== 'closed' && c.status !== 'cancelled' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2">
          <XCircle className="w-5 h-5 text-red-500" />
          <span className="text-sm font-medium text-red-800">ไม่ยอมรับผลการแก้ไข — เคสกลับไปกำลังดำเนินการ</span>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        {/* ── Left: Info + SLA ── */}
        <div className="lg:col-span-1 space-y-4">
          {/* SLA Card */}
          <div className="bg-white rounded-xl border p-5 space-y-4">
            <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide">⏱️ SLA</h3>

            {/* Pause indicator */}
            {c.status === 'on_hold' && c.sla_paused_at && (
              <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-2 text-sm">
                <PauseCircle className="w-4 h-4 text-amber-600" />
                <span className="text-amber-800 font-medium">SLA หยุดนับชั่วคราว</span>
              </div>
            )}

            {/* Escalation badge */}
            {escalationInfo && (
              <div className={cn('px-3 py-2 rounded-lg border flex items-center gap-2 text-sm',
                escalationInfo.color === 'yellow' ? 'bg-yellow-50 border-yellow-200' :
                escalationInfo.color === 'orange' ? 'bg-orange-50 border-orange-200' :
                escalationInfo.color === 'red' ? 'bg-red-50 border-red-200' :
                'bg-green-50 border-green-200'
              )}>
                <ShieldAlert className={cn('w-4 h-4',
                  escalationInfo.color === 'yellow' ? 'text-yellow-600' :
                  escalationInfo.color === 'orange' ? 'text-orange-600' :
                  escalationInfo.color === 'red' ? 'text-red-600' :
                  'text-green-600'
                )} />
                <span className={cn('font-medium',
                  escalationInfo.color === 'yellow' ? 'text-yellow-800' :
                  escalationInfo.color === 'orange' ? 'text-orange-800' :
                  escalationInfo.color === 'red' ? 'text-red-800' :
                  'text-green-800'
                )}>{escalationInfo.label}</span>
              </div>
            )}

            <div className="space-y-3">
              <div className={cn('p-3 rounded-lg', responseSLA.status === 'breached' ? 'bg-red-50' : responseSLA.status === 'warning' ? 'bg-yellow-50' : 'bg-green-50')}>
                <div className="text-xs text-gray-500 mb-1">ตอบรับ</div>
                <div className={cn('text-sm font-medium', responseSLA.status === 'breached' ? 'text-red-700' : responseSLA.status === 'warning' ? 'text-yellow-700' : 'text-green-700')}>
                  {responseSLA.label}
                </div>
              </div>

              <div className={cn('p-3 rounded-lg', onsiteSLA.status === 'breached' ? 'bg-red-50' : onsiteSLA.status === 'warning' ? 'bg-yellow-50' : 'bg-green-50')}>
                <div className="text-xs text-gray-500 mb-1">ช่างมาถึง</div>
                <div className={cn('text-sm font-medium', onsiteSLA.status === 'breached' ? 'text-red-700' : onsiteSLA.status === 'warning' ? 'text-yellow-700' : 'text-green-700')}>
                  {onsiteSLA.label}
                </div>
              </div>
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-white rounded-xl border p-5 space-y-3">
            <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide">📋 ข้อมูล</h3>

            <div className="space-y-2.5 text-sm">
              <div className="flex gap-2"><Monitor className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" /><span className="text-gray-500">เครื่อง:</span><span className="font-medium text-gray-900">{asset?.asset_code || '-'}</span></div>
              {asset?.model && <div className="flex gap-2 ml-6"><span className="text-xs text-gray-400">{asset.model}</span></div>}
              <div className="flex gap-2"><Building2 className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" /><span className="text-gray-500">ผู้ให้เช่า:</span><span className="font-medium text-gray-900">{vendor?.name || '-'}</span></div>
              <div className="flex gap-2"><MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" /><span className="text-gray-500">สถานที่รับบริการ:</span><span className="font-medium text-gray-900">{c.service_location || '-'}</span></div>
              <div className="flex gap-2"><Clock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" /><span className="text-gray-500">แจ้งเมื่อ:</span><span>{formatDateTime(c.created_at)}</span></div>
              {c.assigned_to_profile && <div className="flex gap-2"><UserPlus className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" /><span className="text-gray-500">ช่าง:</span><span className="font-medium text-gray-900">{(c.assigned_to_profile as any).display_name}</span></div>}
              {c.closed_at && <div className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" /><span className="text-gray-500">ปิดเมื่อ:</span><span>{formatDateTime(c.closed_at)}</span></div>}
            </div>

            {c.description && (
              <div className="pt-3 border-t">
                <div className="text-xs text-gray-500 mb-1">รายละเอียด</div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Timeline + Comments + Actions ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Timeline */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-4">📝 ประวัติ</h3>
            <div className="space-y-4">
              {activities.map((act) => {
                const actAttachments = attachments.filter(a => (a as any).activity_id === act.id)
                return (
                <div key={act.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-xs font-semibold text-gray-600">
                    {(act as any).user_profile?.display_name ? getInitials((act as any).user_profile.display_name) : '??'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-900">{(act as any).user_profile?.display_name || 'ระบบ'}</span>
                      <span className="text-xs text-gray-400">{timeAgo(act.created_at)}</span>
                    </div>
                    {renderActivityContent(act)}
                    {/* Attachments for this activity */}
                    {actAttachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {actAttachments.map((att, i) => {
                          const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/repair-attachments/${att.file_path}`
                          const globalIdx = attachments.findIndex(a => a.id === att.id)
                          return (
                            <button key={att.id} onClick={() => setLightboxIdx(globalIdx)} className="w-20 h-20 rounded-lg border overflow-hidden hover:ring-2 ring-blue-400 transition group relative">
                              <img src={url} alt={att.file_name} className="w-full h-full object-cover" loading="lazy" />
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )})}
              {activities.length === 0 && <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีประวัติ</p>}
            </div>
          </div>

          {/* ── Comment Section ── */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-4">💬 ความคิดเห็น</h3>
            <div className="space-y-4">
              {comments.map((cmt) => {
                const authorName = (cmt as any).author?.display_name || 'ไม่ทราบชื่อ'
                // Hide internal comments from non-admin/supervisor
                if (cmt.is_internal && role !== 'admin' && role !== 'supervisor') return null
                return (
                  <div key={cmt.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-xs font-semibold text-blue-600">
                      {getInitials(authorName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-gray-900">{authorName}</span>
                        {cmt.is_internal && (
                          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">ภายใน</span>
                        )}
                        <span className="text-xs text-gray-400">{timeAgo(cmt.created_at)}</span>
                      </div>
                      <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{cmt.content}</p>
                    </div>
                  </div>
                )
              })}
              {comments.filter(cmt => !cmt.is_internal || role === 'admin' || role === 'supervisor').length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีความคิดเห็น</p>
              )}
            </div>

            {/* Comment form — visible when case is not closed/cancelled */}
            {c.status !== 'closed' && c.status !== 'cancelled' && (
              <form onSubmit={handleSubmitComment} className="mt-4 pt-4 border-t space-y-3">
                <textarea
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  rows={3}
                  placeholder="เพิ่มความคิดเห็น..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {(role === 'admin' || role === 'supervisor') && (
                      <label className="flex items-center gap-1.5 text-sm text-gray-500 cursor-pointer">
                        <input type="checkbox" checked={newCommentInternal} onChange={e => setNewCommentInternal(e.target.checked)} className="rounded border-gray-300" />
                        ภายใน
                      </label>
                    )}
                  </div>
                  <button type="submit" disabled={submittingComment || !newComment.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition font-medium text-sm">
                    <MessageSquare className="w-4 h-4" /> ส่งความคิดเห็น
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* ── Update Form ── */}
          {canUpdate && c.status !== 'closed' && c.status !== 'cancelled' && (
            <form onSubmit={handleSubmitUpdate} className="bg-white rounded-xl border p-5 space-y-4">
              <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide">💬 อัปเดต</h3>

              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={3}
                placeholder="พิมพ์ข้อความอัปเดต..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
              />

              {/* Update attachments preview */}
              {updatePreviews.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {updatePreviews.map((url, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-lg border overflow-hidden group">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removeUpdateFile(i)} className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 cursor-pointer transition">
                  <Paperclip className="w-4 h-4" /> แนบรูป
                  <input type="file" accept="image/*" multiple onChange={handleUpdateFiles} className="hidden" />
                </label>
                <button type="submit" disabled={submitting || (!comment.trim() && updateFiles.length === 0)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition font-medium text-sm">
                  <Send className="w-4 h-4" /> ส่งอัปเดต
                </button>
              </div>
            </form>
          )}

          {/* ── Action Row ── */}
          {canUpdate && c.status !== 'closed' && c.status !== 'cancelled' && (
            <div className="bg-white rounded-xl border p-5 space-y-3">
              {/* Change Status — full width */}
              {STATUS_FLOW[c.status].length > 0 && (
                <div className="relative">
                  <button onClick={() => setShowStatusMenu(!showStatusMenu)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm">
                    <span>{STATUS_ACTION_LABELS[c.status]}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {showStatusMenu && (
                    <div className="absolute top-full mt-1 left-0 right-0 bg-white border rounded-lg shadow-lg z-20 py-1">
                      {STATUS_FLOW[c.status]
                        .filter(s => {
                          if (s === 'cancelled') return role === 'admin' || role === 'supervisor'
                          if (s === 'responded') return role === 'admin' || role === 'vendor_staff'
                          if (role === 'vendor_staff') return false // vendor can only respond
                          return true
                        })
                        .map(s => (
                        <button key={s} type="button" onClick={() => {
                          setShowStatusMenu(false)
                          const statusMessages: Record<string, string> = {
                            responded: 'คุณต้องการตอบรับเรื่องนี้ใช่หรือไม่?',
                            in_progress: 'คุณต้องการเริ่มดำเนินการเรื่องนี้ใช่หรือไม่?',
                            on_hold: 'คุณต้องการพักการดำเนินการเรื่องนี้ใช่หรือไม่? SLA จะหยุดนับชั่วคราว',
                            resolved: 'คุณต้องการแจ้งว่าดำเนินการเสร็จสิ้นแล้วใช่หรือไม่?',
                            closed: 'คุณต้องการปิดรายการนี้ใช่หรือไม่?',
                            cancelled: 'คุณต้องการยกเลิกรายการนี้ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้',
                          }
                          setConfirmStatus({
                            newStatus: s,
                            title: STATUS_ACTION_LABELS[s],
                            message: statusMessages[s] || `เปลี่ยนสถานะเป็น ${STATUS_LABELS[s]}`,
                          })
                        }}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition flex items-center gap-2">
                          {s === 'closed' ? <CheckCircle2 className="w-4 h-4 text-green-600" /> :
                           s === 'cancelled' ? <XCircle className="w-4 h-4 text-red-500" /> :
                           s === 'on_hold' ? <PauseCircle className="w-4 h-4 text-amber-600" /> :
                           s === 'in_progress' ? <PlayCircle className="w-4 h-4 text-purple-600" /> :
                           <Clock className="w-4 h-4 text-blue-600" />}
                          {TARGET_STATUS_LABELS[s] || STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Assign Technician — secondary */}
              {canAssign && vendorStaff.length > 0 && (
                <div className="relative">
                  <button onClick={() => setShowAssign(!showAssign)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm">
                    <span className="flex items-center gap-2"><UserPlus className="w-4 h-4" /> มอบหมายช่าง</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {showAssign && (
                    <div className="absolute top-full mt-1 left-0 right-0 bg-white border rounded-lg shadow-lg z-20 py-1">
                      {vendorStaff.map(s => (
                        <button key={s.id} type="button" onClick={() => handleAssign(s.id)}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold">{getInitials(s.display_name)}</div>
                          {s.display_name}
                          {c.assigned_to === s.id && <span className="text-green-600 text-xs ml-auto">✓ ปัจจุบัน</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightboxIdx !== null && attachments[lightboxIdx] && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setLightboxIdx(null)}>
          <button className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full p-2 transition" onClick={() => setLightboxIdx(null)}><X className="w-6 h-6" /></button>
          {lightboxIdx > 0 && (
            <button className="absolute left-4 text-white hover:bg-white/20 rounded-full p-2 transition" onClick={e => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1) }}>
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}
          {lightboxIdx < attachments.length - 1 && (
            <button className="absolute right-14 text-white hover:bg-white/20 rounded-full p-2 transition" onClick={e => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1) }}>
              <ArrowLeft className="w-6 h-6 rotate-180" />
            </button>
          )}
          <img
            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/repair-attachments/${attachments[lightboxIdx].file_path}`}
            alt={attachments[lightboxIdx].file_name}
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
          <div className="absolute bottom-4 text-white text-sm">{lightboxIdx + 1} / {attachments.length} — {attachments[lightboxIdx].file_name}</div>
        </div>
      )}

      {/* Confirm Status Change Modal */}
      <ConfirmModal
        open={confirmStatus !== null}
        onOpenChange={(open) => { if (!open) setConfirmStatus(null) }}
        title={confirmStatus?.title || ''}
        message={confirmStatus?.message || ''}
        variant={confirmStatus?.newStatus === 'cancelled' ? 'danger' : 'default'}
        confirmLabel="ยืนยัน"
        onConfirm={() => {
          if (confirmStatus) changeStatus(confirmStatus.newStatus)
          setConfirmStatus(null)
        }}
      />
    </div>
  )
}