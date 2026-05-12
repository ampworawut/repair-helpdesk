const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Test ticket creation with different user roles
async function testTicketCreation() {
  console.log('Testing ticket creation with different user roles...\n');

  const users = [
    { email: 'admin@test.com', password: 'password123', role: 'admin' },
    { email: 'supervisor@test.com', password: 'password123', role: 'supervisor' },
    { email: 'helpdesk@test.com', password: 'password123', role: 'helpdesk' },
    { email: 'vendor@test.com', password: 'password123', role: 'vendor_staff' }
  ];

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Get an available asset
  const { data: assets } = await supabaseAdmin.from('assets').select('*').eq('status', 'available').limit(1);
  const testAsset = assets[0];

  if (!testAsset) {
    console.log('No available assets found for testing');
    return;
  }

  for (const user of users) {
    console.log(`=== Testing with ${user.role} role ===`);
    
    // Sign in as the user
    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: authData, error: authError } = await supabaseUser.auth.signInWithPassword({
      email: user.email,
      password: user.password
    });

    if (authError) {
      console.log(`❌ Failed to sign in as ${user.email}:`, authError.message);
      continue;
    }

    // Get user profile
    const { data: profile } = await supabaseUser.from('user_profiles').select('*').eq('id', authData.user.id).single();

    // Create a test ticket
    const testCase = {
      asset_id: testAsset.id,
      title: `Test Ticket - ${user.role} Role`,
      description: `This is a test ticket created by ${user.role} user for testing purposes`,
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
        console.log(`❌ ${user.role} failed to create ticket:`, caseError.message);
      } else {
        console.log(`✅ ${user.role} successfully created ticket:`, newCase.case_no);
        
        // Test if user can read the ticket they created
        const { data: readCase, error: readError } = await supabaseUser
          .from('repair_cases')
          .select('*')
          .eq('id', newCase.id)
          .single();

        if (readError) {
          console.log(`❌ ${user.role} cannot read their own ticket:`, readError.message);
        } else {
          console.log(`✅ ${user.role} can read their ticket`);
        }
      }
    } catch (err) {
      console.log(`❌ ${user.role} error:`, err.message);
    }

    console.log('');
  }
}

testTicketCreation();