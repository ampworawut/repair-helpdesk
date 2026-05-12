# Manual Test Guide for Vendor Group Fix

## 🎯 Test Objective
Verify that vendor group creation works correctly after the database fix.

## 🌐 Live Site URL
https://usam-repairdesk.vercel.app/

## 🔐 Login Credentials Needed
- Admin user credentials (email/password)

## 📋 Test Steps

### 1. Login to Admin Panel
1. Go to https://usam-repairdesk.vercel.app/
2. Login with admin credentials
3. Verify you see the dashboard

### 2. Navigate to Vendor Groups
1. Click on "Admin" in the sidebar
2. Click on "กลุ่มบริษัท" (Vendor Groups)
3. Verify the vendor groups page loads without errors

### 3. Create a New Vendor Group
1. Click "สร้างกลุ่มใหม่" (Create New Group)
2. Fill in the form:
   - **ชื่อกลุ่ม**: Test Vendor Group
   - **คำอธิบาย**: Test group for verification
   - **LINE Group ID**: test-line-group-123
3. Click "สร้าง" (Create)

### 4. Verify Successful Creation
✅ **Expected Results:**
- No error messages appear
- New vendor group appears in the list
- LINE Group ID shows as "test-line-group-123"
- Can expand the group to see details

### 5. Test LINE Notification Configuration
1. Expand the new vendor group
2. Scroll to "ตั้งค่าการแจ้งเตือน" (Notification Settings)
3. Toggle some notification options
4. Click "บันทึกการตั้งค่า" (Save Settings)

### 6. Test Vendor Assignment
1. Under the vendor group, try to assign an existing vendor
2. Verify vendors can be added to the group

## 🚨 Error Scenarios (Should NOT Happen)

❌ **If you see these errors, the fix didn't work:**
- "column \"line_group_id\" does not exist"
- Database constraint violations
- Any SQL-related errors when creating/editing vendor groups

## ✅ Success Indicators

- ✅ Vendor groups can be created without errors
- ✅ LINE Group ID field works correctly
- ✅ Notification settings can be configured
- ✅ Vendors can be assigned to groups
- ✅ No database errors in the console

## 📝 Test Data for Verification

**Vendor Group 1:**
- Name: NSTDA IT Group
- Description: Internal IT support team
- LINE Group ID: nstda-it-support

**Vendor Group 2:**
- Name: External Vendor Network
- Description: External service providers
- LINE Group ID: external-vendors

## 🔧 If Errors Persist

1. **Check browser console** for any error messages
2. **Verify database migration** ran successfully in Supabase
3. **Hard refresh** the page (Ctrl+F5)
4. **Clear browser cache** and try again

## 📊 Expected Final Result

After successful testing, you should be able to:
- Create unlimited vendor groups
- Configure LINE notifications for each group
- Manage vendor assignments seamlessly
- Use full LINE integration features