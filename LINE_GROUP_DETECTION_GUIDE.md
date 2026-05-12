# LINE Group Detection System Guide

## 🎯 Overview

This system automatically detects LINE Group IDs when users add @repairdesk_bot to their LINE groups and send messages. It provides real-time detection in the admin panel.

## 🚀 New Features Added

### 1. Real-time Group Detection
- **Component**: `components/line-group-listener.tsx`
- **Location**: Admin → Vendor Groups page
- **Function**: Listens for LINE webhook events and displays detected Group IDs

### 2. Enhanced Webhook Handling
- **File**: `app/api/line/webhook/route.ts`
- **Feature**: Logs all webhook events to `line_webhook_logs` table
- **Benefit**: Enables real-time detection and debugging

### 3. New Database Table
- **Migration**: `supabase/migrations/005_line_webhook_logs.sql`
- **Table**: `line_webhook_logs`
- **Purpose**: Stores webhook events for detection and analysis

### 4. Smart Unregistered Group Handling
- **Feature**: Provides helpful messages to unregistered LINE groups
- **Commands**: `/register`, `/help` support

## 🧪 How to Test

### Prerequisites
1. LINE bot (@repairdesk_bot) configured with webhook
2. Database migrations applied
3. Admin access to the RepairDesk system

### Test Steps

#### 1. Database Setup
```bash
# Run the new migrations
node deploy_schema.js
# Or manually run in Supabase SQL editor:
# - 004_line_group_id.sql
# - 005_line_webhook_logs.sql
```

#### 2. Test Detection System
```bash
# Run automated tests
node test_line_detection.js
```

#### 3. Live Testing
1. **Add bot to LINE group**: Invite @repairdesk_bot to a test LINE group
2. **Send test message**: Type any message in the group
3. **Check admin panel**: 
   - Go to Admin → Vendor Groups
   - Click "เริ่มฟังการตรวจจับ"
   - The Group ID should appear automatically

#### 4. Manual Registration Test
1. **Create vendor group**: 
   - Name: "Test LINE Group"
   - LINE Group ID: [detected ID from step 3]
2. **Test notifications**: Configure which events to receive
3. **Verify functionality**: Send case numbers to test status lookup

## 🔧 Configuration

### Environment Variables
Ensure these are set in production:
```env
LINE_CHANNEL_SECRET=your_line_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_line_access_token
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### LINE Bot Setup
1. **Webhook URL**: `https://yourdomain.com/api/line/webhook`
2. **Webhook URL for detection**: `https://yourdomain.com/api/line/detect-group` (optional)
3. **Enable**: Message events, Join events

## 📋 Usage Instructions

### For Administrators
1. **Access detection tool**: Admin → Vendor Groups → "เริ่มฟังการตรวจจับ"
2. **Add bot to groups**: Invite @repairdesk_bot to LINE groups
3. **Detect Group IDs**: Send messages in groups, IDs appear automatically
4. **Create vendor groups**: Use detected IDs to create vendor groups
5. **Configure notifications**: Set which events each group receives

### For LINE Group Users
1. **Add bot**: Invite @repairdesk_bot to your LINE group
2. **Register**: Type `/register` to start registration (or send any message)
3. **Get help**: Type `/help` for instructions
4. **Check cases**: Type case numbers (e.g., "0001", "REP-26-0001")
5. **Attach images**: Send images to attach to open cases

## 🚨 Troubleshooting

### Common Issues

1. **"Group ID not detected"**
   - Verify bot is added to the LINE group
   - Check webhook URL configuration
   - Ensure database migrations are applied

2. **"Real-time not working"**
   - Check Supabase Realtime connection
   - Verify RLS policies allow access

3. **"Webhook errors"**
   - Validate LINE signature verification
   - Check environment variables

### Debugging Tools

1. **Webhook logs**: Check `line_webhook_logs` table
2. **Real-time monitoring**: Use browser developer tools
3. **LINE debug**: Enable LINE developer mode

## 📊 Monitoring

### Key Metrics
- Webhook events received
- Groups detected
- Registration success rate
- Notification delivery rate

### Log Tables
- `line_webhook_logs`: All incoming webhook events
- `vendor_groups`: Registered LINE groups
- `notifications`: Sent messages

## 🔒 Security

- **Signature verification**: All webhook requests validated
- **RLS policies**: Database access properly restricted
- **Rate limiting**: Consider implementing for production
- **Data retention**: Webhook logs auto-cleaned after 7 days

## 🎉 Success Indicators

- ✅ LINE Group IDs detected automatically
- ✅ Real-time updates in admin panel
- ✅ Smooth vendor group creation
- ✅ LINE notifications working correctly
- ✅ No error messages in console

## 📝 Support

For issues with LINE group detection:
1. Check this guide first
2. Verify database migrations
3. Test with automated scripts
4. Check LINE developer console
5. Review webhook logs

## 🔄 Future Enhancements

Potential improvements:
- Automated group registration
- Bulk group management
- Advanced filtering
- Performance analytics
- Mobile notification support