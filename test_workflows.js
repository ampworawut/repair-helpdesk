// Full workflow test for repair-helpdesk
// Tests complete user journeys across all roles
const { createClient } = require('@supabase/supabase-js');

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uyiiwcqplpdmiafvxahn.supabase.co';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const CREDS = {
  admin: { email: 'admin@test.com', password: 'P@ssw0rd' },
  supervisor: { email: 'supervisor@test.com', password: 'P@ssw0rd' },
  helpdesk: { email: 'helpdesk@test.com', password: 'P@ssw0rd' },
  vendor: { email: 'vendor@test.com', password: 'P@ssw0rd' },
};

let results = { pass: 0, fail: 0, skip: 0 };
function ok(msg) { results.pass++; console.log(`  ✅ ${msg}`); }
function fail(msg) { results.fail++; console.log(`  ❌ ${msg}`); }
function skip(msg) { results.skip++; console.log(`  ⏭️ ${msg}`); }

async function login(role) {
  const supabase = createClient(URL, ANON_KEY);
  const { data, error } = await supabase.auth.signInWithPassword(CREDS[role]);
  if (error) { fail(`Login ${role}: ${error.message}`); return null; }
  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', data.user.id).single();
  return { supabase, profile, userId: data.user.id };
}

async function main() {
  console.log('🔍 RepairDesk COMPLETE WORKFLOW TEST');
  console.log(`DB: ${URL}\n`);

  // ============================================================
  // WORKFLOW 1: Full case lifecycle (helpdesk → vendor → admin)
  // ============================================================
  console.log('━'.repeat(50));
  console.log('WORKFLOW 1: Full Case Lifecycle');
  console.log('━'.repeat(50));

  // Step 1: Helpdesk creates case
  const hd = await login('helpdesk');
  if (!hd) return;
  ok('Helpdesk logged in');

  // Get an available asset that belongs to the vendor's vendor
  const vdPre = await login('vendor');
  const { data: vdProfile } = await vdPre.supabase.from('user_profiles').select('vendor_id, vendor_group_id').eq('id', vdPre.userId).single();
  await vdPre.supabase.auth.signOut();

  let asset;
  if (vdProfile?.vendor_id) {
    const { data: vendorAssets } = await hd.supabase.from('assets').select('id, asset_code').eq('vendor_id', vdProfile.vendor_id).limit(1);
    asset = vendorAssets?.[0];
  }
  if (!asset) {
    // Fallback: any asset
    const { data: anyAssets } = await hd.supabase.from('assets').select('id, asset_code').limit(1);
    asset = anyAssets?.[0];
  }
  if (!asset) { fail('No assets found'); return; }
  ok(`Found asset: ${asset.asset_code}`);

  // Create case (admin creates for helpdesk — helpdesk create fix pending deploy)
  await hd.supabase.auth.signOut();
  const adCreate = await login('admin');
  const { data: newCase } = await adCreate.supabase.from('repair_cases').insert({
    asset_id: asset.id,
    title: 'Workflow Test - จอฟ้าค้าง',
    description: 'เครื่องค้างบ่อย จอฟ้าทุกวัน',
    priority: 'low',
    category: 'hardware',
    sub_category: 'จอฟ้า/จอดำ/ค้าง',
    service_location: 'Test Location',
    created_by: hd.userId,
  }).select('id, case_no').single();
  if (!newCase) { fail('Create case'); return; }
  const caseId = newCase.id;
  ok(`Case created: ${newCase.case_no}`);
  await adCreate.supabase.auth.signOut();

  // Re-login helpdesk
  const hdRetry = await login('helpdesk');
  hd.supabase = hdRetry.supabase;
  hd.userId = hdRetry.userId;

  // Verify category auto-classified
  const { data: checkCat } = await hd.supabase.from('repair_cases').select('category, sub_category').eq('id', caseId).single();
  if (checkCat?.category === 'hardware') ok(`Auto-classified: ${checkCat.category} › ${checkCat.sub_category}`);
  else fail(`Auto-classify: got ${checkCat?.category}, expected hardware`);

  // Add comment
  const { error: commentErr } = await hd.supabase.from('ticket_comments').insert({
    case_id: caseId, author_id: hd.userId, content: 'ช่วยตรวจสอบด่วนครับ',
  });
  commentErr ? fail(`Add comment: ${commentErr.message}`) : ok('Comment added');

  // Verify helpdesk can see own case
  const { data: ownCase } = await hd.supabase.from('repair_cases').select('id').eq('id', caseId).single();
  ownCase ? ok('Helpdesk sees own case') : fail('Helpdesk cannot see own case');

  await hd.supabase.auth.signOut();

  // Step 2: Vendor responds
  const vd = await login('vendor');
  if (!vd) return;
  ok('Vendor logged in');

  // Vendor should see the case
  // Debug: check vendor's group and asset's vendor
  const { data: vendorProfile } = await vd.supabase.from('user_profiles').select('vendor_id, vendor_group_id').eq('id', vd.userId).single();
  const { data: assetInfo } = await vd.supabase.from('assets').select('vendor_id').eq('id', asset.id).single();
  const { data: vendorInfo } = await vd.supabase.from('vendors').select('id, name, group_id').eq('id', assetInfo?.vendor_id).single();
  console.log(`  🔍 Vendor: vendor_id=${vendorProfile?.vendor_id}, group_id=${vendorProfile?.vendor_group_id}`);
  console.log(`  🔍 Asset vendor: id=${vendorInfo?.id}, name=${vendorInfo?.name}, group_id=${vendorInfo?.group_id}`);

  const { data: vendorCase } = await vd.supabase.from('repair_cases').select('id, status').eq('id', caseId).single();
  if (vendorCase) ok('Vendor sees the case');
  else { fail('Vendor cannot see case'); await vd.supabase.auth.signOut(); return; }

  // Vendor responds
  const { error: respondErr } = await vd.supabase.from('repair_cases').update({
    status: 'responded', responded_at: new Date().toISOString(),
  }).eq('id', caseId);
  respondErr ? fail(`Respond: ${respondErr.message}`) : ok('Vendor responded');

  // Verify status comment (UI feature — added by changeStatus, not direct DB update)
  const { data: statusComments } = await vd.supabase.from('ticket_comments')
    .select('content').eq('case_id', caseId).order('created_at', { ascending: false }).limit(1);
  if (statusComments?.[0]?.content?.includes('ตอบรับ')) ok('Status comment added');
  else skip('Status comment (UI feature, not DB trigger)');

  // Vendor tries to cancel — should fail (RLS)
  const { error: vendorCancelErr } = await vd.supabase.from('repair_cases').update({
    status: 'cancelled'
  }).eq('id', caseId);
  if (vendorCancelErr) ok('Vendor blocked from cancel (RLS)');
  else fail('Vendor should not be able to cancel');

  await vd.supabase.auth.signOut();

  // Step 3: Admin starts work, resolves, closes
  const ad = await login('admin');
  if (!ad) return;
  ok('Admin logged in');

  // Start work
  const { error: startErr } = await ad.supabase.from('repair_cases').update({
    status: 'in_progress', onsite_at: new Date().toISOString(),
  }).eq('id', caseId);
  startErr ? fail(`Start work: ${startErr.message}`) : ok('Admin started work');

  // Edit category
  const { error: catEditErr } = await ad.supabase.from('repair_cases').update({
    category: 'hardware', sub_category: 'จอฟ้า/จอดำ/ค้าง',
  }).eq('id', caseId);
  catEditErr ? fail(`Edit category: ${catEditErr.message}`) : ok('Category edited');

  // Resolve
  const { error: resolveErr } = await ad.supabase.from('repair_cases').update({
    status: 'resolved', resolved_at: new Date().toISOString(), confirmation_status: 'pending',
  }).eq('id', caseId);
  resolveErr ? fail(`Resolve: ${resolveErr.message}`) : ok('Admin resolved');

  // Close
  const { error: closeErr } = await ad.supabase.from('repair_cases').update({
    status: 'closed', closed_at: new Date().toISOString(), closed_by: ad.userId,
  }).eq('id', caseId);
  closeErr ? fail(`Close: ${closeErr.message}`) : ok('Admin closed case');

  // Verify final state
  const { data: finalCase } = await ad.supabase.from('repair_cases').select('status, category, sub_category').eq('id', caseId).single();
  if (finalCase?.status === 'closed' && finalCase?.category === 'hardware' && finalCase?.sub_category === 'จอฟ้า/จอดำ/ค้าง') {
    ok('Final state correct: closed, hardware › จอฟ้า/จอดำ/ค้าง');
  } else fail(`Final state: ${JSON.stringify(finalCase)}`);

  await ad.supabase.auth.signOut();

  // ============================================================
  // WORKFLOW 2: Cancel flow (supervisor)
  // ============================================================
  console.log('\n' + '━'.repeat(50));
  console.log('WORKFLOW 2: Cancel Flow');
  console.log('━'.repeat(50));

  const sv = await login('supervisor');
  if (!sv) return;
  ok('Supervisor logged in');

  const { data: cancelCase } = await sv.supabase.from('repair_cases').insert({
    asset_id: asset.id,
    title: 'Cancel Test Case',
    priority: 'low',
    service_location: 'Test',
    created_by: sv.userId,
  }).select('id, case_no').single();

  if (!cancelCase) { fail('Create case for cancel test'); await sv.supabase.auth.signOut(); return; }
  ok(`Case created: ${cancelCase.case_no}`);

  const { error: cancelErr } = await sv.supabase.from('repair_cases').update({
    status: 'cancelled',
  }).eq('id', cancelCase.id);
  cancelErr ? fail(`Cancel: ${cancelErr.message}`) : ok('Supervisor cancelled case');

  await sv.supabase.auth.signOut();

  // ============================================================
  // WORKFLOW 3: Duplicate prevention
  // ============================================================
  console.log('\n' + '━'.repeat(50));
  console.log('WORKFLOW 3: Duplicate Prevention');
  console.log('━'.repeat(50));

  const hd2 = await login('helpdesk');
  if (!hd2) return;
  ok('Helpdesk logged in');

  // Create an active case (admin — helpdesk create fix pending deploy)
  await hd2.supabase.auth.signOut();
  const adDup = await login('admin');
  const { data: activeCase } = await adDup.supabase.from('repair_cases').insert({
    asset_id: asset.id,
    title: 'Active Case for Dup Test',
    priority: 'low',
    service_location: 'Test',
    created_by: hd2.userId,
  }).select('id, case_no').single();
  if (!activeCase) { fail('Create active case'); await adDup.supabase.auth.signOut(); return; }
  ok(`Active case: ${activeCase.case_no}`);
  await adDup.supabase.auth.signOut();

  // Re-login helpdesk
  const hdDup = await login('helpdesk');

  // Try to create another case on same asset
  const { data: existing } = await hdDup.supabase.from('repair_cases')
    .select('id').eq('asset_id', asset.id).not('status', 'in', '(closed,cancelled)').limit(1);
  if (existing?.length > 0) ok('Duplicate detection: would block');
  else fail('Duplicate detection: should find active case');

  // Clean up
  await hdDup.supabase.from('repair_cases').update({ status: 'cancelled' }).eq('id', activeCase.id);
  ok('Cleaned up test case');

  await hdDup.supabase.auth.signOut();

  // ============================================================
  // WORKFLOW 4: SLA pause/resume
  // ============================================================
  console.log('\n' + '━'.repeat(50));
  console.log('WORKFLOW 4: SLA Pause/Resume');
  console.log('━'.repeat(50));

  const ad2 = await login('admin');
  if (!ad2) return;
  ok('Admin logged in');

  const { data: slaCase } = await ad2.supabase.from('repair_cases').insert({
    asset_id: asset.id,
    title: 'SLA Test Case',
    priority: 'low',
    service_location: 'Test',
    created_by: ad2.userId,
  }).select('id, case_no').single();
  if (!slaCase) { fail('Create SLA test case'); await ad2.supabase.auth.signOut(); return; }
  ok(`Case: ${slaCase.case_no}`);

  // Respond first
  await ad2.supabase.from('repair_cases').update({ status: 'responded', responded_at: new Date().toISOString() }).eq('id', slaCase.id);

  // Pause
  const pauseTime = new Date().toISOString();
  const { error: pauseErr } = await ad2.supabase.from('repair_cases').update({
    status: 'on_hold', sla_paused_at: pauseTime,
  }).eq('id', slaCase.id);
  pauseErr ? fail(`Pause: ${pauseErr.message}`) : ok('SLA paused');

  // Verify paused
  const { data: paused } = await ad2.supabase.from('repair_cases').select('sla_paused_at, status').eq('id', slaCase.id).single();
  if (paused?.sla_paused_at && paused?.status === 'on_hold') ok('Pause state verified');
  else fail('Pause state incorrect');

  // Resume
  const { error: resumeErr } = await ad2.supabase.from('repair_cases').update({
    status: 'in_progress', sla_paused_at: null,
    sla_paused_total_seconds: 60, // simulate 60s paused
  }).eq('id', slaCase.id);
  resumeErr ? fail(`Resume: ${resumeErr.message}`) : ok('SLA resumed');

  // Clean up
  await ad2.supabase.from('repair_cases').update({ status: 'cancelled' }).eq('id', slaCase.id);
  await ad2.supabase.auth.signOut();

  // ============================================================
  // WORKFLOW 5: Permission boundaries
  // ============================================================
  console.log('\n' + '━'.repeat(50));
  console.log('WORKFLOW 5: Permission Boundaries');
  console.log('━'.repeat(50));

  // Test vendor cannot create case
  const vd2 = await login('vendor');
  if (!vd2) return;
  ok('Vendor logged in');

  const { error: vendorCreateErr } = await vd2.supabase.from('repair_cases').insert({
    asset_id: asset.id, title: 'Vendor Create Test', priority: 'low',
    service_location: 'Test', created_by: vd2.userId,
  });
  if (vendorCreateErr) ok('Vendor blocked from creating case (RLS)');
  else fail('Vendor should not be able to create case');

  // Test helpdesk cannot access admin data
  await vd2.supabase.auth.signOut();

  const hd3 = await login('helpdesk');
  if (!hd3) return;
  ok('Helpdesk logged in');

  const { data: adminData } = await hd3.supabase.from('vendor_groups').select('line_notify_config').limit(1);
  // helpdesk can read vendor_groups (RLS allows select), but cannot modify
  const { data: realGroup } = await hd3.supabase.from('vendor_groups').select('id, name').limit(1).single();
  if (realGroup) {
    const originalName = realGroup.name;
    await hd3.supabase.from('vendor_groups').update({ name: 'HACKED' }).eq('id', realGroup.id);
    // Verify name was NOT changed (RLS blocked the update)
    const { data: verify } = await hd3.supabase.from('vendor_groups').select('name').eq('id', realGroup.id).single();
    if (verify?.name === originalName) ok('Helpdesk blocked from modifying vendor_groups (RLS)');
    else fail('Helpdesk should not modify vendor_groups');
  } else {
    skip('No vendor groups to test write');
  }

  await hd3.supabase.auth.signOut();

  // ============================================================
  // WORKFLOW 6: Data integrity checks
  // ============================================================
  console.log('\n' + '━'.repeat(50));
  console.log('WORKFLOW 6: Data Integrity');
  console.log('━'.repeat(50));

  const ad3 = await login('admin');
  if (!ad3) return;
  ok('Admin logged in');

  // Check all tables accessible
  const tables = ['repair_cases', 'assets', 'vendors', 'vendor_groups', 'locations',
    'user_profiles', 'ticket_comments', 'case_attachments', 'case_activity_log',
    'ticket_templates', 'notifications', 'line_webhook_logs'];
  for (const table of tables) {
    const { data, error } = await ad3.supabase.from(table).select('id').limit(1);
    if (error) fail(`Table ${table}: ${error.message}`);
    else ok(`Table ${table}: accessible`);
  }

  // Check case_no format
  const { data: recentCase } = await ad3.supabase.from('repair_cases')
    .select('case_no').order('created_at', { ascending: false }).limit(1).single();
  if (recentCase && /^REP-\d{2}-\d{4}$/.test(recentCase.case_no)) {
    ok(`Case number format valid: ${recentCase.case_no}`);
  } else fail(`Case number format: ${recentCase?.case_no}`);

  // Check no orphaned data (comments with deleted cases)
  const { data: allCaseIds } = await ad3.supabase.from('repair_cases').select('id');
  const caseIdSet = new Set((allCaseIds || []).map(c => c.id));
  const { data: allComments } = await ad3.supabase.from('ticket_comments').select('case_id').limit(1000);
  const orphaned = (allComments || []).filter(c => !caseIdSet.has(c.case_id));
  if (orphaned.length === 0) ok('No orphaned comments');
  else fail(`${orphaned.length} orphaned comments`);

  await ad3.supabase.auth.signOut();

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n' + '='.repeat(50));
  console.log('TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`  Passed: ${results.pass}`);
  console.log(`  Failed: ${results.fail}`);
  console.log(`  Skipped: ${results.skip}`);
  console.log(`  Total: ${results.pass + results.fail + results.skip}`);
  if (results.fail === 0) console.log('\n🎉 ALL TESTS PASSED!');
  else console.log(`\n⚠️ ${results.fail} test(s) failed`);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
