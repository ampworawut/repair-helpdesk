const { createClient } = require('@supabase/supabase-js');

// Test the live site by checking if we can connect to the production Supabase
async function testLiveSite() {
  console.log('Testing connection to live RepairDesk site...\n');

  // These would be the production environment variables set in Vercel
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log('❌ Missing Supabase environment variables');
    console.log('Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set');
    return;
  }

  console.log('Supabase URL:', supabaseUrl);
  console.log('Testing connection...');

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Test 1: Basic connection test
  try {
    const { data, error } = await supabase.from('vendor_groups').select('count').limit(1);
    
    if (error) {
      console.log('❌ Connection test failed:', error.message);
      return;
    }

    console.log('✅ Connected to Supabase successfully');
  } catch (err) {
    console.log('❌ Connection test failed:', err.message);
    return;
  }

  // Test 2: Check if line_group_id column exists
  console.log('\n2. Checking if line_group_id column exists...');
  try {
    // Try to create a test vendor group with line_group_id
    const testGroup = {
      name: 'Live Site Test Group',
      description: 'Test group for live site verification',
      line_group_id: 'live-test-line-group',
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
    };

    const { data: newGroup, error: insertError } = await supabase
      .from('vendor_groups')
      .insert(testGroup)
      .select('*')
      .single();

    if (insertError) {
      console.log('❌ Vendor group creation failed:', insertError.message);
      
      if (insertError.message.includes('column "line_group_id" does not exist')) {
        console.log('\n🔧 ACTION REQUIRED:');
        console.log('The line_group_id column is still missing from the production database.');
        console.log('Run this SQL in your Supabase production database:');
        console.log('\nALTER TABLE vendor_groups ADD COLUMN IF NOT EXISTS line_group_id TEXT;');
        console.log('CREATE INDEX IF NOT EXISTS idx_vendor_groups_line_group_id ON vendor_groups(line_group_id);');
      }
      return;
    }

    console.log('✅ Vendor group created successfully with line_group_id!');
    console.log(`   - ID: ${newGroup.id}`);
    console.log(`   - Name: ${newGroup.name}`);
    console.log(`   - LINE Group ID: ${newGroup.line_group_id}`);

    // Clean up
    console.log('\n3. Cleaning up test data...');
    const { error: deleteError } = await supabase
      .from('vendor_groups')
      .delete()
      .eq('id', newGroup.id);

    if (deleteError) {
      console.log('⚠️ Warning: Could not clean up test data:', deleteError.message);
    } else {
      console.log('✅ Test data cleaned up');
    }

    console.log('\n🎉 Live site vendor group functionality is working correctly!');
    console.log('You can now create vendor groups with LINE integration on your live site.');

  } catch (err) {
    console.log('❌ Unexpected error:', err.message);
  }
}

// Check if we have the required environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.log('⚠️  Environment variables not found');
  console.log('Please set these environment variables for testing:');
  console.log('   - NEXT_PUBLIC_SUPABASE_URL');
  console.log('   - NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.log('\nOr run this command with the variables:');
  console.log('NEXT_PUBLIC_SUPABASE_URL=your_url NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key node test_live_site.js');
} else {
  testLiveSite().catch(console.error);
}