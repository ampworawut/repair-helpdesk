const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function helpdeskWorkaroundTest() {
  console.log('Testing helpdesk user workaround approach...\n');

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Clean up any existing test cases
  await supabaseAdmin.from('repair_cases').delete().like('case_no', 'REP-26-%');

  // Sign in as helpdesk user
  const { data: authData } = await supabaseUser.auth.signInWithPassword({
    email: 'helpdesk@test.com',
    password: 'password123'
  });

  // Get test asset
  const { data: assets } = await supabaseAdmin.from('assets').select('*').eq('status', 'available').limit(1);
  const testAsset = assets[0];

  console.log('1. Testing direct case creation (should fail due to trigger permissions)...');
  
  // Test 1: Direct creation (should fail)
  const testCase1 = {
    asset_id: testAsset.id,
    title: 'Helpdesk Test - Direct',
    description: 'Direct creation test',
    priority: 'medium',
    service_location: 'Test Location',
    created_by: authData.user.id
  };

  try {
    const { data: newCase, error: caseError } = await supabaseUser
      .from('repair_cases')
      .insert(testCase1)
      .select('*')
      .single();

    if (caseError) {
      console.log('   ❌ Expected failure:', caseError.message);
    } else {
      console.log('   ✅ Unexpected success:', newCase.case_no);
    }
  } catch (err) {
    console.log('   ❌ Error:', err.message);
  }

  console.log('\n2. Testing workaround with manual case number...');
  
  // Test 2: Workaround with manual case number
  const manualCaseNo = 'REP-26-HELPDESK';
  const testCase2 = {
    case_no: manualCaseNo,
    asset_id: testAsset.id,
    title: 'Helpdesk Test - Manual',
    description: 'Manual case number workaround',
    priority: 'medium',
    service_location: 'Test Location',
    created_by: authData.user.id
  };

  try {
    const { data: newCase, error: caseError } = await supabaseUser
      .from('repair_cases')
      .insert(testCase2)
      .select('*')
      .single();

    if (caseError) {
      console.log('   ❌ Workaround failed:', caseError.message);
    } else {
      console.log('   ✅ Workaround success:', newCase.case_no);
      
      // Test reading the case
      const { data: readCase, error: readError } = await supabaseUser
        .from('repair_cases')
        .select('*')
        .eq('id', newCase.id)
        .single();

      if (readError) {
        console.log('   ❌ Cannot read own case:', readError.message);
      } else {
        console.log('   ✅ Can read own case');
      }

      // Test updating the case
      const { error: updateError } = await supabaseUser
        .from('repair_cases')
        .update({ priority: 'high' })
        .eq('id', newCase.id);

      if (updateError) {
        console.log('   ❌ Cannot update own case:', updateError.message);
      } else {
        console.log('   ✅ Can update own case');
      }
    }
  } catch (err) {
    console.log('   ❌ Workaround error:', err.message);
  }

  console.log('\n3. Testing admin-assisted case creation (simulating fixed function)...');
  
  // Test 3: Simulate what would happen with fixed function
  // Admin creates case on behalf of helpdesk user
  const testCase3 = {
    asset_id: testAsset.id,
    title: 'Helpdesk Test - Admin Assisted',
    description: 'Simulating fixed function behavior',
    priority: 'medium',
    service_location: 'Test Location',
    created_by: authData.user.id
  };

  try {
    const { data: newCase, error: caseError } = await supabaseAdmin
      .from('repair_cases')
      .insert(testCase3)
      .select('*')
      .single();

    if (caseError) {
      console.log('   ❌ Admin-assisted failed:', caseError.message);
    } else {
      console.log('   ✅ Admin-assisted success:', newCase.case_no);
      console.log('   📋 This demonstrates the expected behavior when function is fixed');
    }
  } catch (err) {
    console.log('   ❌ Admin-assisted error:', err.message);
  }

  console.log('\n4. Testing helpdesk user permissions on existing cases...');
  
  // Test 4: Helpdesk user permissions on existing cases
  try {
    const { data: myCases, error: readError } = await supabaseUser
      .from('repair_cases')
      .select('case_no, title, priority')
      .eq('created_by', authData.user.id)
      .order('created_at', { ascending: false });

    if (readError) {
      console.log('   ❌ Cannot read own cases:', readError.message);
    } else {
      console.log('   ✅ Can read own cases:', myCases.length, 'cases found');
      myCases.forEach(c => console.log(`     - ${c.case_no}: ${c.title} (${c.priority})`));
    }
  } catch (err) {
    console.log('   ❌ Read cases error:', err.message);
  }
}

helpdeskWorkaroundTest();