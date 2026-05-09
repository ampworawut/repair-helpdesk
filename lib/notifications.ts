import { createClient } from '@/lib/supabase-server';
import { pushToGroup } from '@/lib/line';
import { DEFAULT_LINE_NOTIFY_CONFIG } from '@/lib/notify-config';
import { LineNotifyEvent, LineNotifyConfig } from '@/types';

async function isEventEnabled(
  vendorGroupId: string,
  event: LineNotifyEvent
): Promise<boolean> {
  const supabase = createClient(true);
  const { data } = await supabase
    .from('vendor_groups')
    .select('line_notify_config, line_group_id')
    .eq('id', vendorGroupId)
    .single();

  if (!data?.line_group_id) return false;

  const config = (data.line_notify_config || DEFAULT_LINE_NOTIFY_CONFIG) as LineNotifyConfig;
  return config[event] !== false;
}

async function getLineGroupId(vendorGroupId: string): Promise<string | null> {
  const supabase = createClient(true);
  const { data } = await supabase
    .from('vendor_groups')
    .select('line_group_id')
    .eq('id', vendorGroupId)
    .single();
  return data?.line_group_id || null;
}

function buildMessage(
  event: LineNotifyEvent,
  caseNo: string,
  title: string,
  priority: string,
  assetCode?: string,
  detailUrl?: string
): string {
  const emoji: Record<string, string> = {
    case_created: '🆕', case_assigned: '👤', case_in_progress: '🔧',
    case_on_hold: '⏸️', case_resolved: '✅', case_closed: '🔒',
    case_cancelled: '❌', new_comment: '💬', new_attachment: '📸',
    sla_warning: '⚠️', sla_breached: '🚨', confirmation_requested: '✋',
  };

  const label: Record<string, string> = {
    case_created: 'แจ้งซ่อมใหม่', case_assigned: 'ได้รับมอบหมาย',
    case_in_progress: 'เริ่มดำเนินการ', case_on_hold: 'พักเคส',
    case_resolved: 'ดำเนินการเสร็จสิ้น', case_closed: 'ปิดเคส',
    case_cancelled: 'ยกเลิกเคส', new_comment: 'ความคิดเห็นใหม่',
    new_attachment: 'แนบไฟล์ใหม่', sla_warning: '⚠️ SLA ใกล้ถึงกำหนด',
    sla_breached: '🚨 เกิน SLA แล้ว', confirmation_requested: 'รอยืนยันการแก้ไข',
  };

  const priorityEmoji: Record<string, string> = {
    low: '🟢', medium: '🟡', high: '🟠', critical: '🔴'
  };

  let msg = `${emoji[event] || ''} ${label[event] || event}\n\n`;
  msg += `📋 เคส: ${caseNo}\n`;
  msg += `📝 ${title}\n`;
  msg += `${priorityEmoji[priority] || ''} ความเร่งด่วน: ${priority}\n`;
  if (assetCode) msg += `💻 อุปกรณ์: ${assetCode}\n`;
  if (detailUrl) msg += `\n🔗 ดูรายละเอียด: ${detailUrl}\n`;

  return msg;
}

export async function notifyCaseEvent(
  caseId: string,
  event: LineNotifyEvent
): Promise<{ sent: boolean; reason?: string }> {
  try {
    const supabase = createClient(true);

    const { data: caseData } = await supabase
      .from('repair_cases')
      .select(`
        case_no, title, priority,
        asset:asset_id (
          asset_code,
          vendor:vendor_id ( group_id )
        )
      `)
      .eq('id', caseId)
      .single();

    if (!caseData) return { sent: false, reason: 'Case not found' };

    const vendor = (caseData.asset as any)?.vendor;
    if (!vendor?.group_id) return { sent: false, reason: 'No vendor group' };

    const enabled = await isEventEnabled(vendor.group_id, event);
    if (!enabled) return { sent: false, reason: `Event ${event} disabled` };

    const lineGroupId = await getLineGroupId(vendor.group_id);
    if (!lineGroupId) return { sent: false, reason: 'No LINE group configured' };

    const appUrl = process.env.NEXT_APP_URL || 'https://repair-helpdesk.vercel.app';
    const message = buildMessage(
      event, caseData.case_no, caseData.title, caseData.priority,
      (caseData.asset as any)?.asset_code, `${appUrl}/cases/${caseId}`
    );

    const sent = await pushToGroup(lineGroupId, message);
    return { sent, reason: sent ? undefined : 'LINE push failed' };
  } catch (err: any) {
    console.error('[NOTIFY] Error:', err?.message || err);
    return { sent: false, reason: err?.message };
  }
}
