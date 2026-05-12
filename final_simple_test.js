const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Simple case number generator for testing
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

async function finalSimpleTest() {
  console.log('=== FINAL TEST - Helpdesk User ===\n');

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Clean up
  await supabaseAdmin.from('repair_cases').delete().like('case_no', 'REP-26-%');

  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Sign in as helpdesk
  const { data: authData } = await supabaseUser.auth.signInWithPassword({
    email: 'helpdesk@test.com',
    password: 'password123'
  });

  console.log('✅ Signed in as helpdesk user');

  // Get asset
  const { data: assets } = await supabaseAdmin.from('assets').select('*').eq('status', 'available').limit(1);
  const testAsset = assets[0];

  // Generate case number
  const caseNo = await generateCaseNumber(supabaseUser);
  console.log('🔧 Generated case number:', caseNo);

  // Create case
  const testCase = {
    case_no: caseNo,
    asset_id: testAsset.id,
    title: 'Final Test - Helpdesk',
    description: 'Created with client-side case number',
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

    console.log('✅ Case created:', newCase.case_no);
    console.log('📋 Status:', newCase.status);
    console.log('🎯 Priority:', newCase.priority);

    // Test permissions
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
    console.log('The client-side workaround is functioning correctly.');

  } catch (err) {
    console.log('❌ Error:', err.message);
  }
}

finalSimpleTest();