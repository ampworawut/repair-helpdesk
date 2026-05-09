import { createClient } from '@/lib/supabase-server';
import { LineNotifyEvent, LineNotifyConfig } from '@/types';

const DEFAULT_CONFIG: LineNotifyConfig = {
  case_created: true,
  case_assigned: true,
  case_in_progress: false,
  case_on_hold: false,
  case_resolved: true,
  case_closed: true,
  case_cancelled: false,
  new_comment: false,
  new_attachment: false,
  sla_warning: true,
  sla_breached: true,
  confirmation_requested: true,
};

/**
 * Check if a notify event is enabled for this vendor_group.
 * Reads line_notify_config from vendor_groups table.
 */
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

  // No LINE group linked → skip
  if (!data?.line_group_id) return false;

  const config = (data.line_notify_config || DEFAULT_CONFIG) as LineNotifyConfig;
  return config[event] !== false; // default true if key missing
}

/**
 * Get LINE group ID for a vendor_group.
 */
async function getLineGroupId(vendorGroupId: string): Promise<string | null> {
  const supabase = createClient(true);
  const { data } = await supabase
    .from('vendor_groups')
    .select('line_group_id')
    .eq('id', vendorGroupId)
    .single();
  return data?.line_group_id || null;
}

/**
 * Find the vendor_group for a case via asset → vendor → group chain.
 */
async function getVendorGroupForCase(
  caseId: string
): Promise<{ groupId: string; groupName: string } | null> {
  const supabase = createClient(true);
  const { data: caseData } = await supabase
    .from('repair_cases')
    .select(`
      asset:asset_id (
        vendor:vendor_id (
          group_id,
          vendor_group:group_id ( name )
        )
      )
    `)
    .eq('id', caseId)
    .single();

  const group = (caseData as any)?.asset?.vendor?.vendor_group;
  const groupId = (caseData as any)?.asset?.vendor?.group_id;
  if (!group || !groupId) return null;

  return { groupId, groupName: group.name };
}

/**
 * Build a Thai notification message for a case event.
 */
function buildMessage(
  event: LineNotifyEvent,
  caseNo: string,
  title: string,
  priority: string,
  assetCode?: string,
  detailUrl?: string
): string {
  const emoji: Record<string, string> = {
    case_created: '🆕',
    case_assigned: '👤',
    case_in_progress: '🔧',
    case_on_hold: '⏸️',
    case_resolved: '✅',
    case_closed: '🔒',
    case_cancelled: '❌',
    new_comment: '💬',
    new_attachment: '📸',
    sla_warning: '⚠️',
    sla_breached: '🚨',
    confirmation_requested: '✋',
  };

  const label: Record<string, string> = {
    case_created: 'แจ้งซ่อมใหม่',
    case_assigned: 'ได้รับมอบหมาย',
    case_in_progress: 'เริ่มดำเนินการ',
    case_on_hold: 'พักเคส',
    case_resolved: 'ดำเนินการเสร็จสิ้น',
    case_closed: 'ปิดเคส',
    case_cancelled: 'ยกเลิกเคส',
    new_comment: 'ความคิดเห็นใหม่',
    new_attachment: 'แนบไฟล์ใหม่',
    sla_warning: '⚠️ SLA ใกล้ถึงกำหนด',
    sla_breached: '🚨 เกิน SLA แล้ว',
    confirmation_requested: 'รอยืนยันการแก้ไข',
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

/**
 * Main dispatch: notify vendor group about a case event.
 * Checks config, builds message, sends via LINE (when configured).
 */
export async function notifyCaseEvent(
  caseId: string,
  event: LineNotifyEvent
): Promise<{ sent: boolean; reason?: string }> {
  try {
    const supabase = createClient(true);

    // Get case data
    const { data: caseData } = await supabase
      .from('repair_cases')
      .select(`
        case_no, title, priority,
        asset:asset_id (
          asset_code,
          vendor:vendor_id (
            group_id
          )
        )
      `)
      .eq('id', caseId)
      .single();

    if (!caseData) return { sent: false, reason: 'Case not found' };

    const vendor = (caseData.asset as any)?.vendor;
    if (!vendor?.group_id) return { sent: false, reason: 'No vendor group' };

    // Check if event is enabled
    const enabled = await isEventEnabled(vendor.group_id, event);
    if (!enabled) return { sent: false, reason: `Event ${event} is disabled for this group` };

    // Get LINE group ID
    const lineGroupId = await getLineGroupId(vendor.group_id);
    if (!lineGroupId) return { sent: false, reason: 'No LINE group configured' };

    // Build message
    const appUrl = process.env.NEXT_APP_URL || 'https://repair-helpdesk.vercel.app';
    const message = buildMessage(
      event,
      caseData.case_no,
      caseData.title,
      caseData.priority,
      (caseData.asset as any)?.asset_code,
      `${appUrl}/cases/${caseId}`
    );

    // TODO: Send via LINE when SDK is installed
    // await pushToGroup(lineGroupId, message);
    console.log(`[NOTIFY] Would send to LINE group ${lineGroupId}: ${event} for ${caseData.case_no}`);
    console.log(`[NOTIFY] Message: ${message}`);

    return { sent: true };
  } catch (err: any) {
    console.error('[NOTIFY] Error:', err?.message || err);
    return { sent: false, reason: err?.message };
  }
}

export { DEFAULT_CONFIG };
export type { LineNotifyConfig };
