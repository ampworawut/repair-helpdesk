// Temporary script to capture LINE group ID
// Add this to your webhook handler temporarily

const { validateSignature } = require('@/lib/line');

async function temporaryGroupIdCapture(request) {
  const body = await request.text();
  const signature = request.headers.get('x-line-signature') || '';
  
  // Validate signature
  const secret = process.env.LINE_CHANNEL_SECRET || '';
  if (secret && !validateSignature(body, secret, signature)) {
    return new Response('Invalid signature', { status: 401 });
  }

  const events = JSON.parse(body).events || [];
  
  for (const event of events) {
    if (event.source.type === 'group' && event.source.groupId) {
      console.log('🎉 CAPTURED GROUP ID:', event.source.groupId);
      console.log('Event type:', event.type);
      console.log('Message:', event.message);
      
      // Store this group ID somewhere
      // You can update your database here
    }
  }

  return new Response('OK', { status: 200 });
}

// Instructions:
// 1. Temporarily replace your webhook handler with this
// 2. Send a message in LINE group
// 3. Check server logs for the group ID
// 4. Revert to original handler after capturing ID