# Testing Vendor Group Creation on Live Site

## 🚀 Quick Test Steps

1. **Go to the live site**: https://usam-repairdesk.vercel.app/
2. **Login as admin user** (you'll need admin credentials)
3. **Navigate to Admin → Vendor Groups**
4. **Try to create a new vendor group**

## ✅ Expected Behavior (After Fix)

- ✅ Should be able to create vendor groups without errors
- ✅ Should see the LINE Group ID field in the form
- ✅ Should be able to save vendor groups with LINE Group IDs
- ✅ Should be able to configure LINE notifications

## 🔧 If You Still See Errors

If you still get errors about "line_group_id column does not exist", you need to run the migration on your **production Supabase database**:

### Run this SQL in Supabase Production SQL Editor:

```sql
-- Add the missing line_group_id column
ALTER TABLE vendor_groups ADD COLUMN IF NOT EXISTS line_group_id TEXT;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_vendor_groups_line_group_id ON vendor_groups(line_group_id);

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'vendor_groups' 
ORDER BY ordinal_position;
```

## 🧪 Manual Test Script

You can also run the automated test:

```bash
# Set your production environment variables
export NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
export NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key

# Run the test
node test_live_site.js
```

## 📋 What to Look For

1. **Before fix**: Errors when creating/editing vendor groups
2. **After fix**: Smooth vendor group creation with LINE Group ID support
3. **LINE Integration**: Ability to set LINE Group IDs and configure notifications

## 🆘 Troubleshooting

If issues persist:

1. **Check database permissions**: Ensure the admin user has proper RLS permissions
2. **Verify migration**: Confirm the SQL migration ran successfully
3. **Check environment variables**: Ensure production env vars are correct
4. **Clear cache**: Hard refresh the browser (Ctrl+F5)

## ✅ Success Indicators

- No error messages when creating vendor groups
- LINE Group ID field appears and works correctly
- Vendor groups can be saved and edited without issues
- LINE notification settings can be configured