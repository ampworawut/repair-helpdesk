const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function finalComprehensiveTest() {
  console.log('=== FINAL COMPREHENSIVE ROLE-BASED ACCESS CONTROL TEST ===\n');

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

  const testResults = {};

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
      title: `Test Ticket - ${user.role} Role`,
      description: `Created by ${user.role} user for final testing`,
      priority: 'medium',
      service_location: 'Test Location',
      created_by: authData.user.id
    };

    let createdCase = null;
    try {
      const { data: newCase, error: caseError } = await supabaseUser
        .from('repair_cases')
        .insert(testCase)
        .select('*')
        .single();

      if (caseError) {
        console.log(`   ❌ Ticket creation failed:`, caseError.message);
        testResults[user.role] = { create: false, error: caseError.message };
        continue;
      } else {
        console.log(`   ✅ Ticket created:`, newCase.case_no);
        createdCase = newCase;
        testResults[user.role] = { create: true, case_no: newCase.case_no };
      }
    } catch (err) {
      console.log(`   ❌ Error:`, err.message);
      testResults[user.role] = { create: false, error: err.message };
      continue;
    }

    // Test 2: Read own ticket
    console.log('   📖 Testing read own ticket...');
    try {
      const { data: readCase, error: readError } = await supabaseUser
        .from('repair_cases')
        .select('*')
        .eq('id', createdCase.id)
        .single();

      if (readError) {
        console.log(`   ❌ Cannot read own ticket:`, readError.message);
        testResults[user.role].readOwn = false;
      } else {
        console.log(`   ✅ Can read own ticket`);
        testResults[user.role].readOwn = true;
      }
    } catch (err) {
      console.log(`   ❌ Read error:`, err.message);
      testResults[user.role].readOwn = false;
    }

    // Test 3: Read all tickets
    console.log('   📚 Testing read all tickets...');
    try {
      const { data: allCases, error: allError } = await supabaseUser
        .from('repair_cases')
        .select('count')
        .limit(5);

      if (allError) {
        console.log(`   🔒 Cannot read all tickets (expected for ${user.role}):`, allError.message);
        testResults[user.role].readAll = false;
      } else {
        console.log(`   🔓 Can read all tickets`);
        testResults[user.role].readAll = true;
      }
    } catch (err) {
      console.log(`   ❌ Read all error:`, err.message);
      testResults[user.role].readAll = false;
    }

    // Test 4: Update ticket
    console.log('   ✏️  Testing update ticket...');
    try {
      const { error: updateError } = await supabaseUser
        .from('repair_cases')
        .update({ priority: 'high' })
        .eq('id', createdCase.id);

      if (updateError) {
        console.log(`   🔒 Cannot update ticket (expected for some roles):`, updateError.message);
        testResults[user.role].update = false;
      } else {
        console.log(`   🔓 Can update ticket`);
        testResults[user.role].update = true;
      }
    } catch (err) {
      console.log(`   ❌ Update error:`, err.message);
      testResults[user.role].update = false;
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));

  for (const [role, result] of Object.entries(testResults)) {
    console.log(`\n${role.toUpperCase()}:`);
    console.log(`  Create Ticket: ${result.create ? '✅' : '❌'} ${result.case_no || ''}`);
    if (!result.create) console.log(`    Error: ${result.error}`);
    if (result.create) {
      console.log(`  Read Own: ${result.readOwn ? '✅' : '❌'}`);
      console.log(`  Read All: ${result.readAll ? '🔓' : '🔒'}`);
      console.log(`  Update: ${result.update ? '🔓' : '🔒'}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎯 EXPECTED BEHAVIOR:');
  console.log('- Admin: Full access (create, read all, update all)');
  console.log('- Supervisor: Create, read all, update all');
  console.log('- Helpdesk: Create own, read own, update own');
  console.log('- Vendor Staff: Limited access (depends on vendor assignment)');
  console.log('='.repeat(60));
}

finalComprehensiveTest();