const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testVendorGroupCreation() {
  console.log('Testing vendor group creation...\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Test 1: Check if vendor_groups table has line_group_id column
  console.log('1. Checking vendor_groups table structure...');
  const { data: tableInfo } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable')
    .eq('table_name', 'vendor_groups')
    .order('ordinal_position');

  console.log('Vendor groups table columns:');
  tableInfo.forEach(col => {
    console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
  });

  const hasLineGroupId = tableInfo.some(col => col.column_name === 'line_group_id');
  console.log(`\nHas line_group_id column: ${hasLineGroupId}`);

  if (!hasLineGroupId) {
    console.log('❌ ERROR: line_group_id column is missing from vendor_groups table');
    console.log('Run the migration: supabase/migrations/004_line_group_id.sql');
    return;
  }

  // Test 2: Try to create a vendor group
  console.log('\n2. Testing vendor group creation...');
  const testGroup = {
    name: 'Test Vendor Group',
    description: 'Test group for verification',
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

  const { data: newGroup, error } = await supabase
    .from('vendor_groups')
    .insert(testGroup)
    .select('*')
    .single();

  if (error) {
    console.log('❌ ERROR creating vendor group:', error.message);
    return;
  }

  console.log('✅ Vendor group created successfully:');
  console.log(`   - ID: ${newGroup.id}`);
  console.log(`   - Name: ${newGroup.name}`);
  console.log(`   - LINE Group ID: ${newGroup.line_group_id}`);
  console.log(`   - Notify Config: ${JSON.stringify(newGroup.line_notify_config)}`);

  // Test 3: Clean up
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

  console.log('\n✅ All tests passed! Vendor group creation should work correctly.');
}

testVendorGroupCreation().catch(console.error);