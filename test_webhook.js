const https = require('https');

function testWebhook() {
  console.log('=== TESTING WEBHOOK ENDPOINT ===\n');

  const options = {
    hostname: 'usam-repairdesk.vercel.app',
    port: 443,
    path: '/api/line/webhook',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  };

  const req = https.request(options, (res) => {
    console.log('Status Code:', res.statusCode);
    console.log('Headers:', res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('Response:', data);
      
      if (res.statusCode === 200) {
        console.log('✅ Webhook endpoint is accessible');
      } else {
        console.log('❌ Webhook endpoint returned error:', res.statusCode);
      }
    });
  });

  req.on('error', (error) => {
    console.log('❌ Connection error:', error.message);
  });

  // Send a simple test payload
  req.write(JSON.stringify({ test: 'connection' }));
  req.end();
}

testWebhook();