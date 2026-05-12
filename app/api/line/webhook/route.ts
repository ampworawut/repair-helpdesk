import { NextRequest, NextResponse } from 'next/server';
import { validateSignature, downloadLineImage, getVendorGroupByLineId, pushToGroup } from '@/lib/line';
import { createClient } from '@/lib/supabase-server';

// Types for webhook event (matching LINE API shape)
interface LineEvent {
  type: string;
  replyToken?: string;
  source: {
    type: 'user' | 'group' | 'room';
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  message?: {
    type: string;
    id: string;
    text?: string;
  };
  timestamp: number;
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('x-line-signature') || '';

  // Validate LINE signature
  const secret = process.env.LINE_CHANNEL_SECRET || '';
  if (secret && !validateSignature(body, secret, signature)) {
    console.warn('[LINE webhook] Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const events: LineEvent[] = JSON.parse(body).events || [];

  for (const event of events) {
    try {
      // Log the event for detection purposes
      await logWebhookEvent(event);
      await handleEvent(event);
    } catch (err) {
      console.error('[LINE webhook] Event error:', err);
    }
  }

  return NextResponse.json({ ok: true });
}

async function handleEvent(event: LineEvent) {
  // Only handle group messages
  if (event.source.type !== 'group' || !event.source.groupId) return;
  if (!event.message) return;

  const lineGroupId = event.source.groupId;
  const vendorGroup = await getVendorGroupByLineId(lineGroupId);
  if (!vendorGroup) {
    // Not a registered helpdesk group - provide guidance
    if (event.message?.type === 'text') {
      await handleUnregisteredGroup(event, lineGroupId);
    }
    return;
  }

  if (event.message.type === 'text') {
    await handleTextMessage(event, vendorGroup);
  } else if (event.message.type === 'image') {
    await handleImageMessage(event, vendorGroup.id);
  }
}

async function handleTextMessage(
  event: LineEvent,
  vendorGroup: { id: string; name: string }
) {
  const text = event.message?.text?.trim() || '';
  const supabase = createClient(true);
  const lineGroupId = event.source.groupId!;

  // Case number lookup: detect patterns like REP-26-0005, #5, or just 0005
  let caseNo: string | null = null;
  const match = text.match(/(?:REP-(\d{2})-)?0*(\d{3,5})/i);
  if (match) {
    const yy = match[1] || String(new Date().getFullYear()).slice(-2);
    const num = match[2].padStart(4, '0');
    caseNo = `REP-${yy}-${num}`;
  } else if (/^REP-/i.test(text)) {
    caseNo = text.toUpperCase();
  }

  if (caseNo) {
    const { data: caseData } = await supabase
      .from('repair_cases')
      .select('case_no, title, status, priority')
      .eq('case_no', caseNo)
      .single();

    if (caseData) {
      const statusThai: Record<string, string> = {
        pending: 'รอตอบรับ',
        responded: 'รับเรื่องแล้ว',
        in_progress: 'กำลังดำเนินการ',
        on_hold: 'พักเคส',
        resolved: 'แก้ไขแล้ว',
        closed: 'ปิดเคส',
        cancelled: 'ยกเลิก',
      };
      const reply = [
        `📋 เคส: ${caseData.case_no}`,
        `📝 ${caseData.title}`,
        `📊 สถานะ: ${statusThai[caseData.status] || caseData.status}`,
        `⚡ ความเร่งด่วน: ${caseData.priority}`,
      ].join('\n');
      await pushToGroup(lineGroupId, reply);
    } else {
      await pushToGroup(lineGroupId, `❌ ไม่พบเคส "${caseNo}" ในระบบ`);
    }
  } else {
    // Help message
    await pushToGroup(
      lineGroupId,
      [
        'พิมพ์หมายเลขเคสเพื่อดูสถานะ เช่น "0005" หรือ "REP-26-0005"',
        '📸 ส่งรูปภาพเพื่อแนบกับเคสล่าสุดของกลุ่มนี้',
      ].join('\n')
    );
  }
}

async function logWebhookEvent(event: LineEvent) {
  const supabase = createClient(true);
  
  try {
    await supabase.from('line_webhook_logs').insert({
      event_type: event.type,
      group_id: event.source.groupId,
      user_id: event.source.userId,
      message_type: event.message?.type,
      message_text: event.message?.type === 'text' ? event.message.text : null,
      processed: false
    });
  } catch (err) {
    console.error('[LINE] Failed to log webhook event:', err);
  }
}

async function handleUnregisteredGroup(event: LineEvent, lineGroupId: string) {
  const text = event.message?.text?.trim().toLowerCase() || '';
  
  if (text === '/register' || text === 'register' || text === '/detect') {
    await sendMessage(
      lineGroupId,
      'Please use the dedicated detection endpoint for registration.\n' +
      'Add @repairdesk_bot to a new group and type /register there.'
    );
  } else {
    await sendMessage(
      lineGroupId,
      '🤖 This LINE group is not yet registered with RepairDesk.\n\n' +
      'To register this group:\n' +
      '1. Make sure @repairdesk_bot is added to this group\n' +
      '2. Type /register to start registration\n\n' +
      'Or contact your administrator to manually add this group ID:\n' +
      `Group ID: ${lineGroupId}`
    );
  }
}

async function sendMessage(lineGroupId: string, text: string) {
  try {
    const { pushToGroup } = await import('@/lib/line');
    await pushToGroup(lineGroupId, text);
  } catch (err) {
    console.error('[LINE] Failed to send message to unregistered group:', err);
  }
}

async function handleImageMessage(event: LineEvent, vendorGroupId: string) {
  const msgId = event.message?.id;
  if (!msgId || !event.source.groupId) return;

  const downloaded = await downloadLineImage(msgId);
  if (!downloaded) {
    await pushToGroup(event.source.groupId, '❌ ไม่สามารถดาวน์โหลดรูปได้ กรุณาลองใหม่');
    return;
  }

  const supabase = createClient(true);

  // Find the most recent case that's not closed/cancelled for this vendor_group
  const { data: recentCase } = await supabase
    .from('repair_cases')
    .select('id, case_no')
    .not('status', 'in', '(closed,cancelled)')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!recentCase) {
    await pushToGroup(event.source.groupId, '❌ ไม่พบเคสที่เปิดอยู่เพื่อแนบรูป');
    return;
  }

  // Upload to Supabase Storage
  const ext = downloaded.contentType === 'image/png' ? 'png' : 'jpg';
  const fileName = `line-${msgId}.${ext}`;
  const filePath = `${recentCase.id}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('repair-attachments')
    .upload(filePath, downloaded.buffer, {
      contentType: downloaded.contentType,
      upsert: true,
    });

  if (uploadError) {
    console.error('[LINE] Upload error:', uploadError);
    await pushToGroup(event.source.groupId, '❌ อัปโหลดรูปไม่สำเร็จ');
    return;
  }

  // Record in DB
  await supabase.from('case_attachments').insert({
    case_id: recentCase.id,
    file_path: filePath,
    file_name: fileName,
    file_size: downloaded.buffer.length,
  });

  await pushToGroup(
    event.source.groupId,
    `📸 แนบรูปสำเร็จ → เคส ${recentCase.case_no}`
  );
}
