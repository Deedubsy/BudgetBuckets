# Production Fixes Smoke Test Checklist

## 🔐 Email Verification

### Test Cases
- [ ] **Email/password signup shows verification banner**
  - Create new account with email/password
  - Banner appears with warning icon and text: "Verify your email to secure your account."
  - Two buttons visible: "Resend verification email" and "I've verified"

- [ ] **"Resend verification email" button works**
  - Click "Resend verification email"  
  - Alert shows: "Verification email sent!"
  - Check email inbox for verification email

- [ ] **"I've verified" button hides banner after verification**
  - Verify email using link from inbox
  - Click "I've verified" button
  - Banner disappears from UI

- [ ] **Google users never see verification banner**
  - Sign up/in with Google account
  - Banner never appears (Google accounts are auto-verified)

## 📊 Plan Detection & Bucket Limits

### Free Plan Tests
- [ ] **Free user sees "X/5 buckets" counter in header**
  - Sign in as free user
  - Header shows counter like "3/5 buckets"
  - Counter updates when buckets added/removed

- [ ] **Free user blocked at 6th bucket with upgrade prompt**
  - Create 5 buckets as free user
  - Try to add 6th bucket
  - Confirmation dialog: "Free plan allows up to 5 buckets. Upgrade to Plus for unlimited buckets?"
  - Click OK → navigates to Account page
  - Click Cancel → no bucket added

### Plus Plan Tests  
- [ ] **Plus user sees "X buckets" counter (no limit shown)**
  - Sign in as Plus user
  - Header shows counter like "8 buckets" (no "/5")
  - Can create unlimited buckets

- [ ] **Plus user can create unlimited buckets**
  - Create 10+ buckets as Plus user
  - All buckets created successfully
  - No upgrade prompts appear

### Counter Updates
- [ ] **Counter updates immediately after bucket add/delete**
  - Note current counter value
  - Add bucket → counter increases by 1
  - Delete bucket → counter decreases by 1
  - Updates happen without page reload

## 💳 Billing Integration

### Upgrade Flow
- [ ] **After successful Stripe checkout → return shows "Plus" without reload**
  - Complete Stripe checkout as free user
  - Return to app with `?upgraded=true` URL parameter
  - Plan badge shows "Plus" within 2 seconds
  - No page reload required
  - Bucket counter changes to unlimited format

### Downgrade Flow
- [ ] **After canceling subscription → plan shows "Free" quickly**
  - Cancel subscription in Stripe Customer Portal
  - Return to app (or focus tab)
  - Plan reverts to "Free" within 1-2 seconds or on tab focus
  - Bucket counter shows "/5" format again

### Manual Refresh
- [ ] **Manual "Refresh Plan" button in Account view works**
  - Go to Account page
  - Click "↻ Refresh Plan" button
  - Plan status updates immediately if changed
  - Works even if automatic refresh failed

## 🔒 Firestore Security

### Direct Database Tests
- [ ] **Direct Firestore write of 6th bucket fails for Free user**
  - Use Firebase console or direct SDK call
  - Try to write 6th budget document as Free user
  - Get permission-denied error
  - Plus users can write unlimited buckets

- [ ] **Bucket counter increments/decrements correctly**
  - Create bucket → `/users/{uid}/meta/bucketCounts.total` increments by 1
  - Delete bucket → counter decrements by 1
  - Counter stays consistent with actual bucket count

### Rule Validation
- [ ] **Plus user can write unlimited buckets to Firestore**
  - Create 10+ bucket documents as Plus user
  - All writes succeed
  - Counter increments correctly

## 👤 User Bootstrap

### New User Setup
- [ ] **New user gets user document with correct data**
  - Create new account
  - Check `/users/{uid}` document exists
  - Contains: `email`, `createdAt`, `plan: 'Free'`, `planSelected: false`

- [ ] **New user gets bucket counter document**
  - Check `/users/{uid}/meta/bucketCounts` document exists  
  - Contains: `total: 0`, `createdAt`

- [ ] **Existing users continue working without disruption**
  - Login with existing account
  - All buckets still visible and functional
  - No data lost during migration

## ⚠️ Error Handling

### Resilience Tests
- [ ] **Plan refresh failures don't break the app**
  - Simulate network failure during token refresh
  - App continues functioning
  - Error logged to console but UI stable

- [ ] **Billing return without valid user handled gracefully**
  - Access `/app?upgraded=true` without being logged in
  - No JavaScript errors
  - Graceful fallback behavior

- [ ] **Firestore batch write failures show user-friendly errors**
  - Simulate Firestore write failure
  - User sees helpful error message
  - App doesn't crash or become unusable

## 🎯 Integration Tests

### Full Workflow Tests
- [ ] **Free → Plus → Free workflow complete**
  1. Start as free user with 3 buckets
  2. Try adding 6th bucket → blocked with upgrade prompt
  3. Complete upgrade to Plus
  4. Add 6+ buckets successfully  
  5. Cancel subscription in portal
  6. Return to app → limited to 5 buckets again
  7. Excess buckets handled gracefully

- [ ] **Email verification → billing → plan changes**
  1. Sign up with unverified email → see banner
  2. Verify email → banner disappears
  3. Upgrade to Plus → plan badge updates
  4. All changes reflected immediately

### Cross-Tab/Window Tests
- [ ] **Plan changes sync across browser tabs**
  - Open app in 2 tabs
  - Change plan in one tab
  - Other tab reflects change within 2 seconds

## 📱 Browser Compatibility

### Supported Browsers
- [ ] **Chrome**: All features work
- [ ] **Firefox**: All features work  
- [ ] **Safari**: All features work
- [ ] **Edge**: All features work

### Mobile Testing
- [ ] **Mobile Chrome**: Responsive design, all buttons clickable
- [ ] **Mobile Safari**: iOS compatibility, touch interactions work

## 🚨 Critical Success Criteria

All of these MUST pass for production readiness:

- [ ] Free plan cannot exceed 5 buckets (UI + DB enforcement)
- [ ] Plus plan has unlimited buckets
- [ ] Email verification banner works for password users
- [ ] Plan changes reflect immediately after billing events
- [ ] New users get properly bootstrapped
- [ ] Existing users' data remains intact
- [ ] No console errors during normal operation
- [ ] Firestore security rules prevent abuse

---

## 🏁 Final Validation

After all tests pass:

1. [ ] Deploy to production Firebase project
2. [ ] Update Firestore rules in production  
3. [ ] Test with real Stripe webhooks
4. [ ] Monitor for 24 hours with real users
5. [ ] Confirm billing events update plans correctly

**Status**: ⏳ Ready for testing  
**Last Updated**: 2024-08-20