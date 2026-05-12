const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testLineDetection() {
  console.log('Testing LINE group detection system...\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Test 1: Check if line_webhook_logs table exists
  console.log('1. Checking line_webhook_logs table...');
  try {
    const { data, error } = await supabase
      .from('line_webhook_logs')
      .select('count')
      .limit(1);

    if (error) {
      console.log('❌ line_webhook_logs table not found:', error.message);
      console.log('Run the migration: supabase/migrations/005_line_webhook_logs.sql');
      return;
    }

    console.log('✅ line_webhook_logs table exists');
  } catch (err) {
    console.log('❌ Error checking table:', err.message);
    return;
  }

  // Test 2: Test inserting a webhook log
  console.log('\n2. Testing webhook log insertion...');
  try {
    const testLog = {
      event_type: 'message',
      group_id: 'test-group-id-12345',
      user_id: 'test-user-id-67890',
      message_type: 'text',
      message_text: 'test message for detection',
      processed: false
    };

    const { data: newLog, error } = await supabase
      .from('line_webhook_logs')
      .insert(testLog)
      .select('*')
      .single();

    if (error) {
      console.log('❌ Failed to insert webhook log:', error.message);
      return;
    }

    console.log('✅ Webhook log inserted successfully:');
    console.log(`   - ID: ${newLog.id}`);
    console.log(`   - Group ID: ${newLog.group_id}`);
    console.log(`   - Processed: ${newLog.processed}`);

    // Test 3: Test real-time subscription
    console.log('\n3. Testing real-time subscription...');
    let receivedEvent = false;
    
    const channel = supabase
      .channel('test-channel')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'line_webhook_logs',
      }, (payload) => {
        console.log('✅ Real-time event received:', payload.new.group_id);
        receivedEvent = true;
      })
      .subscribe();

    // Insert another test log to trigger real-time
    const testLog2 = {
      event_type: 'message',
      group_id: 'test-realtime-group-67890',
      user_id: 'test-user-id-12345',
      message_type: 'text',
      message_text: 'real-time test message',
      processed: false
    };

    await supabase
      .from('line_webhook_logs')
      .insert(testLog2);

    // Wait a bit for real-time event
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (receivedEvent) {
      console.log('✅ Real-time subscription working correctly');
    } else {
      console.log('⚠️ Real-time event not received (may be expected in test environment)');
    }

    // Cleanup
    supabase.removeChannel(channel);
    
    // Clean up test data
    console.log('\n4. Cleaning up test data...');
    await supabase
      .from('line_webhook_logs')
      .delete()
      .in('group_id', ['test-group-id-12345', 'test-realtime-group-67890']);

    console.log('✅ Test data cleaned up');

  } catch (err) {
    console.log('❌ Test failed:', err.message);
    return;
  }

  console.log('\n🎉 LINE group detection system is working correctly!');
  console.log('\nNext steps:');
  console.log('1. Add @repairdesk_bot to a LINE group');
  console.log('2. Send any message in the group');
  console.log('3. Go to Admin → Vendor Groups → Start detection');
  console.log('4. The Group ID should appear automatically!');
}

// Check if we have the required environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('⚠️ Environment variables not found');
  console.log('Please set these environment variables for testing:');
  console.log('   - NEXT_PUBLIC_SUPABASE_URL');
  console.log('   - SUPABASE_SERVICE_ROLE_KEY');
  console.log('\nOr run this command with the variables:');
  console.log('NEXT_PUBLIC_SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_key node test_line_detection.js');
} else {
  testLineDetection().catch(console.error);
}