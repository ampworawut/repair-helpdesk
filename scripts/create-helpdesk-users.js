// Create 17 helpdesk users with proper Supabase client
const { createClient } = require('@supabase/supabase-js');

const USERS = [
  ['วรรณวิมล ปัญญาจงถาวร', 'wanwimol.pan@nstda.or.th'],
  ['เอกรินทร์ อัญมณีเจริญ', 'akerintr.any@nstda.or.th'],
  ['กฤษดา ศรีสวัสดิ์', 'krissada.sri@nstda.or.th'],
  ['ศักดิ์มงคล ปารารัตน์', 'sakmongkhon.par@nstda.or.th'],
  ['ทวนทอง สนธิไชย', 'tuanthong.son@nstda.or.th'],
  ['ณรัชต์พล ภูวสิษฐ์ภากรณ์', 'naratchaphol.phu@nstda.or.th'],
  ['ธนบดี ทรงสกุล', 'tanabordee.son@nstda.or.th'],
  ['พนิดา กางกั้น', 'panida.kan@nstda.or.th'],
  ['หาญชัย หอมเศรษฐ์นันท์', 'hanchai.hom@nstda.or.th'],
  ['เอกราช รัตนวารี', 'akarach.rat@nstda.or.th'],
  ['สุรศักดิ์ วิทยากรวณิช', 'surasak.wit@nstda.or.th'],
  ['ฐิติวัตร อนุวงศ์ประพันธ์', 'thitiwatra.anu@nstda.or.th'],
  ['พัชรินทร์ พลีรักษ์', 'phatcharin.pli@ncr.nstda.or.th'],
  ['ภาณุพงษ์ มีแก้ว', 'panupong.mee@ncr.nstda.or.th'],
  ['ฉัตรชัย เพ็ชร์พวง', 'chatchai.pet@ncr.nstda.or.th'],
  ['ไตรภพ แก้วชมภู', 'triphop.kea@ncr.nstda.or.th'],
  ['วิทวัส สกุลธนนนท์', 'witawat.sak@ncr.nstda.or.th'],
];

async function createUsers() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  for (const [name, email] of USERS) {
    try {
      // Check if user already exists
      const { data: existing } = await supabase.from('user_profiles').select('id').eq('email', email).single();
      if (existing) {
        console.log(`⏭️ ${email} — already exists`);
        continue;
      }

      // Create auth user
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: 'P@ssw0rd',
        email_confirm: true,
        user_metadata: { display_name: name },
      });

      if (authError) {
        console.log(`❌ ${email}: ${authError.message}`);
        continue;
      }

      // Insert profile
      const { error: profileError } = await supabase.from('user_profiles').insert({
        id: authUser.user.id,
        display_name: name,
        role: 'helpdesk',
        email,
        is_active: true,
      });

      if (profileError) {
        console.log(`⚠️ ${email}: auth OK but profile failed: ${profileError.message}`);
      } else {
        console.log(`✅ ${name} (${email})`);
      }
    } catch (err) {
      console.log(`❌ ${email}: ${err.message}`);
    }
  }

  console.log('\nDone!');
}

createUsers();
