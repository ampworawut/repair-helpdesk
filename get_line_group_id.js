const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function getLineGroupId() {
  console.log('=== LINE GROUP ID DETECTION ===\n');

  // Check if LINE is configured
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const secret = process.env.LINE_CHANNEL_SECRET;

  if (!token || !secret) {
    console.log('❌ LINE is not configured properly');
    console.log('Please check your .env.local file for:');
    console.log('LINE_CHANNEL_ACCESS_TOKEN');
    console.log('LINE_CHANNEL_SECRET');
    return;
  }

  console.log('✅ LINE is configured');
  console.log('Token:', token.substring(0, 20) + '...');
  console.log('Secret:', secret.substring(0, 10) + '...');

  // Instructions for getting group ID
  console.log('\n📋 HOW TO GET LINE GROUP ID:');
  console.log('1. Add your LINE bot to the group');
  console.log('2. Send any message in the group');
  console.log('3. The system will automatically detect the group ID');
  console.log('4. Check the server logs for the group ID');

  console.log('\n🔧 You can also manually get the group ID by:');
  console.log('• Using LINE Developers Console');
  console.log('• Checking network requests when adding bot to group');
  console.log('• Using LINE API to list groups');

  // Check if webhook is working
  console.log('\n🌐 Webhook URL:');
  const appUrl = process.env.NEXT_APP_URL || 'http://localhost:3000';
  console.log(`${appUrl}/api/line/webhook`);

  console.log('\n💡 After adding bot to group, send a message and check:');
  console.log('• Server console logs');
  console.log('• Database vendor_groups table');
  console.log('• LINE webhook responses');
}

getLineGroupId();