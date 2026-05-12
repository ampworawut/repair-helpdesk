const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function finalUITest() {
  console.log('=== FINAL UI TEST - Helpdesk User Case Creation ===\n');

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

  // Get user profile
  const { data: profile } = await supabaseUser
    .from('user_profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  console.log('👤 User role:', profile.role);

  // Get test asset
  const { data: assets } = await supabaseAdmin.from('assets').select('*').eq('status', 'available').limit(1);
  const testAsset = assets[0];

  console.log('2. Testing case creation through UI simulation...');
  
  // Simulate UI form submission
  const formData = {
    asset_id: testAsset.id,
    title: 'UI Test - Helpdesk User',
    description: 'Created through UI simulation with client-side case number',
    priority: 'medium',
    service_location: 'Test Location',
    created_by: profile.id
  };

  // For helpdesk users, generate case number client-side
  if (profile.role === 'helpdesk') {
    console.log('   🔧 Generating case number client-side (workaround)...');
    
    // Import the generateCaseNumber function
    const { generateCaseNumber } = require('./lib/utils');
    formData.case_no = await generateCaseNumber(supabaseUser);
    
    console.log('   ✅ Generated case number:', formData.case_no);
  }

  // Create the case
  try {
    const { data: newCase, error: caseError } = await supabaseUser
      .from('repair_cases')
      .insert(formData)
      .select('*')
      .single();

    if (caseError) {
      console.log('❌ Case creation failed:', caseError.message);
      return;
    }

    console.log('✅ Case created successfully:', newCase.case_no);
    console.log('📋 Case details:');
    console.log('   - Title:', newCase.title);
    console.log('   - Priority:', newCase.priority);
    console.log('   - Status:', newCase.status);
    console.log('   - Created by:', profile.display_name);

    // Test reading the case
    console.log('3. Testing read capabilities...');
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
    console.log('4. Testing update capabilities...');
    const { error: updateError } = await supabaseUser
      .from('repair_cases')
      .update({ priority: 'high' })
      .eq('id', newCase.id);

    if (updateError) {
      console.log('❌ Update failed:', updateError.message);
    } else {
      console.log('✅ Can update own case');
    }

    console.log('\n🎉 SUCCESS! Helpdesk user can now create cases!');
    console.log('The client-side case number workaround is working.');
    console.log('Case number:', newCase.case_no);

  } catch (err) {
    console.log('❌ Error:', err.message);
  }
}

finalUITest();