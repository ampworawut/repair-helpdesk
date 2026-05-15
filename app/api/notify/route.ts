import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { notifyCaseEvent, notifyBulkCaseCreated } from '@/lib/notifications';
import { LineNotifyEvent } from '@/types';

const VALID_EVENTS: LineNotifyEvent[] = [
  'case_created', 'case_assigned', 'case_in_progress', 'case_on_hold',
  'case_resolved', 'case_closed', 'case_cancelled',
  'new_comment', 'new_attachment',
  'sla_warning', 'sla_breached', 'confirmation_requested',
];

export async function POST(request: NextRequest) {
  // Auth check
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  );
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { caseId, caseIds, event } = body;

    // Bulk case creation
    if (caseIds && Array.isArray(caseIds) && event === 'case_created_bulk') {
      const result = await notifyBulkCaseCreated(caseIds);
      return NextResponse.json({ ok: true, sent: result.sent, reason: result.reason });
    }

    if (!caseId || !VALID_EVENTS.includes(event)) {
      return NextResponse.json(
        { error: 'Invalid params. Required: caseId (UUID), event (LineNotifyEvent)' },
        { status: 400 }
      );
    }

    const result = await notifyCaseEvent(caseId, event);

    return NextResponse.json({
      ok: true,
      sent: result.sent,
      reason: result.reason,
    });
  } catch (err: any) {
    console.error('[API] /notify error:', err);
    return NextResponse.json(
      { error: 'Internal error', detail: err?.message },
      { status: 500 }
    );
  }
}
