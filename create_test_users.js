const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTestUsers() {
  const users = [
    { email: 'admin@test.com', password: 'password123', display_name: 'Admin User', role: 'admin' },
    { email: 'supervisor@test.com', password: 'password123', display_name: 'Supervisor User', role: 'supervisor' },
    { email: 'helpdesk@test.com', password: 'password123', display_name: 'Helpdesk User', role: 'helpdesk' },
    { email: 'vendor@test.com', password: 'password123', display_name: 'Vendor Staff', role: 'vendor_staff' }
  ];

  for (const user of users) {
    try {
      console.log('Creating user:', user.email);
      
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { display_name: user.display_name }
      });

      if (authError) {
        console.log('Auth error:', user.email, authError.message);
        continue;
      }

      const { error: profileError } = await supabase.from('user_profiles').insert({
        id: authUser.user.id,
        display_name: user.display_name,
        role: user.role,
        email: user.email,
        is_active: true
      });

      if (profileError) {
        console.log('Profile error:', user.email, profileError.message);
        await supabase.auth.admin.deleteUser(authUser.user.id);
      } else {
        console.log('✓ Created user:', user.email, 'with role:', user.role);
      }
    } catch (err) {
      console.log('Error creating', user.email, err.message);
    }
  }
}

createTestUsers();