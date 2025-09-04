---
title: "Budget Buckets - Secret Rotation Procedures"
owner: "engineering"
status: "active"
last_review: "2025-08-20"
tags: ["runbook", "security", "secrets"]
---

# Secret Rotation Procedures

Security procedures for rotating API keys, certificates, and other sensitive credentials in Budget Buckets.

## Secret Inventory

### Firebase Secrets

| Secret Type | Location | Rotation Frequency | Risk Level |
|-------------|----------|-------------------|------------|
| Firebase API Key | `auth/firebase-config.js` | Annually | Medium |
| Project ID | `auth/firebase-config.js` | Never (immutable) | Low |
| App ID | `auth/firebase-config.js` | Never (immutable) | Low |
| Messaging Sender ID | `auth/firebase-config.js` | Never (immutable) | Low |

### OAuth Secrets

| Secret Type | Location | Rotation Frequency | Risk Level |
|-------------|----------|-------------------|------------|
| Google OAuth Client ID | Firebase Console | Annually | High |
| Google OAuth Client Secret | Firebase Console | Annually | High |

### Infrastructure Secrets

| Secret Type | Location | Rotation Frequency | Risk Level |
|-------------|----------|-------------------|------------|
| Firebase Service Account | Google Cloud Console | Annually | High |
| Domain SSL Certificate | Auto-managed by Firebase | Automatic | Medium |
| DNS API Keys | Domain Provider | Annually | Medium |

## Pre-Rotation Checklist

### 1. Schedule Rotation
- [ ] Plan rotation during low-usage hours
- [ ] Notify team members 48 hours in advance
- [ ] Prepare rollback plan
- [ ] Backup current configuration
- [ ] Test rotation in development environment

### 2. Development Environment Testing
```bash
# 1. Create test Firebase project
firebase projects:create budget-buckets-rotation-test

# 2. Test secret rotation procedures
# Follow rotation steps using test project

# 3. Verify application functionality
# Run full test suite with new secrets

# 4. Document any issues encountered
```

### 3. Access Verification
- [ ] Firebase Console admin access
- [ ] Google Cloud Console access
- [ ] Domain registrar access
- [ ] GitHub repository access
- [ ] Deployment pipeline access

## Rotation Procedures

### Firebase API Key Rotation

**Frequency:** Annually or on suspected compromise  
**Impact:** Medium - requires application redeployment  
**Downtime:** ~5-10 minutes

#### 1. Generate New API Key
```bash
# Firebase Console method:
# 1. Go to Firebase Console → Project Settings → General
# 2. Scroll to "Your apps" section
# 3. Click on web app (Budget Buckets)
# 4. Click "Generate new config"
# 5. Copy new configuration object

# Alternative: Firebase CLI method
firebase apps:list
firebase apps:sdkconfig web APP_ID
```

#### 2. Update Configuration
```javascript
// 1. Backup current configuration
cp auth/firebase-config.js auth/firebase-config.js.backup

// 2. Update with new API key
// Edit auth/firebase-config.js:
const firebaseConfig = {
  apiKey: "NEW_API_KEY_HERE", // Updated
  authDomain: "budget-buckets-prod.firebaseapp.com",
  projectId: "budget-buckets-prod",
  storageBucket: "budget-buckets-prod.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456789",
  measurementId: "G-XXXXXXXXXX"
};
```

#### 3. Deploy and Verify
```bash
# 1. Test in development
firebase emulators:start
# Visit localhost:8080 and verify authentication works

# 2. Deploy to production
firebase deploy --only hosting

# 3. Verify production functionality
curl -I https://budgetbucket.app/
# Visit https://budgetbucket.app/test/smoke-test.html?autorun=true

# 4. Monitor for 24 hours
# Check error logs for authentication failures
```

#### 4. Cleanup
```bash
# After 7 days of successful operation:
# 1. Remove old API key from Firebase Console
# Firebase Console → Project Settings → General → API Keys
# 2. Delete backup configuration file
rm auth/firebase-config.js.backup
```

### Google OAuth Credentials Rotation

**Frequency:** Annually or on suspected compromise  
**Impact:** High - affects user authentication  
**Downtime:** None (seamless transition possible)

#### 1. Create New OAuth Credentials
```bash
# Google Cloud Console:
# 1. Go to APIs & Services → Credentials
# 2. Click "Create Credentials" → "OAuth 2.0 Client ID"
# 3. Application type: Web application
# 4. Name: "Budget Buckets Web (New)"
# 5. Authorized domains: budgetbucket.app
# 6. Authorized redirect URIs:
#    - https://budgetbucket.app/__/auth/handler
#    - https://budget-buckets-prod.firebaseapp.com/__/auth/handler
```

#### 2. Update Firebase Configuration
```bash
# Firebase Console:
# 1. Go to Authentication → Sign-in method
# 2. Click "Google" provider
# 3. Replace Client ID with new value
# 4. Replace Client Secret with new value
# 5. Save configuration

# Note: Old credentials remain active during transition
```

#### 3. Test New Credentials
```bash
# 1. Test Google sign-in flow
# Visit https://budgetbucket.app/auth/login.html
# Try signing in with Google OAuth

# 2. Test both new and existing users
# Verify existing users can still sign in
# Verify new users can create accounts

# 3. Monitor authentication metrics
# Firebase Console → Authentication → Users
# Check for any authentication failures
```

#### 4. Remove Old Credentials
```bash
# After 48 hours of successful operation:
# Google Cloud Console → APIs & Services → Credentials
# Delete old OAuth 2.0 Client ID

# Verify no impact:
# Monitor authentication success rates for 24 hours
```

### Firebase Service Account Rotation

**Frequency:** Annually or on suspected compromise  
**Impact:** High if used for server-side operations  
**Note:** Budget Buckets primarily uses client-side Firebase, so service account usage is minimal

#### 1. Generate New Service Account
```bash
# Google Cloud Console:
# 1. Go to IAM & Admin → Service Accounts
# 2. Click existing service account or create new one
# 3. Go to Keys tab → Add Key → Create New Key
# 4. Choose JSON format
# 5. Download key file securely

# CLI method:
gcloud iam service-accounts keys create new-key.json \
  --iam-account=firebase-adminsdk-xyz@budget-buckets-prod.iam.gserviceaccount.com
```

#### 2. Update Application Configuration
```bash
# If using service account in server-side code:
# 1. Replace service account key file
# 2. Update environment variables
export GOOGLE_APPLICATION_CREDENTIALS="path/to/new-key.json"

# 3. Restart services that use service account
# (Budget Buckets currently has no server-side components)
```

#### 3. Verify and Cleanup
```bash
# 1. Test any server-side operations
# 2. Monitor for authentication errors
# 3. After 7 days, delete old service account key
gcloud iam service-accounts keys delete OLD_KEY_ID \
  --iam-account=firebase-adminsdk-xyz@budget-buckets-prod.iam.gserviceaccount.com
```

### Domain SSL Certificate Rotation

**Frequency:** Automatic (Firebase manages)  
**Manual Action:** None required  
**Monitoring:** Verify certificate validity

#### Monitor Certificate Status
```bash
# Check certificate expiration
openssl s_client -connect budgetbucket.app:443 -servername budgetbucket.app 2>/dev/null | \
openssl x509 -noout -dates

# Expected: Firebase automatically renews certificates
# Alert if expiration < 30 days
```

### DNS API Keys Rotation

**Frequency:** Annually  
**Impact:** Medium - affects domain management  
**Note:** Only needed if using DNS API for automation

#### 1. Generate New DNS API Key
```bash
# Domain provider specific steps:
# Example for common providers:

# Cloudflare:
# 1. Dashboard → My Profile → API Tokens
# 2. Create Token → Custom token
# 3. Zone:Zone:Read, Zone:DNS:Edit permissions
# 4. Include: All zones or specific zone

# Namecheap:
# 1. Account → Profile → Tools → Namecheap API Access
# 2. Enable API access
# 3. Generate new key
```

#### 2. Update Configuration
```bash
# Update DNS automation scripts/tools
# Replace old API key with new key
# Test DNS operations work correctly

# Example script update:
# sed -i 's/OLD_API_KEY/NEW_API_KEY/g' dns-update-script.sh
```

#### 3. Test and Cleanup
```bash
# 1. Test DNS operations
# 2. Monitor for 7 days
# 3. Revoke old API key from provider dashboard
```

## Emergency Rotation Procedures

### Suspected Compromise Response

**Timeline:** Complete within 4 hours

#### 1. Immediate Actions (0-30 minutes)
```bash
# 1. Assess scope of compromise
# - Which secrets are potentially compromised?
# - How was compromise discovered?
# - Is there evidence of misuse?

# 2. Revoke compromised secrets immediately
# Firebase Console → Project Settings → API Keys → Disable
# Google Cloud Console → IAM → Service Accounts → Disable

# 3. Enable emergency monitoring
# Monitor authentication attempts
# Watch for unusual data access patterns
```

#### 2. Generate New Secrets (30-60 minutes)
```bash
# Follow accelerated rotation procedures:
# 1. Generate new secrets immediately
# 2. Skip development testing (emergency deployment)
# 3. Deploy new configuration
# 4. Monitor for service disruption
```

#### 3. Investigate and Recover (1-4 hours)
```bash
# 1. Complete security investigation
# - Review access logs
# - Identify compromise vector
# - Assess data exposure

# 2. Complete service recovery
# - Verify all services operational
# - Test user authentication
# - Monitor error rates

# 3. Communication
# - Internal team notification
# - User communication if data exposed
# - Security incident report
```

## Monitoring and Alerting

### Secret Expiration Monitoring

```javascript
// Automated certificate monitoring
const checkCertificateExpiry = async () => {
  const domains = ['budgetbucket.app', 'www.budgetbucket.app'];
  
  for (const domain of domains) {
    try {
      const cert = await getCertificateInfo(domain);
      const daysToExpiry = Math.floor((cert.validTo - Date.now()) / (1000 * 60 * 60 * 24));
      
      if (daysToExpiry < 30) {
        await alertTeam(`SSL certificate for ${domain} expires in ${daysToExpiry} days`);
      }
    } catch (error) {
      await alertTeam(`Failed to check SSL certificate for ${domain}: ${error.message}`);
    }
  }
};

// Run daily
setInterval(checkCertificateExpiry, 24 * 60 * 60 * 1000);
```

### Access Pattern Monitoring

```javascript
// Unusual authentication pattern detection
const monitorAuthPatterns = async () => {
  const recentLogins = await getRecentAuthenticationEvents();
  
  // Check for suspicious patterns:
  // - Login attempts from new geographic locations
  // - High volume of failed authentication attempts
  // - Authentication from unusual IP addresses
  
  const suspiciousEvents = recentLogins.filter(event => {
    return event.failureRate > 0.1 || // >10% failure rate
           event.newLocation || 
           event.unusualUserAgent;
  });
  
  if (suspiciousEvents.length > 0) {
    await alertSecurityTeam('Suspicious authentication patterns detected', suspiciousEvents);
  }
};
```

## Automation Scripts

### Rotation Reminder Script

```bash
#!/bin/bash
# rotation-reminder.sh - Run monthly via cron

# Check secret ages and send reminders

# Firebase API key rotation (annual)
config_modified=$(stat -c %Y auth/firebase-config.js)
current_time=$(date +%s)
days_old=$(( (current_time - config_modified) / 86400 ))

if [ $days_old -gt 330 ]; then  # 330 days = reminder at 11 months
  echo "Firebase API key is ${days_old} days old - rotation due soon" | \
  mail -s "Secret Rotation Reminder" engineering@company.com
fi

# OAuth credentials (check via API if possible)
# SSL certificates (check expiration)
cert_expiry=$(openssl s_client -connect budgetbucket.app:443 -servername budgetbucket.app 2>/dev/null | \
             openssl x509 -noout -enddate | cut -d= -f2)
expiry_epoch=$(date -d "$cert_expiry" +%s)
days_to_expiry=$(( (expiry_epoch - current_time) / 86400 ))

if [ $days_to_expiry -lt 60 ]; then
  echo "SSL certificate expires in ${days_to_expiry} days" | \
  mail -s "Certificate Expiration Warning" engineering@company.com
fi
```

### Configuration Backup Script

```bash
#!/bin/bash
# backup-config.sh - Run before each rotation

timestamp=$(date +%Y%m%d-%H%M%S)
backup_dir="backups/secrets-${timestamp}"
mkdir -p "$backup_dir"

# Backup Firebase configuration
cp auth/firebase-config.js "$backup_dir/"

# Backup Firebase rules and indexes
firebase firestore:rules:get > "$backup_dir/firestore.rules"
firebase firestore:indexes:list > "$backup_dir/firestore.indexes.json"

# Export current Firebase project configuration  
firebase projects:list > "$backup_dir/firebase-projects.txt"

# Create restoration script
cat > "$backup_dir/restore.sh" << 'EOF'
#!/bin/bash
echo "Restoring configuration from backup..."
cp firebase-config.js ../auth/
firebase firestore:rules:release firestore.rules
echo "Configuration restored. Please test thoroughly."
EOF

chmod +x "$backup_dir/restore.sh"

echo "Configuration backed up to $backup_dir"
echo "To restore: cd $backup_dir && ./restore.sh"
```

## Documentation and Compliance

### Rotation Log Template

```markdown
# Secret Rotation Log: [DATE]

## Secrets Rotated
- [ ] Firebase API Key
- [ ] Google OAuth Client ID/Secret  
- [ ] Service Account Key
- [ ] DNS API Key
- [ ] Other: ___________

## Pre-Rotation Checklist
- [ ] Development environment tested
- [ ] Team notified 48 hours prior
- [ ] Backup configuration created
- [ ] Rollback plan documented

## Rotation Steps
1. **[TIME]** - Started rotation process
2. **[TIME]** - Generated new secrets
3. **[TIME]** - Updated configuration
4. **[TIME]** - Deployed to production  
5. **[TIME]** - Verified functionality
6. **[TIME]** - Completed rotation

## Post-Rotation Verification
- [ ] Authentication working normally
- [ ] All services operational
- [ ] No error rate increases
- [ ] User experience unaffected

## Issues Encountered
[Document any problems and resolutions]

## Cleanup Schedule
- **[DATE]** - Remove old secrets
- **[DATE]** - Delete backup files
- **[DATE]** - Update documentation

**Rotation completed by:** [NAME]
**Verified by:** [NAME]
**Next rotation due:** [DATE]
```

### Security Compliance

- **SOC 2**: Regular secret rotation supports access control requirements
- **ISO 27001**: Documented procedures for cryptographic key management
- **PCI DSS**: If payment processing added, key rotation is required
- **GDPR**: Proper key management protects personal data encryption

## References

- [Security Configuration](../reference/configuration.md)
- [System Architecture](../architecture/system-overview.md)
- [Incident Response Playbook](./incident-playbook.md)
- [Firebase Security Documentation](https://firebase.google.com/docs/security)
- [Google Cloud Security Best Practices](https://cloud.google.com/security/best-practices)