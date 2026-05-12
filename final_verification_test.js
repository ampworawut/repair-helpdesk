const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function finalVerificationTest() {
  console.log('=== FINAL VERIFICATION TEST ===\n');

  const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Clean up any existing test cases
  await supabaseAdmin.from('repair_cases').delete().like('case_no', 'REP-26-%');

  const users = [
  { email: 'admin@test.com', password: 'password123', role: 'admin' },
  { email: 'supervisor@test.com', password: 'password123', role: 'supervisor' },
  { email: 'helpdesk@test.com', password: 'password123', role: 'helpdesk' },
  { email: 'vendor@test.com', password: 'password123', role: 'vendor_staff' }
  ];

  const results = {};

  for (const user of users) {
  console.log(`\n🔹 Testing ${user.role.toUpperCase()} Role:`);
  
  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Sign in
  const { data: authData } = await supabaseUser.auth.signInWithPassword({
    email: user.email,
    password: user.password
  });

  // Get test asset
  const { data: assets } = await supabaseAdmin.from('assets').select('*').eq('status', 'available').limit(1);
  const testAsset = assets[0];

  // Test 1: Create ticket
  console.log('   📝 Testing ticket creation...');
  const testCase = {
    asset_id: testAsset.id,
    title: `Test - ${user.role} Role`,
    description: `Created by ${user.role} user`,
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
      console.log(`   ❌ Creation failed:`, caseError.message);
      results[user.role] = { create: false, error: caseError.message };
      continue;
    } else {
      console.log(`   ✅ Created:`, newCase.case_no);
      results[user.role] = { create: true, case_no: newCase.case_no };
    }
  } catch (err) {
    console.log(`   ❌ Error:`, err.message);
    results[user.role] = { create: false, error: err.message };
    continue;
  }

  // Test 2: Read capabilities
  console.log('   📖 Testing read capabilities...');
  try {
    const { data: myCases, error: readError } = await supabaseUser
      .from('repair_cases')
      .select('count')
      .eq('created_by', authData.user.id);

    if (readError) {
      console.log(`   ❌ Read failed:`, readError.message);
      results[user.role].readOwn = false;
    } else {
      console.log(`   ✅ Can read own cases`);
      results[user.role].readOwn = true;
    }
  } catch (err) {
    console.log(`   ❌ Read error:`, err.message);
    results[user.role].readOwn = false;
  }

  // Test 3: Update capabilities
  console.log('   ✏️  Testing update capabilities...');
  try {
    const { error: updateError } = await supabaseUser
      .from('repair_cases')
      .update({ priority: 'high' })
      .eq('created_by', authData.user.id)
      .eq('case_no', results[user.role].case_no);

    if (updateError) {
      console.log(`   ❌ Update failed:`, updateError.message);
      results[user.role].update = false;
    } else {
      console.log(`   ✅ Can update own cases`);
      results[user.role].update = true;
    }
  } catch (err) {
    console.log(`   ❌ Update error:`, err.message);
    results[user.role].update = false;
  }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('🎯 FINAL TEST RESULTS');
  console.log('='.repeat(60));

  for (const [role, result] of Object.entries(results)) {
  console.log(`\n${role.toUpperCase()}:`);
  console.log(`  Create: ${result.create ? '✅' : '❌'} ${result.case_no || ''}`);
  if (result.create) {
    console.log(`  Read Own: ${result.readOwn ? '✅' : '❌'}`);
    console.log(`  Update Own: ${result.update ? '✅' : '❌'}`);
  }
  if (result.error) {
    console.log(`  Error: ${result.error}`);
  }
  }

  console.log('\n' + '='.repeat(60));
  console.log('💡 CONCLUSION:');
  
  if (results.helpdesk && results.helpdesk.create) {
  console.log('✅ HELP DESK USERS CAN NOW CREATE CASES!');
  console.log('The case number generation issue has been resolved.');
  } else {
  console.log('❌ Help desk users still cannot create cases.');
  console.log('The function may need SECURITY DEFINER permissions.');
  }
  
  console.log('='.repeat(60));
}

finalVerificationTest();