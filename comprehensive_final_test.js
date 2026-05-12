const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Client-side case number generator for helpdesk users
async function generateCaseNumber(supabase) {
  const yy = new Date().getFullYear().toString().slice(-2);
  
  const { data: cases } = await supabase
    .from('repair_cases')
    .select('case_no')
    .like('case_no', `REP-${yy}-%`)
    .order('case_no', { ascending: false })
    .limit(1);

  let nextNumber = 1;
  
  if (cases && cases.length > 0) {
    const lastCaseNo = cases[0].case_no;
    const match = lastCaseNo.match(new RegExp(`^REP-${yy}-(\\d+)$`));
    
    if (match) {
      nextNumber = parseInt(match[1]) + 1;
    }
  }

  return `REP-${yy}-${nextNumber.toString().padStart(4, '0')}`;
}

async function comprehensiveFinalTest() {
  console.log('=== COMPREHENSIVE FINAL TEST ===\n');

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
    const { data: authData, error: authError } = await supabaseUser.auth.signInWithPassword({
      email: user.email,
      password: user.password
    });

    if (authError) {
      console.log(`❌ Sign in failed:`, authError.message);
      results[user.role] = { auth: false, error: authError.message };
      continue;
    }

    console.log(`✅ Signed in successfully`);
    results[user.role] = { auth: true };

    // Get user profile
    const { data: profile } = await supabaseUser
      .from('user_profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    console.log(`👤 User: ${profile.display_name} (${profile.role})`);

    // Get test asset
    const { data: assets } = await supabaseAdmin.from('assets').select('*').eq('status', 'available').limit(1);
    const testAsset = assets[0];

    // Test 1: Create ticket
    console.log('   📝 Testing ticket creation...');
    
    let testCase = {
      asset_id: testAsset.id,
      title: `Test - ${user.role} Role`,
      description: `Created by ${user.role} user for comprehensive testing`,
      priority: 'medium',
      service_location: 'Test Location',
      created_by: authData.user.id
    };

    // For helpdesk users, use client-side case number generation
    if (user.role === 'helpdesk') {
      testCase.case_no = await generateCaseNumber(supabaseUser);
      console.log(`   🔧 Using client-side case number: ${testCase.case_no}`);
    }

    try {
      const { data: newCase, error: caseError } = await supabaseUser
        .from('repair_cases')
        .insert(testCase)
        .select('*')
        .single();

      if (caseError) {
        console.log(`   ❌ Creation failed:`, caseError.message);
        results[user.role].create = false;
        results[user.role].error = caseError.message;
        continue;
      } else {
        console.log(`   ✅ Created:`, newCase.case_no);
        results[user.role].create = true;
        results[user.role].case_no = newCase.case_no;
        results[user.role].case_id = newCase.id;
      }
    } catch (err) {
      console.log(`   ❌ Error:`, err.message);
      results[user.role].create = false;
      results[user.role].error = err.message;
      continue;
    }

    // Test 2: Read own ticket
    console.log('   📖 Testing read own ticket...');
    try {
      const { data: readCase, error: readError } = await supabaseUser
        .from('repair_cases')
        .select('*')
        .eq('id', results[user.role].case_id)
        .single();

      if (readError) {
        console.log(`   ❌ Read failed:`, readError.message);
        results[user.role].readOwn = false;
      } else {
        console.log(`   ✅ Can read own ticket`);
        results[user.role].readOwn = true;
      }
    } catch (err) {
      console.log(`   ❌ Read error:`, err.message);
      results[user.role].readOwn = false;
    }

    // Test 3: Read all tickets (should work for admin/supervisor only)
    console.log('   📚 Testing read all tickets...');
    try {
      const { data: allCases, error: allError } = await supabaseUser
        .from('repair_cases')
        .select('count')
        .limit(5);

      if (allError) {
        console.log(`   🔒 Cannot read all tickets (expected for ${user.role}):`, allError.message);
        results[user.role].readAll = false;
      } else {
        console.log(`   🔓 Can read all tickets`);
        results[user.role].readAll = true;
      }
    } catch (err) {
      console.log(`   ❌ Read all error:`, err.message);
      results[user.role].readAll = false;
    }

    // Test 4: Update own ticket
    console.log('   ✏️  Testing update own ticket...');
    try {
      const { error: updateError } = await supabaseUser
        .from('repair_cases')
        .update({ priority: 'high' })
        .eq('id', results[user.role].case_id);

      if (updateError) {
        console.log(`   ❌ Update failed:`, updateError.message);
        results[user.role].updateOwn = false;
      } else {
        console.log(`   ✅ Can update own ticket`);
        results[user.role].updateOwn = true;
      }
    } catch (err) {
      console.log(`   ❌ Update error:`, err.message);
      results[user.role].updateOwn = false;
    }

    // Test 5: Update other tickets (should work for admin/supervisor only)
    if (results.admin && results.admin.case_id && user.role !== 'admin') {
      console.log('   🔄 Testing update other user\'s ticket...');
      try {
        const { error: updateOtherError } = await supabaseUser
          .from('repair_cases')
          .update({ priority: 'critical' })
          .eq('id', results.admin.case_id);

        if (updateOtherError) {
          console.log(`   🔒 Cannot update other tickets (expected for ${user.role}):`, updateOtherError.message);
          results[user.role].updateOther = false;
        } else {
          console.log(`   🔓 Can update other tickets`);
          results[user.role].updateOther = true;
        }
      } catch (err) {
        console.log(`   ❌ Update other error:`, err.message);
        results[user.role].updateOther = false;
      }
    }
  }

  // Print comprehensive results
  console.log('\n' + '='.repeat(80));
  console.log('🎯 COMPREHENSIVE TEST RESULTS');
  console.log('='.repeat(80));

  for (const [role, result] of Object.entries(results)) {
    console.log(`\n${role.toUpperCase()}:`);
    console.log(`  Authentication: ${result.auth ? '✅' : '❌'}`);
    
    if (result.auth) {
      console.log(`  Create Ticket: ${result.create ? '✅' : '❌'} ${result.case_no || ''}`);
      
      if (result.create) {
        console.log(`  Read Own: ${result.readOwn ? '✅' : '❌'}`);
        console.log(`  Read All: ${result.readAll ? '🔓' : '🔒'}`);
        console.log(`  Update Own: ${result.updateOwn ? '✅' : '❌'}`);
        if (result.updateOther !== undefined) {
          console.log(`  Update Other: ${result.updateOther ? '🔓' : '🔒'}`);
        }
      }
      
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('💡 EXPECTED BEHAVIOR SUMMARY:');
  console.log('- Admin: Full access (create, read all, update all)');
  console.log('- Supervisor: Create, read all, update all');
  console.log('- Helpdesk: Create own, read own, update own');
  console.log('- Vendor Staff: Limited access based on vendor assignment');
  console.log('='.repeat(80));

  // Check if helpdesk fix is working
  if (results.helpdesk && results.helpdesk.create) {
    console.log('\n🎉 SUCCESS! Helpdesk users can now create cases!');
    console.log('The client-side workaround is functioning correctly.');
  } else {
    console.log('\n❌ ISSUE: Helpdesk users still cannot create cases.');
  }
}

comprehensiveFinalTest();