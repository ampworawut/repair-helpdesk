import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { validateSignature } from '@/lib/line';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('x-line-signature') || '';

  // Validate LINE signature
  const secret = process.env.LINE_CHANNEL_SECRET || '';
  if (secret && !validateSignature(body, secret, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const events = JSON.parse(body).events || [];

  for (const event of events) {
    try {
      await handleDetectionEvent(event);
    } catch (err) {
      console.error('[LINE detect] Event error:', err);
    }
  }

  return NextResponse.json({ ok: true });
}

async function handleDetectionEvent(event: any) {
  // Only handle group messages
  if (event.source.type !== 'group' || !event.source.groupId) return;
  if (!event.message || event.message.type !== 'text') return;

  const lineGroupId = event.source.groupId;
  const text = event.message.text.trim().toLowerCase();
  const supabase = createClient(true);

  // Check if this group is already registered
  const { data: existingGroup } = await supabase
    .from('vendor_groups')
    .select('id, name')
    .eq('line_group_id', lineGroupId)
    .single();

  if (existingGroup) {
    // Group already registered, no action needed
    return;
  }

  // Handle detection commands
  if (text === '/register' || text === 'register' || text === '/detect') {
    await handleRegisterCommand(lineGroupId, supabase);
  } else if (text === '/help' || text === 'help') {
    await sendHelpMessage(lineGroupId);
  }
}

async function handleRegisterCommand(lineGroupId: string, supabase: any) {
  // Create a temporary vendor group for detection
  const groupName = `LINE Group ${lineGroupId.slice(-8)}`;
  
  const { data: newGroup, error } = await supabase
    .from('vendor_groups')
    .insert({
      name: groupName,
      description: 'Auto-detected LINE group',
      line_group_id: lineGroupId,
      line_notify_config: {
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
        confirmation_requested: true
      }
    })
    .select('*')
    .single();

  if (error) {
    console.error('[LINE] Registration failed:', error);
    await sendMessage(lineGroupId, '❌ Registration failed. Please try again or contact admin.');
    return;
  }

  await sendMessage(
    lineGroupId,
    `✅ Group registered successfully!\n` +
    `Group ID: ${lineGroupId}\n` +
    `Please complete setup in the admin panel:\n` +
    `1. Go to Admin → Vendor Groups\n` +
    `2. Find "${groupName}"\n` +
    `3. Update the name and configure notifications`
  );
}

async function sendHelpMessage(lineGroupId: string) {
  await sendMessage(
    lineGroupId,
    `🤖 RepairDesk LINE Bot Help\n\n` +
    `Available commands:\n` +
    `• /register - Register this group\n` +
    `• /help - Show this help\n\n` +
    `After registration:\n` +
    `• Type case numbers to check status\n` +
    `• Send images to attach to cases`
  );
}

async function sendMessage(lineGroupId: string, text: string) {
  try {
    const { pushToGroup } = await import('@/lib/line');
    await pushToGroup(lineGroupId, text);
  } catch (err) {
    console.error('[LINE] Failed to send message:', err);
  }
}