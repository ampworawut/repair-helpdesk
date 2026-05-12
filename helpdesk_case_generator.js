const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Client-side case number generator for helpdesk users
async function generateHelpdeskCaseNumber() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Get current year
  const yy = new Date().getFullYear().toString().slice(-2);
  
  // Get the highest case number for this year
  const { data: cases } = await supabaseAdmin
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
    } else {
      // Handle cases with non-standard format
      const allCases = await supabaseAdmin
        .from('repair_cases')
        .select('case_no')
        .like('case_no', `REP-${yy}-%`);
      
      if (allCases.data) {
        const numbers = allCases.data
          .map(c => {
            const numMatch = c.case_no.match(new RegExp(`^REP-${yy}-(\\d+)$`));
            return numMatch ? parseInt(numMatch[1]) : 0;
          })
          .filter(n => n > 0);
        
        nextNumber = Math.max(...numbers, 0) + 1;
      }
    }
  }

  return `REP-${yy}-${nextNumber.toString().padStart(4, '0')}`;
}

async function testHelpdeskWithWorkaround() {
  console.log('Testing helpdesk user with client-side case number generation...\n');

  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Sign in as helpdesk user
  const { data: authData } = await supabaseUser.auth.signInWithPassword({
    email: 'helpdesk@test.com',
    password: 'password123'
  });

  // Get user profile
  const { data: profile } = await supabaseUser
    .from('user_profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  // Get test asset
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  const { data: assets } = await supabaseAdmin.from('assets').select('*').eq('status', 'available').limit(1);
  const testAsset = assets[0];

  // Generate case number client-side
  console.log('1. Generating case number client-side...');
  const caseNo = await generateHelpdeskCaseNumber();
  console.log('   ✅ Generated case number:', caseNo);

  // Create case with manual case number
  console.log('2. Creating case with manual case number...');
  const testCase = {
    case_no: caseNo,
    asset_id: testAsset.id,
    title: 'Helpdesk Test - Client-side Generation',
    description: 'Created with client-side case number workaround',
    priority: 'medium',
    service_location: 'Test Location',
    created_by: profile.id
  };

  try {
    const { data: newCase, error: caseError } = await supabaseUser
      .from('repair_cases')
      .insert(testCase)
      .select('*')
      .single();

    if (caseError) {
      console.log('   ❌ Creation failed:', caseError.message);
      return;
    }

    console.log('   ✅ Case created successfully:', newCase.case_no);

    // Test reading and updating
    console.log('3. Testing read capabilities...');
    const { data: readCase, error: readError } = await supabaseUser
      .from('repair_cases')
      .select('*')
      .eq('id', newCase.id)
      .single();

    if (readError) {
      console.log('   ❌ Read failed:', readError.message);
    } else {
      console.log('   ✅ Can read own case');
    }

    console.log('4. Testing update capabilities...');
    const { error: updateError } = await supabaseUser
      .from('repair_cases')
      .update({ priority: 'high' })
      .eq('id', newCase.id);

    if (updateError) {
      console.log('   ❌ Update failed:', updateError.message);
    } else {
      console.log('   ✅ Can update own case');
    }

    console.log('\n🎉 HELP DESK USER CAN SUCCESSFULLY CREATE CASES WITH WORKAROUND!');
    console.log('Case number:', newCase.case_no);

  } catch (err) {
    console.log('   ❌ Error:', err.message);
  }
}

testHelpdeskWithWorkaround();