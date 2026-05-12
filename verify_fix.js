const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function verifyFix() {
  console.log('Verifying vendor groups fix...\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Test if we can insert and retrieve data with line_group_id
  console.log('1. Testing vendor group creation with line_group_id...');
  const testGroup = {
    name: 'Test Vendor Group',
    description: 'Test group after fix',
    line_group_id: 'test-line-group-123',
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
    console.log('❌ ERROR creating vendor group:', insertError.message);
    console.log('This suggests the line_group_id column is still missing or there are other issues');
    return;
  }

  console.log('✅ Vendor group created successfully:');
  console.log(`   - ID: ${newGroup.id}`);
  console.log(`   - Name: ${newGroup.name}`);
  console.log(`   - LINE Group ID: ${newGroup.line_group_id}`);
  console.log('✅ The line_group_id column exists and works correctly!');

  // Test updating the vendor group
  console.log('\n2. Testing vendor group update...');
  const { data: updatedGroup, error: updateError } = await supabase
    .from('vendor_groups')
    .update({ line_group_id: 'updated-line-group-456' })
    .eq('id', newGroup.id)
    .select('*')
    .single();

  if (updateError) {
    console.log('❌ ERROR updating vendor group:', updateError.message);
  } else {
    console.log('✅ Vendor group updated successfully:');
    console.log(`   - New LINE Group ID: ${updatedGroup.line_group_id}`);
  }

  // Clean up
  console.log('\n3. Cleaning up test data...');
  const { error: deleteError } = await supabase
    .from('vendor_groups')
    .delete()
    .eq('id', newGroup.id);

  if (deleteError) {
    console.log('⚠️ Warning: Could not clean up test data:', deleteError.message);
  } else {
    console.log('✅ Test data cleaned up successfully');
  }

  console.log('\n🎉 Vendor group creation and editing should now work correctly!');
}

verifyFix().catch(console.error);