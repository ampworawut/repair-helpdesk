const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function debugVendorGroup() {
  console.log('Debugging vendor group creation...\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Test simple vendor group creation without line_group_id
  console.log('1. Testing vendor group creation without line_group_id...');
  const testGroup = {
    name: 'Test Debug Group',
    description: 'Test group for debugging',
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

  const { data, error } = await supabase
    .from('vendor_groups')
    .insert(testGroup)
    .select('*')
    .single();

  if (error) {
    console.log('❌ ERROR:', error.message);
    console.log('Error details:', error);
    return;
  }

  console.log('✅ Successfully created vendor group:', data);

  // Clean up
  await supabase.from('vendor_groups').delete().eq('id', data.id);
  console.log('✅ Test data cleaned up');
}

debugVendorGroup().catch(console.error);