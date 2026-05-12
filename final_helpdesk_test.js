const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function finalHelpdeskTest() {
  console.log('Final helpdesk user test with proper case number handling...\n');

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Get test asset
  const { data: assets } = await supabaseAdmin.from('assets').select('*').eq('status', 'available').limit(1);
  const testAsset = assets[0];

  // Sign in as helpdesk user
  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data: authData } = await supabaseUser.auth.signInWithPassword({
    email: 'helpdesk@test.com',
    password: 'password123'
  });

  // Test 1: Try without case_no field (let trigger handle it)
  console.log('1. Testing without case_no field (let trigger generate it)...');
  const testCase1 = {
    asset_id: testAsset.id,
    title: 'Test Ticket - Helpdesk Role Auto',
    description: 'Created by helpdesk user - auto case number',
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
      console.log('❌ Failed:', caseError.message);
    } else {
      console.log('✅ Success! Auto-generated case number:', newCase.case_no);
    }
  } catch (err) {
    console.log('❌ Error:', err.message);
  }

  // Test 2: Try with explicit NULL case_no
  console.log('\n2. Testing with explicit case_no: NULL...');
  const testCase2 = {
    case_no: null,
    asset_id: testAsset.id,
    title: 'Test Ticket - Helpdesk Role NULL',
    description: 'Created by helpdesk user - NULL case number',
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
      console.log('❌ Failed:', caseError.message);
    } else {
      console.log('✅ Success! Auto-generated case number:', newCase.case_no);
    }
  } catch (err) {
    console.log('❌ Error:', err.message);
  }

  // Test 3: Test reading capabilities
  console.log('\n3. Testing read capabilities...');
  try {
    const { data: myCases, error: readError } = await supabaseUser
      .from('repair_cases')
      .select('case_no, title')
      .eq('created_by', authData.user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (readError) {
      console.log('❌ Cannot read own cases:', readError.message);
    } else {
      console.log('✅ Can read own cases:', myCases.length, 'cases found');
      myCases.forEach(c => console.log('   - ' + c.case_no + ': ' + c.title));
    }
  } catch (err) {
    console.log('❌ Read error:', err.message);
  }
}

finalHelpdeskTest();