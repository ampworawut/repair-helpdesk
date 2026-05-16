// Comprehensive function test for repair-helpdesk
// Tests all roles and core functions via Supabase client
const { createClient } = require('@supabase/supabase-js');

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uyiiwcqplpdmiafvxahn.supabase.co';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const USERS = [
  { email: 'vendor@test.com', password: 'P@ssw0rd', role: 'vendor_staff' },
  { email: 'helpdesk@test.com', password: 'P@ssw0rd', role: 'helpdesk' },
  { email: 'supervisor@test.com', password: 'P@ssw0rd', role: 'supervisor' },
  { email: 'admin@test.com', password: 'P@ssw0rd', role: 'admin' },
];

async function testUser(user) {
  console.log(`\n=== Testing ${user.role}: ${user.email} ===`);
  const supabase = createClient(URL, ANON_KEY);

  // 1. Login
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });

  if (authError) {
    console.log(`  ❌ Login failed: ${authError.message}`);
    return;
  }
  console.log(`  ✅ Login OK`);

  // 2. Get profile
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (profileError) {
    console.log(`  ❌ Profile fetch failed: ${profileError.message}`);
  } else {
    console.log(`  ✅ Profile: ${profile.display_name} (${profile.role})`);
  }

  // 3. Fetch cases
  const { data: cases, error: casesError } = await supabase
    .from('repair_cases')
    .select('id, case_no, title, status, category, sub_category')
    .order('created_at', { ascending: false })
    .limit(5);

  if (casesError) {
    console.log(`  ❌ Cases fetch failed: ${casesError.message}`);
  } else {
    console.log(`  ✅ Cases: ${cases?.length || 0} visible`);
    if (cases?.length > 0) {
      cases.forEach(c => console.log(`     - ${c.case_no}: ${c.title} [${c.status}] ${c.category || '-'}${c.sub_category ? ' › ' + c.sub_category : ''}`));
    }
  }

  // 4. Test case detail (first case)
  if (cases?.length > 0) {
    const caseId = cases[0].id;
    const { data: detail, error: detailError } = await supabase
      .from('repair_cases')
      .select('*')
      .eq('id', caseId)
      .single();

    if (detailError) {
      console.log(`  ❌ Case detail failed: ${detailError.message}`);
    } else {
      console.log(`  ✅ Case detail: ${detail.case_no} loaded`);

      // Test comments
      const { data: comments } = await supabase
        .from('ticket_comments')
        .select('*')
        .eq('case_id', caseId);
      console.log(`  ✅ Comments: ${comments?.length || 0}`);

      // Test attachments
      const { data: atts } = await supabase
        .from('case_attachments')
        .select('*')
        .eq('case_id', caseId);
      console.log(`  ✅ Attachments: ${atts?.length || 0}`);

      // Test activity log
      const { data: acts } = await supabase
        .from('case_activity_log')
        .select('*')
        .eq('case_id', caseId);
      console.log(`  ✅ Activities: ${acts?.length || 0}`);
    }
  }

  // 5. Test assets visibility
  const { data: assets, error: assetsError } = await supabase
    .from('assets')
    .select('id, asset_code')
    .limit(5);

  if (assetsError) {
    console.log(`  ❌ Assets fetch failed: ${assetsError.message}`);
  } else {
    console.log(`  ✅ Assets: ${assets?.length || 0} visible`);
  }

  // 6. Test vendors visibility
  const { data: vendors, error: vendorsError } = await supabase
    .from('vendors')
    .select('id, name')
    .limit(5);

  if (vendorsError) {
    console.log(`  ❌ Vendors fetch failed: ${vendorsError.message}`);
  } else {
    console.log(`  ✅ Vendors: ${vendors?.length || 0} visible`);
  }

  // 7. Test locations
  const { data: locations } = await supabase
    .from('locations')
    .select('id, name')
    .limit(5);
  console.log(`  ✅ Locations: ${locations?.length || 0} visible`);

  // 8. Test LINE webhook logs (admin only)
  const { data: lineLogs, error: lineError } = await supabase
    .from('line_webhook_logs')
    .select('id')
    .limit(1);

  if (lineError) {
    console.log(`  ⚠️ LINE logs: ${lineError.message}`);
  } else {
    console.log(`  ✅ LINE logs: accessible`);
  }

  // 9. Test vendor groups
  const { data: groups } = await supabase
    .from('vendor_groups')
    .select('id, name')
    .limit(5);
  console.log(`  ✅ Vendor groups: ${groups?.length || 0} visible`);

  // Sign out
  await supabase.auth.signOut();
}

async function main() {
  console.log('🔍 RepairDesk Function Test');
  console.log(`Site: ${URL}`);
  console.log('===============================');

  for (const user of USERS) {
    await testUser(user);
  }

  console.log('\n===============================');
  console.log('✅ All tests completed');
}

main().catch(console.error);
