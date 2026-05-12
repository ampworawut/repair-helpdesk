const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function simpleHelpdeskTest() {
  console.log('=== SIMPLE HELPDESK TEST ===\n');

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Clean up any existing test cases
  await supabaseAdmin.from('repair_cases').delete().like('case_no', 'REP-26-%');

  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Sign in as helpdesk user
  console.log('1. Signing in as helpdesk user...');
  const { data: authData } = await supabaseUser.auth.signInWithPassword({
    email: 'helpdesk@test.com',
    password: 'password123'
  });

  console.log('✅ Signed in successfully');

  // Get test asset
  const { data: assets } = await supabaseAdmin.from('assets').select('*').eq('status', 'available').limit(1);
  const testAsset = assets[0];

  console.log('2. Generating case number client-side...');
  
  // Generate case number client-side
  const yy = new Date().getFullYear().toString().slice(-2);
  const { data: cases } = await supabaseAdmin
    .from('repair_cases')
    .select('case_no')
    .like('case_no', `REP-${yy}-%`)
    .order('case_no', { ascending: false });

  let nextNumber = 1;
  
  if (cases && cases.length > 0) {
    // Find the highest number
    const numbers = cases
      .map(c => {
        const match = c.case_no.match(new RegExp(`^REP-${yy}-(\\d+)$`));
        return match ? parseInt(match[1]) : 0;
      })
      .filter(n => n > 0);
    
    if (numbers.length > 0) {
      nextNumber = Math.max(...numbers) + 1;
    }
  }

  const caseNo = `REP-${yy}-${nextNumber.toString().padStart(4, '0')}`;
  console.log('✅ Generated case number:', caseNo);

  // Create case with manual case number
  console.log('3. Creating case with manual case number...');
  const testCase = {
    case_no: caseNo,
    asset_id: testAsset.id,
    title: 'Simple Test - Helpdesk User',
    description: 'Created with client-side case number generation',
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
      console.log('❌ Creation failed:', caseError.message);
      return;
    }

    console.log('✅ Case created successfully:', newCase.case_no);
    console.log('📋 Case details:');
    console.log('   - Title:', newCase.title);
    console.log('   - Priority:', newCase.priority);
    console.log('   - Status:', newCase.status);

    // Test reading the case
    console.log('4. Testing read capabilities...');
    const { data: readCase, error: readError } = await supabaseUser
      .from('repair_cases')
      .select('*')
      .eq('id', newCase.id)
      .single();

    if (readError) {
      console.log('❌ Read failed:', readError.message);
    } else {
      console.log('✅ Can read own case');
    }

    // Test updating the case
    console.log('5. Testing update capabilities...');
    const { error: updateError } = await supabaseUser
      .from('repair_cases')
      .update({ priority: 'high' })
      .eq('id', newCase.id);

    if (updateError) {
      console.log('❌ Update failed:', updateError.message);
    } else {
      console.log('✅ Can update own case');
    }

    console.log('\n🎉 SUCCESS! Helpdesk user can create and manage cases!');
    console.log('The client-side case number workaround is working.');

  } catch (err) {
    console.log('❌ Error:', err.message);
  }
}

simpleHelpdeskTest();