import { messagingApi, HTTPFetchError } from '@line/bot-sdk';

function getAccessToken(): string | null {
  return process.env.LINE_CHANNEL_ACCESS_TOKEN || null;
}

function getLineClient(): messagingApi.MessagingApiClient | null {
  const token = getAccessToken();
  if (!token) return null;
  return new messagingApi.MessagingApiClient({ channelAccessToken: token });
}

/**
 * Push a text message to a LINE group.
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
    await client.pushMessage({
      to: lineGroupId,
      messages: [{ type: 'text', text }],
    });
    console.log(`[LINE] Push OK → ${lineGroupId} (${text.slice(0, 60)}...)`);
    return true;
  } catch (err: any) {
    const msg = err instanceof HTTPFetchError
      ? JSON.stringify(err.body).slice(0, 200)
      : err?.message || String(err);
    console.error(`[LINE] Push FAILED → ${lineGroupId}: ${msg}`);
    return false;
  }
}

/**
 * Download image binary from LINE using messageId.
 * Uses direct HTTPS fetch since getMessageContent is not on MessagingApiClient.
 */
export async function downloadLineImage(
  messageId: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const token = getAccessToken();
  if (!token) return null;

  try {
    const https = await import('https');
    const url = `https://api-data.line.me/v2/bot/message/${messageId}/content`;

    const response = await new Promise<{
      statusCode: number;
      headers: Record<string, string>;
      chunks: Buffer[];
    }>((resolve, reject) => {
      https.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      }, (res) => {
        if (res.statusCode !== 200) {
          // consume body to free socket
          res.resume();
          reject(new Error(`LINE content API returned ${res.statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve({
          statusCode: res.statusCode!,
          headers: res.headers as Record<string, string>,
          chunks,
        }));
        res.on('error', reject);
      }).on('error', reject);
    });

    return {
      buffer: Buffer.concat(response.chunks),
      contentType: response.headers['content-type'] || 'image/jpeg',
    };
  } catch (err: any) {
    console.error('[LINE] Image download failed:', err?.message || err);
    return null;
  }
}

/**
 * Get vendor_group by LINE group ID.
 */
export async function getVendorGroupByLineId(
  lineGroupId: string
): Promise<{ id: string; name: string } | null> {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = createClient();
  const { data } = await supabase
    .from('vendor_groups')
    .select('id, name')
    .eq('line_group_id', lineGroupId)
    .single();
  return data;
}

/**
 * Validate LINE webhook signature.
 */
export function validateSignature(
  body: string,
  secret: string,
  signature: string
): boolean {
  if (!secret) return true;
  try {
    const { validateSignature: vs } = require('@line/bot-sdk');
    return vs(body, secret, signature);
  } catch {
    return true;
  }
}
