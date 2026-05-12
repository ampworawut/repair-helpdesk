const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function comprehensiveRoleTest() {
  console.log('=== Comprehensive Role-Based Access Control Test ===\n');

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 1. Assign vendor to vendor_staff user
  console.log('1. Assigning vendor to vendor_staff user...');
  const { data: vendorStaff } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .eq('email', 'vendor@test.com')
    .single();

  // Use the first vendor
  const { data: vendors } = await supabaseAdmin.from('vendors').select('*').limit(1);
  const vendorId = vendors[0].id;

  await supabaseAdmin
    .from('user_profiles')
    .update({ vendor_id: vendorId })
    .eq('id', vendorStaff.id);

  console.log('✅ Vendor assigned to vendor_staff user');

  // 2. Get test asset that belongs to this vendor
  console.log('2. Finding test asset...');
  const { data: assets } = await supabaseAdmin
    .from('assets')
    .select('*')
    .eq('vendor_id', vendorId)
    .eq('status', 'available')
    .limit(1);

  const testAsset = assets[0];
  if (!testAsset) {
    console.log('❌ No available assets for this vendor');
    return;
  }
  console.log('✅ Test asset found:', testAsset.asset_code);

  // 3. Test each user role
  const users = [
    { email: 'admin@test.com', password: 'password123', role: 'admin' },
    { email: 'supervisor@test.com', password: 'password123', role: 'supervisor' },
    { email: 'helpdesk@test.com', password: 'password123', role: 'helpdesk' },
    { email: 'vendor@test.com', password: 'password123', role: 'vendor_staff' }
  ];

  for (const user of users) {
    console.log(`\n=== Testing ${user.role.toUpperCase()} Role ===`);
    
    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Sign in
    const { data: authData, error: authError } = await supabaseUser.auth.signInWithPassword({
      email: user.email,
      password: user.password
    });

    if (authError) {
      console.log(`❌ Sign in failed:`, authError.message);
      continue;
    }

    // Test 1: Create ticket
    console.log('   Testing ticket creation...');
    const testCase = {
      asset_id: testAsset.id,
      title: `Test Ticket - ${user.role} Role`,
      description: `Created by ${user.role} user for testing`,
      priority: 'medium',
      service_location: 'Test Location',
      created_by: authData.user.id
    };

    try {
      const { data: newCase, error: caseError } = await supabaseUser
        .from('repair_cases')
        .insert(testCase)
        .select('*')
        .single();

      if (caseError) {
        console.log(`   ❌ Ticket creation failed:`, caseError.message);
      } else {
        console.log(`   ✅ Ticket created:`, newCase.case_no);
        
        // Test 2: Read own ticket
        const { data: readCase, error: readError } = await supabaseUser
          .from('repair_cases')
          .select('*')
          .eq('id', newCase.id)
          .single();

        if (readError) {
          console.log(`   ❌ Cannot read own ticket:`, readError.message);
        } else {
          console.log(`   ✅ Can read own ticket`);
        }

        // Test 3: Try to read all tickets (should be restricted for some roles)
        const { data: allCases, error: allError } = await supabaseUser
          .from('repair_cases')
          .select('count')
          .limit(5);

        if (allError) {
          console.log(`   🔒 Cannot read all tickets (expected for ${user.role}):`, allError.message);
        } else {
          console.log(`   🔓 Can read all tickets (${allCases.length} cases)`);
        }

        // Test 4: Try to update ticket
        const { error: updateError } = await supabaseUser
          .from('repair_cases')
          .update({ priority: 'high' })
          .eq('id', newCase.id);

        if (updateError) {
          console.log(`   🔒 Cannot update ticket (expected for some roles):`, updateError.message);
        } else {
          console.log(`   🔓 Can update ticket`);
        }
      }
    } catch (err) {
      console.log(`   ❌ Error:`, err.message);
    }
  }

  console.log('\n=== Test Complete ===');
}

comprehensiveRoleTest();