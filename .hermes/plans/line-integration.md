# LINE Integration Implementation Plan

> **For Hermes:** Use nextjs-fullstack-plan-execution skill to implement this plan task-by-task.

**Goal:** Add LINE Messaging API integration so vendors receive push notifications for case events and can reply/query cases via LINE group chat with image support.

**Architecture:** LINE webhook (API route) → service layer → Supabase. Outbound: hook into case create/update flows → LINE push to vendor group. Inbound: vendor texts/sends photo → webhook → download image → attach to case.

**Tech Stack:** Next.js 14 App Router, Supabase, @line/bot-sdk (npm), LINE Messaging API

**Push Strategy (within 200 free/month):**
- Case created → notify vendor group (1 push)
- Assigned to vendor → notify (1 push)  
- Resolved → notify (1 push)
- ~3 pushes/case × 30 cases = ~90/month ✅

---

### Task 1: Install LINE SDK dependencies

**Objective:** Add @line/bot-sdk and types to the project

```bash
cd /home/wwkk/repair-helpdesk
npm install @line/bot-sdk
```

**Verification:** Check `package.json` has `"@line/bot-sdk"` in dependencies

---

### Task 2: Add LINE env vars to .env.local

**Objective:** Configure LINE channel credentials

**Files:**
- Modify: `.env.local`

Add after the CRON_SECRET line:
```
# ---------- LINE Messaging API ----------
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=
```

**Verification:** Variables present in `.env.local`

---

### Task 3: Add vendor_group LINE config to database schema

**Objective:** Store LINE group ID per vendor_group so we know which group to push to

**Files:**
- Create: `supabase/migrations/003_line_config.sql`

```sql
-- ============================================
-- 003_line_config.sql
-- LINE integration: group IDs and webhook state
-- ============================================

-- ============ Alter vendor_groups: add line_group_id ============
ALTER TABLE vendor_groups ADD COLUMN line_group_id TEXT;

COMMENT ON COLUMN vendor_groups.line_group_id IS 'LINE group ID for push notifications to this vendor group';

-- ============ line_webhook_log (optional, for debugging) ============
CREATE TABLE line_webhook_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT NOT NULL,
  source_type TEXT,
  source_id   TEXT,
  message     TEXT,
  raw_payload JSONB,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE line_webhook_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY line_webhook_log_admin ON line_webhook_log FOR SELECT USING (get_user_role() = 'admin');
```

**User action:** Run this SQL in Supabase Dashboard → SQL Editor

**Verification:** Column `line_group_id` exists on `vendor_groups` table

---

### Task 4: Update TypeScript types

**Objective:** Add LINE-related types

**Files:**
- Modify: `types/index.ts`

Add at the end of the file:
```typescript
// ── LINE integration types ─────────────────────────────────────────

export interface LineWebhookEvent {
  type: 'message' | 'follow' | 'unfollow' | 'join' | 'leave' | 'memberJoined' | 'memberLeft' | 'postback';
  replyToken?: string;
  source: {
    type: 'user' | 'group' | 'room';
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  message?: {
    type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker';
    id: string;
    text?: string;
    duration?: number;
  };
  timestamp: number;
}

export interface LinePushMessage {
  type: 'text' | 'image' | 'flex';
  text?: string;
  originalContentUrl?: string;
  previewImageUrl?: string;
  altText?: string;
  contents?: any; // Flex Message JSON
}
```

Also update `VendorGroup` interface — add:
```typescript
export interface VendorGroup {
  // ... existing fields ...
  line_group_id: string | null;  // ← ADD THIS
}
```

**Verification:** No TypeScript errors

---

### Task 5: Create LINE service

**Objective:** Core business logic for LINE messaging — push, reply, image download

**Files:**
- Create: `lib/line.ts`

```typescript
import { Client, messagingApi, TextMessage } from '@line/bot-sdk';
import { createClient } from '@/lib/supabase-server';

// Lazy init — only when env vars are set
function getLineClient(): messagingApi.MessagingApiClient | null {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!token || !secret) return null;
  return new messagingApi.MessagingApiClient({
    channelAccessToken: token,
  });
}

/**
 * Push a text message to a LINE group.
 * Returns true if sent, false if not configured or failed.
 */
export async function pushToGroup(
  lineGroupId: string,
  text: string
): Promise<boolean> {
  const client = getLineClient();
  if (!client) {
    console.warn('[LINE] Client not configured, skipping push');
    return false;
  }

  try {
    const message: TextMessage = { type: 'text', text };
    await client.pushMessage({ to: lineGroupId, messages: [message] });
    return true;
  } catch (err: any) {
    console.error('[LINE] Push failed:', err?.message || err);
    return false;
  }
}

/**
 * Download image binary from LINE using messageId.
 * LINE content URLs expire — download immediately on webhook.
 */
export async function downloadLineImage(
  messageId: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const client = getLineClient();
  if (!client) return null;

  try {
    const stream = await client.getMessageContent(messageId);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return {
      buffer: Buffer.concat(chunks),
      contentType: (stream as any).headers?.['content-type'] || 'image/jpeg',
    };
  } catch (err: any) {
    console.error('[LINE] Download failed:', err?.message || err);
    return null;
  }
}

/**
 * Get vendor_group by LINE group ID.
 */
export async function getVendorGroupByLineId(
  lineGroupId: string
): Promise<{ id: string; name: string } | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('vendor_groups')
    .select('id, name')
    .eq('line_group_id', lineGroupId)
    .single();
  return data;
}

/**
 * Get LINE group IDs for a vendor_group (by vendor_group id).
 */
export async function getLineGroupForVendorGroup(
  vendorGroupId: string
): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('vendor_groups')
    .select('line_group_id')
    .eq('id', vendorGroupId)
    .single();
  return data?.line_group_id || null;
}

/**
 * Build a case notification message in Thai.
 */
export function buildCaseMessage(
  type: 'created' | 'assigned' | 'resolved',
  caseNo: string,
  title: string,
  priority: string,
  assetCode?: string,
  detailUrl?: string
): string {
  const priorityEmoji = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' } as any;
  const emoji = { created: '🆕', assigned: '👤', resolved: '✅' };

  const appUrl = process.env.NEXT_APP_URL || 'https://repair-helpdesk.vercel.app';

  let msg = `${emoji[type]} ${{
    created: 'แจ้งซ่อมใหม่',
    assigned: 'ได้รับมอบหมาย',
    resolved: 'ดำเนินการเสร็จสิ้น',
  }[type]}\n\n`;
  msg += `📋 เคส: ${caseNo}\n`;
  msg += `📝 ${title}\n`;
  msg += `${priorityEmoji[priority] || ''} ความเร่งด่วน: ${priority}\n`;
  if (assetCode) msg += `💻 อุปกรณ์: ${assetCode}\n`;
  if (detailUrl) msg += `\n🔗 ${detailUrl}\n`;

  return msg;
}
```

**Verification:** No TypeScript errors on build

---

### Task 6: Create Supabase server client

**Objective:** Server-side Supabase client for service layer

**Files:**
- Create: `lib/supabase-server.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

export function createClient(useServiceRole = false) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    useServiceRole
      ? process.env.SUPABASE_SERVICE_ROLE_KEY!
      : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Verification:** File created, imports correctly

---

### Task 7: Create LINE webhook API route

**Objective:** Receive LINE webhook events — text queries and image uploads

**Files:**
- Create: `app/api/line/webhook/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validateSignature } from '@line/bot-sdk';
import {
  downloadLineImage,
  getVendorGroupByLineId,
  pushToGroup,
} from '@/lib/line';
import { createClient } from '@/lib/supabase-server';
import { LineWebhookEvent } from '@/types';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('x-line-signature') || '';

  // Validate LINE signature
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (secret && !validateSignature(body, secret, signature)) {
    console.warn('[LINE webhook] Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const events: LineWebhookEvent[] = JSON.parse(body).events || [];

  for (const event of events) {
    try {
      await handleEvent(event);
    } catch (err) {
      console.error('[LINE webhook] Event error:', err);
    }
  }

  return NextResponse.json({ ok: true });
}

async function handleEvent(event: LineWebhookEvent) {
  // Only handle group messages
  if (event.source.type !== 'group' || !event.source.groupId) return;

  const lineGroupId = event.source.groupId;
  const vendorGroup = await getVendorGroupByLineId(lineGroupId);
  if (!vendorGroup) return; // Not a registered helpdesk group

  if (event.type === 'message' && event.message) {
    if (event.message.type === 'text') {
      await handleTextMessage(event, vendorGroup.id);
    } else if (event.message.type === 'image') {
      await handleImageMessage(event, vendorGroup.id);
    }
  }
}

async function handleTextMessage(event: LineWebhookEvent, vendorGroupId: string) {
  const text = event.message?.text?.trim() || '';
  const supabase = createClient(true); // service role for full access

  // Try case number lookup: detect pattern like REP-26-0005 or #5
  const caseMatch = text.match(/(?:REP-\d{2}-)?0*(\d{4,5})/i);
  let caseNo = '';
  if (caseMatch) {
    caseNo = caseMatch[1].length <= 4
      ? `REP-${String(new Date().getFullYear()).slice(-2)}-${caseMatch[1].padStart(4, '0')}`
      : text.toUpperCase();
  } else if (/^REP-/i.test(text)) {
    caseNo = text.toUpperCase();
  }

  if (caseNo) {
    // Look up case
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
      const reply = `📋 ${caseData.case_no}\n📝 ${caseData.title}\n📊 สถานะ: ${statusThai[caseData.status] || caseData.status}\n⚡ ความเร่งด่วน: ${caseData.priority}`;
      await pushToGroup(event.source.groupId!, reply);
    } else {
      await pushToGroup(event.source.groupId!, `❌ ไม่พบเคส ${caseNo}`);
    }
  } else {
    // Help text
    await pushToGroup(
      event.source.groupId!,
      `พิมพ์หมายเลขเคสเพื่อดูสถานะ เช่น "0005" หรือ "REP-26-0005"\n📸 ส่งรูปภาพเพื่อแนบกับเคสล่าสุด`
    );
  }
}

async function handleImageMessage(event: LineWebhookEvent, vendorGroupId: string) {
  const msgId = event.message?.id;
  if (!msgId || !event.source.groupId) return;

  const downloaded = await downloadLineImage(msgId);
  if (!downloaded) return;

  const supabase = createClient(true);

  // Find the most recent case for this vendor_group
  const { data: recentCase } = await supabase
    .from('repair_cases')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!recentCase) return;

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
    return;
  }

  // Record attachment in DB
  await supabase.from('case_attachments').insert({
    case_id: recentCase.id,
    file_path: filePath,
    file_name: fileName,
    file_size: downloaded.buffer.length,
  });

  // Notify group
  await pushToGroup(
    event.source.groupId!,
    `📸 รูปภาพถูกแนบกับเคส ${recentCase.id.slice(0, 8)}... เรียบร้อยแล้ว`
  );
}
```

**Verification:** Route exists, compiles without errors

---

### Task 8: Create notification dispatch service

**Objective:** Single point for sending LINE notifications when case status changes

**Files:**
- Create: `lib/notifications.ts`

```typescript
import { createClient } from '@/lib/supabase-server';
import { getLineGroupForVendorGroup, buildCaseMessage, pushToGroup } from '@/lib/line';

/**
 * Notify the vendor's LINE group about a case event.
 * Finds vendor via asset → vendor → vendor_group → line_group_id chain.
 */
export async function notifyCaseEvent(
  caseId: string,
  eventType: 'created' | 'assigned' | 'resolved'
): Promise<void> {
  try {
    const supabase = createClient(true);

    // Get case + asset + vendor + vendor_group in one query
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

    if (!caseData) return;

    const vendor = (caseData.asset as any)?.vendor;
    if (!vendor?.group_id) return;

    const lineGroupId = await getLineGroupForVendorGroup(vendor.group_id);
    if (!lineGroupId) return;

    const appUrl = process.env.NEXT_APP_URL || 'https://repair-helpdesk.vercel.app';
    const detailUrl = `${appUrl}/cases/${caseId}`;

    const message = buildCaseMessage(
      eventType,
      caseData.case_no,
      caseData.title,
      caseData.priority,
      (caseData.asset as any)?.asset_code,
      detailUrl
    );

    const sent = await pushToGroup(lineGroupId, message);
    if (sent) {
      console.log(`[LINE] Notified ${eventType} for ${caseData.case_no} to group ${lineGroupId}`);
    }
  } catch (err) {
    console.error('[LINE] notifyCaseEvent error:', err);
  }
}
```

**Verification:** No TypeScript errors

---

### Task 9: Hook notifications into case creation

**Objective:** Fire LINE push when a case is created

**Files:**
- Modify: `app/cases/new/page.tsx`

After the case insert succeeds (in the `handleSubmit` function), add:

```typescript
// After: const newCase = data[0];
// Add:
fetch('/api/notify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ caseId: newCase.id, event: 'created' }),
}).catch(() => {});
```

**Verification:** Case creation triggers LINE notification (when LINE configured)

---

### Task 10: Hook notifications into case status updates

**Objective:** Fire LINE push on status changes from case detail page

**Files:**
- Modify: `app/cases/[id]/page.tsx`

Find the status update function and add after status change + activity log:
```typescript
// After status update succeeds:
const notifyEvents: string[] = [];
if (newStatus === 'resolved') notifyEvents.push('resolved');
if (newStatus === 'in_progress' && c.status === 'responded') notifyEvents.push('assigned');

for (const event of notifyEvents) {
  fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseId: c.id, event }),
  }).catch(() => {});
}
```

**Verification:** Status change triggers LINE notification for resolved/assigned

---

### Task 11: Create /api/notify route

**Objective:** Server-side API to trigger notifications (called from client components)

**Files:**
- Create: `app/api/notify/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { notifyCaseEvent } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  const { caseId, event } = await request.json();

  if (!caseId || !['created', 'assigned', 'resolved'].includes(event)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
  }

  // Verify caller owns this case or is admin
  const supabase = createClient();
  // In production, add proper auth check here

  await notifyCaseEvent(caseId, event);

  return NextResponse.json({ ok: true });
}
```

**Verification:** Route compiles and accessible

---

### Task 12: Update vendor-groups admin page with LINE group ID field

**Objective:** Let admin set LINE group ID per vendor group

**Files:**
- Modify: `app/admin/vendor-groups/page.tsx`

Add a field for `line_group_id` in the create/edit form. The `line_group_id` is obtained by adding the LINE Official Account bot to the target LINE group, then sending a message — the webhook captures the `groupId`.

Add to the form:
```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    LINE Group ID
  </label>
  <input
    type="text"
    value={form.line_group_id || ''}
    onChange={e => setForm(f => ({ ...f, line_group_id: e.target.value }))}
    placeholder="ได้จากการเพิ่มบอทเข้ากลุ่ม LINE แล้วส่งข้อความ"
    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
  />
  <p className="text-xs text-gray-400 mt-1">
    เพิ่ม @repairdesk_bot เข้ากลุ่ม LINE → ส่งข้อความใดๆ → นำ Group ID จาก Webhook Log มาใส่ที่นี่
  </p>
</div>
```

**Verification:** Admin can input and save line_group_id per vendor_group

---

### Task 13: Set LINE webhook URL on LINE Developer Console

**User action:** In LINE Developers Console, set webhook URL to:
```
https://repair-helpdesk.vercel.app/api/line/webhook
```

Also verify the bot is added to the target LINE groups.

---

### Task 14: Build, test, and deploy

```bash
cd /home/wwkk/repair-helpdesk
npm run build
git add -A
git commit -m "feat: LINE Messaging API integration for case notifications"
git push
```

**Verification:** Build passes, Vercel auto-deploys

---

### Environment Variables (to set on Vercel)

Go to Vercel Dashboard → Settings → Environment Variables and add:
- `LINE_CHANNEL_ACCESS_TOKEN` — from LINE Developers Console
- `LINE_CHANNEL_SECRET` — from LINE Developers Console

---

### Testing Checklist

1. [ ] Add bot to LINE test group, send a message → webhook captures groupId
2. [ ] Set `line_group_id` in vendor_groups admin page
3. [ ] Create a test case → LINE group receives notification
4. [ ] Reply with case number in LINE group → bot responds with status
5. [ ] Send an image → attached to most recent case
6. [ ] Change case to resolved → LINE group notified
