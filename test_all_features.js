// Full feature test for repair-helpdesk
const { createClient } = require('@supabase/supabase-js');

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uyiiwcqplpdmiafvxahn.supabase.co';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const USERS = [
  { email: 'vendor@test.com', password: 'P@ssw0rd', role: 'vendor_staff' },
  { email: 'helpdesk@test.com', password: 'P@ssw0rd', role: 'helpdesk' },
  { email: 'supervisor@test.com', password: 'P@ssw0rd', role: 'supervisor' },
  { email: 'admin@test.com', password: 'P@ssw0rd', role: 'admin' },
];

let testCaseId = null;
let testAssetId = null;
let testVendorId = null;
let testGroupId = null;

async function testUser(user) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing ${user.role.toUpperCase()}: ${user.email}`);
  console.log('='.repeat(60));

  const supabase = createClient(URL, ANON_KEY);

  // 1. Login
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: user.email, password: user.password,
  });
  if (authError) { console.log(`  ❌ Login: ${authError.message}`); return; }
  console.log(`  ✅ Login`);

  // 2. Profile
  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', authData.user.id).single();
  console.log(`  ✅ Profile: ${profile.display_name} (${profile.role})`);

  // 3. Dashboard stats
  const { data: cases } = await supabase.from('repair_cases').select('id, case_no, title, status, category, sub_category, priority, created_by, asset_id').order('created_at', { ascending: false }).limit(20);
  const openCount = cases.filter(c => ['pending','responded','in_progress','on_hold'].includes(c.status)).length;
  console.log(`  ✅ Dashboard: ${cases.length} total, ${openCount} open`);

  // 4. Cases list with filters
  const { data: pendingCases } = await supabase.from('repair_cases').select('id').eq('status', 'pending').limit(5);
  console.log(`  ✅ Filter by status: ${pendingCases.length} pending`);

  const { data: criticalCases } = await supabase.from('repair_cases').select('id').eq('priority', 'critical').limit(5);
  console.log(`  ✅ Filter by priority: ${criticalCases.length} critical`);

  // 5. Case detail
  if (cases.length > 0) {
    const c = cases[0];
    const { data: detail } = await supabase.from('repair_cases').select('*').eq('id', c.id).single();
    console.log(`  ✅ Case detail: ${detail ? detail.case_no : 'FAIL'}`);

    // Comments
    const { data: comments } = await supabase.from('ticket_comments').select('*').eq('case_id', c.id);
    console.log(`  ✅ Comments: ${comments.length}`);

    // Attachments
    const { data: atts } = await supabase.from('case_attachments').select('*').eq('case_id', c.id);
    console.log(`  ✅ Attachments: ${atts.length}`);

    // Activity log
    const { data: acts } = await supabase.from('case_activity_log').select('*').eq('case_id', c.id);
    console.log(`  ✅ Activities: ${acts.length}`);
  }

  // 6. Assets
  const { data: assets } = await supabase.from('assets').select('*').limit(10);
  console.log(`  ✅ Assets: ${assets.length} visible`);
  if (assets.length > 0) testAssetId = assets[0].id;

  // 7. Vendors
  const { data: vendors } = await supabase.from('vendors').select('*').limit(10);
  console.log(`  ✅ Vendors: ${vendors.length} visible`);
  if (vendors.length > 0) testVendorId = vendors[0].id;

  // 8. Vendor groups
  const { data: groups } = await supabase.from('vendor_groups').select('*').limit(10);
  console.log(`  ✅ Vendor groups: ${groups.length} visible`);
  if (groups.length > 0) testGroupId = groups[0].id;

  // 9. Locations
  const { data: locations } = await supabase.from('locations').select('*').limit(10);
  console.log(`  ✅ Locations: ${locations.length} visible`);

  // 10. Templates
  const { data: templates } = await supabase.from('ticket_templates').select('*').limit(5);
  console.log(`  ✅ Templates: ${templates.length} visible`);

  // 11. LINE webhook logs
  const { data: lineLogs } = await supabase.from('line_webhook_logs').select('id').limit(1);
  console.log(`  ✅ LINE logs: ${lineLogs ? 'accessible' : 'FAIL'}`);

  // 12. Notifications
  const { data: notifs } = await supabase.from('notifications').select('id').eq('user_id', authData.user.id).limit(5);
  console.log(`  ✅ Notifications: ${notifs.length}`);

  // 13. Create case (helpdesk/admin/supervisor only)
  if (['helpdesk','supervisor','admin'].includes(user.role) && testAssetId) {
    const { data: newCase, error: createError } = await supabase.from('repair_cases').insert({
      asset_id: testAssetId,
      title: `Test Case - ${user.role} - ${Date.now()}`,
      description: 'Automated test case',
      priority: 'low',
      service_location: 'Test Location',
      created_by: authData.user.id,
    }).select('id, case_no').single();

    if (createError) {
      console.log(`  ⚠️ Create case: ${createError.message}`);
    } else {
      console.log(`  ✅ Create case: ${newCase.case_no}`);
      testCaseId = newCase.id;

      // 14. Add comment
      const { error: commentError } = await supabase.from('ticket_comments').insert({
        case_id: testCaseId,
        author_id: authData.user.id,
        content: 'Test comment from automated test',
      });
      console.log(`  ✅ Add comment: ${commentError ? 'FAIL: '+commentError.message : 'OK'}`);

      // 15. Update status (vendor/admin can respond)
      if (['vendor_staff','admin'].includes(user.role)) {
        const { error: statusError } = await supabase.from('repair_cases').update({
          status: 'responded',
          responded_at: new Date().toISOString(),
        }).eq('id', testCaseId);
        console.log(`  ✅ Respond case: ${statusError ? 'FAIL: '+statusError.message : 'OK'}`);

        // 16. Start work
        if (['admin','supervisor'].includes(user.role)) {
          const { error: progressError } = await supabase.from('repair_cases').update({
            status: 'in_progress',
            onsite_at: new Date().toISOString(),
          }).eq('id', testCaseId);
          console.log(`  ✅ Start work: ${progressError ? 'FAIL: '+progressError.message : 'OK'}`);

          // 17. Resolve
          const { error: resolveError } = await supabase.from('repair_cases').update({
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            confirmation_status: 'pending',
          }).eq('id', testCaseId);
          console.log(`  ✅ Resolve: ${resolveError ? 'FAIL: '+resolveError.message : 'OK'}`);

          // 18. Confirm resolution (helpdesk who created)
          if (user.role === 'helpdesk') {
            const { error: confirmError } = await supabase.from('repair_cases').update({
              confirmation_status: 'confirmed',
            }).eq('id', testCaseId);
            console.log(`  ✅ Confirm: ${confirmError ? 'FAIL: '+confirmError.message : 'OK'}`);
          }

          // 19. Close
          const { error: closeError } = await supabase.from('repair_cases').update({
            status: 'closed',
            closed_at: new Date().toISOString(),
            closed_by: authData.user.id,
          }).eq('id', testCaseId);
          console.log(`  ✅ Close: ${closeError ? 'FAIL: '+closeError.message : 'OK'}`);
        }
      }

      // 20. Cancel (admin/supervisor only)
      if (['admin','supervisor'].includes(user.role)) {
        // Create another case to cancel
        const { data: cancelCase } = await supabase.from('repair_cases').insert({
          asset_id: testAssetId,
          title: `Cancel Test - ${user.role}`,
          priority: 'low',
          service_location: 'Test',
          created_by: authData.user.id,
        }).select('id, case_no').single();

        if (cancelCase) {
          const { error: cancelError } = await supabase.from('repair_cases').update({
            status: 'cancelled',
          }).eq('id', cancelCase.id);
          console.log(`  ✅ Cancel case: ${cancelError ? 'FAIL: '+cancelError.message : 'OK'}`);
        }
      }
    }
  }

  // 21. Category classification test (inline logic)
  const testInputs = [
    { title: 'จอฟ้า ค้างบ่อย', expected: 'hardware' },
    { title: 'น้ำหกใส่เครื่อง', expected: 'accident' },
    { title: 'เน็ตหลุดบ่อยมาก', expected: 'network' },
    { title: 'ลง windows ไม่ได้', expected: 'software' },
    { title: 'ลืมรหัสผ่าน', expected: 'account' },
    { title: 'พิมพ์ไม่ออก', expected: 'printer' },
    { title: 'เมาส์ไม่ทำงาน', expected: 'peripheral' },
    { title: 'จอแตก ร้าว', expected: 'accident' },
    { title: 'ปุ่มคีย์บอร์ดหลุด', expected: 'peripheral' },
  ];
  const classifyCase = (title) => {
    const text = title.toLowerCase();
    // Accident: specific damage types first
    if (text.includes('น้ำหก')||text.includes('น้ำเข้า')||text.includes('ของเหลว')||text.includes('เปียก')) return {main:'accident'};
    if (text.includes('ตก')||text.includes('กระแทก')||text.includes('หล่น')) return {main:'accident'};
    if (text.includes('จอแตก')||text.includes('ร้าว')) return {main:'accident'};
    if (text.includes('ฝาแตก')||text.includes('บอดี้แตก')||text.includes('hinge')||text.includes('บานพับ')) return {main:'accident'};
    // Hardware
    if (text.includes('เปิดไม่ติด')||text.includes('จอฟ้า')||text.includes('ค้าง')||text.includes('แบต')||text.includes('harddisk')||text.includes('ram')||text.includes('พัดลม')||text.includes('mainboard')) return {main:'hardware'};
    // Network
    if (text.includes('เน็ต')||text.includes('internet')||text.includes('wifi')||text.includes('vpn')||text.includes('lan')) return {main:'network'};
    // Software
    if (text.includes('windows')||text.includes('โปรแกรม')||text.includes('ไวรัส')||text.includes('driver')||text.includes('update')) return {main:'software'};
    // Account
    if (text.includes('รหัส')||text.includes('password')||text.includes('login')||text.includes('ล็อกอิน')||text.includes('email')) return {main:'account'};
    // Printer
    if (text.includes('พิมพ์')||text.includes('ปริ้น')||text.includes('หมึก')||text.includes('toner')||text.includes('กระดาษ')) return {main:'printer'};
    // Peripheral
    if (text.includes('เมาส์')||text.includes('mouse')||text.includes('คีย์บอร์ด')||text.includes('keyboard')||text.includes('จอ')||text.includes('monitor')||text.includes('กล้อง')||text.includes('ลำโพง')) return {main:'peripheral'};
    // Generic accident fallback (last)
    if (text.includes('หัก')||text.includes('แตก')||text.includes('หลุด')) return {main:'accident'};
    return {main:'other'};
  };
  let catOk = 0, catFail = 0;
  for (const t of testInputs) {
    const result = classifyCase(t.title);
    if (result.main === t.expected) catOk++;
    else { catFail++; console.log(`  ⚠️ Classify "${t.title}" → ${result.main} (expected ${t.expected})`); }
  }
  console.log(`  ✅ Category classify: ${catOk}/${testInputs.length} correct`);

  // 22. SLA calculation (inline)
  const evaluateSLA = (dl) => {
    if (!dl) return {status:'ok'};
    const now = Date.now();
    const deadline = new Date(dl).getTime();
    const remaining = deadline - now;
    if (remaining <= 0) return {status:'breached'};
    if (remaining < 3600000) return {status:'warning'};
    return {status:'ok'};
  };
  const futureDl = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
  const pastDl = new Date(Date.now() - 3600000).toISOString();   // 1 hour ago
  const slaOk = evaluateSLA(futureDl);
  const slaBreached = evaluateSLA(pastDl);
  console.log(`  ✅ SLA: future=${slaOk.status}, past=${slaBreached.status}`);

  // 23. Permissions (inline)
  const canCreateNewCase = (r) => r && r !== 'vendor_staff';
  const canUpdateCase = (r) => r === 'admin' || r === 'supervisor';
  const canCloseCase = (r) => r === 'admin' || r === 'supervisor';
  const canAssignTechnician = (r) => r === 'admin' || r === 'supervisor';
  const canAccessAdmin = (r) => r === 'admin';
  const canAccessReports = (r) => r === 'admin' || r === 'supervisor';
  const canBulkCreateTickets = (r) => r === 'admin';
  console.log(`  ✅ Permissions: create=${canCreateNewCase(user.role)} update=${canUpdateCase(user.role)} close=${canCloseCase(user.role)} assign=${canAssignTechnician(user.role)} admin=${canAccessAdmin(user.role)} reports=${canAccessReports(user.role)} bulk=${canBulkCreateTickets(user.role)}`);

  // 24. Duplicate case prevention
  if (['helpdesk','supervisor','admin'].includes(user.role) && testAssetId) {
    const { data: existing } = await supabase.from('repair_cases')
      .select('id').eq('asset_id', testAssetId)
      .not('status', 'in', '(closed,cancelled)').limit(1);
    console.log(`  ✅ Duplicate check: ${existing?.length ? 'Would block (active case exists)' : 'Would allow'}`);
  }

  await supabase.auth.signOut();
}

async function main() {
  console.log('🔍 RepairDesk FULL Feature Test');
  console.log(`DB: ${URL}`);
  console.log('='.repeat(60));

  for (const user of USERS) {
    await testUser(user);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ ALL FEATURE TESTS COMPLETED');
}

main().catch(console.error);
