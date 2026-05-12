const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testHelpdeskFix() {
  console.log('Testing helpdesk user with manual case number...\n');

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

  // Try with manual case number to bypass trigger
  const manualCaseNo = 'REP-26-TEST';
  const testCase = {
    case_no: manualCaseNo,
    asset_id: testAsset.id,
    title: 'Test Ticket - Helpdesk Role (Manual)',
    description: 'Created by helpdesk user with manual case number',
    priority: 'medium',
    service_location: 'Test Location',
    created_by: authData.user.id
  };

  console.log('Attempting to create ticket with manual case number:', manualCaseNo);
  
  try {
    const { data: newCase, error: caseError } = await supabaseUser
      .from('repair_cases')
      .insert(testCase)
      .select('*')
      .single();

    if (caseError) {
      console.log('❌ Still failed:', caseError.message);
      
      // Check if it's RLS or case number issue
      if (caseError.message.includes('row-level security')) {
        console.log('This is an RLS policy issue, not case number generation');
      }
    } else {
      console.log('✅ Success with manual case number:', newCase.case_no);
    }
  } catch (err) {
    console.log('❌ Error:', err.message);
  }
}

testHelpdeskFix();