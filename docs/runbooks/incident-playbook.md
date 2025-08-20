---
title: "Budget Buckets - Incident Response Playbook"
owner: "engineering"
status: "active"
last_review: "2025-08-20"
tags: ["runbook", "incident", "emergency"]
---

# Incident Response Playbook

Comprehensive emergency response procedures for Budget Buckets service incidents.

## Incident Response Team

### Roles and Responsibilities

**Incident Commander**
- Overall incident coordination
- Decision making authority
- External communication
- Resource allocation

**Technical Lead**
- Root cause analysis
- Technical solution implementation
- System recovery coordination
- Post-incident technical review

**Communications Lead**
- User communication
- Status page updates
- Internal team updates
- Stakeholder notifications

## Incident Classification

### Severity Levels

#### **S1 - Critical** 
🔴 **Total Service Failure**
- Complete application unavailability
- Data loss or corruption
- Security breach
- All users affected

**Response Time**: 5 minutes  
**Escalation**: Immediate (all hands)  
**Communication**: Every 15 minutes

#### **S2 - High**
🟡 **Major Service Degradation**
- Core functionality broken (login, data save/load)
- >50% of users affected
- Significant performance degradation
- Security vulnerability

**Response Time**: 15 minutes  
**Escalation**: 30 minutes if not resolved  
**Communication**: Every 30 minutes

#### **S3 - Medium**
🟠 **Service Impairment**
- Non-core functionality affected
- <50% of users affected
- Intermittent issues
- Performance issues

**Response Time**: 1 hour  
**Escalation**: 2 hours if not resolved  
**Communication**: Every hour

#### **S4 - Low**
🟢 **Minor Issues**
- Cosmetic issues
- Single user reports
- Non-critical functionality
- Documentation issues

**Response Time**: Next business day  
**Escalation**: If pattern emerges  
**Communication**: Weekly summary

## Incident Detection

### Automated Monitoring

```javascript
// Client-side error detection
window.addEventListener('error', (event) => {
  const severity = classifyError(event.error);
  if (severity >= 'S3') {
    alertIncidentTeam(event.error);
  }
});

function classifyError(error) {
  // Firebase initialization failure = S2
  if (error.message.includes('Firebase: No Firebase App')) {
    return 'S2';
  }
  
  // Authentication failures = S2  
  if (error.message.includes('auth/')) {
    return 'S2';
  }
  
  // Database errors = S3
  if (error.message.includes('firestore/')) {
    return 'S3';
  }
  
  return 'S4';
}
```

### Manual Detection Sources

1. **User Reports**
   - Direct user feedback
   - Social media mentions
   - Support requests

2. **System Monitoring**
   - Health check failures
   - Performance degradation
   - Error rate increases

3. **External Services**
   - Firebase status page changes
   - Third-party service outages

## Response Procedures

### Immediate Response (0-5 minutes)

#### 1. Acknowledge Incident
```bash
# Create incident record
INCIDENT_ID="INC-$(date +%Y%m%d-%H%M%S)"
echo "Incident ${INCIDENT_ID} - $(date)" > incidents/${INCIDENT_ID}.md

# Alert team
# Slack: @channel INCIDENT ${INCIDENT_ID} - [Brief description]
# Email: incident-team@company.com
```

#### 2. Initial Assessment
```bash
# Quick health checks
curl -I https://budgetbucket.app/  # Homepage
curl -I https://budgetbucket.app/auth/login.html  # Auth page
curl -I https://firebase.googleapis.com/  # Firebase API

# Check Firebase status
curl -s https://status.firebase.google.com/incidents.json | jq '.incidents[0]'

# Test core functionality
# Visit: https://budgetbucket.app/test/smoke-test.html?autorun=true
```

#### 3. Classify and Escalate
```markdown
**Incident Classification Checklist:**
- [ ] Can users access homepage?
- [ ] Can users sign in?  
- [ ] Can users load budget data?
- [ ] Can users save changes?
- [ ] Are there security concerns?

**Impact Assessment:**
- Affected users: [All/Some/Specific features]
- Duration: [Time since first report]
- User-facing impact: [Description]
```

### Investigation Phase (5-30 minutes)

#### 1. Gather Evidence

**System Logs**
```bash
# Firebase Console logs
# Go to: https://console.firebase.google.com/project/budget-buckets-prod/overview

# Browser console errors (from user reports)
# Collect:
# - Error messages
# - Stack traces
# - Browser/OS information
# - Steps to reproduce
```

**Recent Changes**
```bash
# Check recent deployments
firebase hosting:releases:list --limit 5

# Review recent commits
git log --oneline -10

# Check Firebase configuration changes
firebase firestore:rules:get > current-rules.txt
diff current-rules.txt previous-rules.txt
```

#### 2. Root Cause Analysis

**Common Failure Modes:**

| Symptom | Likely Cause | Investigation Steps |
|---------|-------------|-------------------|
| 5xx errors on homepage | Firebase Hosting issue | Check Firebase status, try redeploy |
| Authentication failures | Auth configuration issue | Check authorized domains, OAuth setup |
| Database errors | Firestore rules or connectivity | Test rules, check quotas |
| Slow performance | Network or query issues | Check CDN, review slow queries |
| JavaScript errors | Code deployment issue | Check console, compare with previous version |

**Investigation Commands:**
```bash
# Test specific components
# Authentication:
firebase auth:export test-users.json --project budget-buckets-prod

# Database connectivity:
firebase firestore:indexes:list --project budget-buckets-prod

# Hosting status:
firebase hosting:channel:list --project budget-buckets-prod
```

### Resolution Phase (30+ minutes)

#### 1. Implement Fix

**Quick Fixes (S1/S2 incidents)**
```bash
# Rollback to previous version
PREVIOUS_RELEASE=$(firebase hosting:releases:list --limit 2 | tail -1)
firebase hosting:clone ${PREVIOUS_RELEASE} current

# Emergency maintenance page
echo "<h1>Budget Buckets is temporarily unavailable. We're working to restore service.</h1>" > maintenance.html
firebase deploy --only hosting:maintenance

# Clear CDN cache (if applicable)
# Firebase Hosting: No manual cache clear, redeploy instead
```

**Configuration Fixes**
```bash
# Fix Firestore rules
firebase firestore:rules:release backup-rules.txt

# Update authentication settings
# Firebase Console → Authentication → Settings
# Verify authorized domains, OAuth configuration

# Environment configuration
# Check auth/firebase-config.js for production values
```

#### 2. Verify Resolution

**Automated Verification**
```bash
# Run comprehensive tests
curl "https://budgetbucket.app/test/smoke-test.html?autorun=true"

# Check key user flows
for endpoint in "/" "/auth/login.html" "/app/index.html"; do
  echo "Testing ${endpoint}:"
  curl -s -o /dev/null -w "%{http_code} - %{time_total}s\n" "https://budgetbucket.app${endpoint}"
done
```

**Manual Verification**
- [ ] Homepage loads correctly
- [ ] Login/signup flows work
- [ ] Existing users can access their data
- [ ] New users can create budgets
- [ ] Data saves and loads properly
- [ ] Performance is acceptable (< 3s page load)

## Communication Templates

### Initial Incident Alert

```markdown
🚨 **INCIDENT ALERT** 

**Incident ID:** ${INCIDENT_ID}
**Severity:** ${SEVERITY}
**Summary:** Brief description of the issue
**Impact:** Who is affected and how
**Status:** INVESTIGATING
**ETA:** Investigation in progress, updates every 15 minutes

**Next Update:** [TIME]
```

### Status Updates

```markdown
**Incident Update - ${INCIDENT_ID}**

**Time:** [TIMESTAMP]
**Status:** [INVESTIGATING/IDENTIFIED/FIXING/MONITORING]
**Progress:** What we've learned and what we're doing

**User Impact:** Current state of service
**ETA:** Estimated time to resolution (if known)
**Next Update:** [TIME]
```

### Resolution Notification

```markdown
✅ **INCIDENT RESOLVED - ${INCIDENT_ID}**

**Resolution Time:** [TIMESTAMP]
**Duration:** [TOTAL_DURATION]
**Root Cause:** Brief explanation
**Fix Applied:** What was changed

**Service Status:** Fully operational
**Monitoring:** Continuing to monitor for 24 hours

**Follow-up:** Post-incident review scheduled for [DATE]
```

## Escalation Procedures

### Internal Escalation

**Level 1** (0-15 minutes)
- Incident Commander + Technical Lead
- Focus on immediate mitigation

**Level 2** (15-30 minutes)
- Full engineering team
- Consider external help

**Level 3** (30+ minutes)
- Management notification
- Consider vendor support

### External Escalation

**Firebase Support**
```bash
# Create support case
# Priority levels:
# P1: Service down, all users affected
# P2: Core functionality impacted, many users affected  
# P3: Partial functionality impacted
# P4: General questions

# Include in support request:
# - Project ID: budget-buckets-prod
# - Incident timeline
# - Error messages and logs
# - Steps already taken
```

**Emergency Communication Channels**
- Firebase Support: https://console.firebase.google.com/support
- Google Cloud Support: https://console.cloud.google.com/support
- Community: Firebase Slack, Stack Overflow

## Post-Incident Procedures

### Immediate Actions (0-24 hours)

1. **Service Monitoring**
   - Monitor key metrics for 24 hours
   - Watch for related issues
   - Verify user satisfaction

2. **Data Integrity Check**
   ```bash
   # Verify no data loss
   # Check recent user budgets for consistency
   # Validate database counts match expected values
   ```

3. **User Communication**
   ```markdown
   **Service Update - All Clear**
   
   Budget Buckets is operating normally following today's service disruption.
   
   If you continue to experience any issues, please:
   - Refresh your browser
   - Clear browser cache if needed
   - Contact support if problems persist
   
   Thank you for your patience.
   ```

### Post-Incident Review (1-3 days)

#### Review Meeting Agenda
1. **Timeline Review** (10 minutes)
   - Incident detection
   - Response timeline
   - Resolution steps

2. **Root Cause Analysis** (15 minutes)
   - Technical root cause
   - Contributing factors
   - Why wasn't it prevented?

3. **Response Evaluation** (15 minutes)
   - What went well?
   - What could be improved?
   - Communication effectiveness

4. **Action Items** (10 minutes)
   - Prevention measures
   - Process improvements
   - Monitoring enhancements

#### Action Item Template
```markdown
**Post-Incident Action Items - ${INCIDENT_ID}**

**Prevention:**
- [ ] [Technical change to prevent recurrence]
- [ ] [Monitoring improvement]
- [ ] [Process update]

**Detection:**
- [ ] [Alerting improvement]
- [ ] [Monitoring enhancement]

**Response:**
- [ ] [Runbook update]
- [ ] [Tool improvement]
- [ ] [Communication improvement]

**Timeline:** All items due within 2 weeks
**Owner:** [Assigned team member]
**Review Date:** [Follow-up meeting date]
```

### Incident Documentation

#### Incident Report Template
```markdown
# Incident Report: ${INCIDENT_ID}

## Summary
Brief description of what happened and impact.

## Timeline
- **[TIME]** - Issue first detected
- **[TIME]** - Investigation began
- **[TIME]** - Root cause identified  
- **[TIME]** - Fix implemented
- **[TIME]** - Service fully restored
- **[TIME]** - Monitoring period completed

## Root Cause
Technical explanation of what caused the incident.

## Impact Assessment
- **Users Affected:** [Number/percentage]
- **Duration:** [Total downtime]
- **Functionality Affected:** [List of features]
- **Data Impact:** [Any data loss or corruption]

## Resolution
Detailed steps taken to resolve the issue.

## Lessons Learned
- What went well during the response
- What could be improved
- Specific action items for prevention

## Action Items
- [ ] [Specific improvements with owners and dates]
```

## Incident Prevention

### Proactive Monitoring

```javascript
// Enhanced error tracking
class IncidentDetector {
  constructor() {
    this.errorCounts = new Map();
    this.performanceMetrics = [];
  }
  
  trackError(error) {
    const errorKey = error.message.substring(0, 50);
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
    
    // Alert if error rate exceeds threshold
    if (this.errorCounts.get(errorKey) > 10) {
      this.alertIncidentTeam('High error rate detected', error);
    }
  }
  
  trackPerformance() {
    const metrics = performance.getEntriesByType('navigation')[0];
    this.performanceMetrics.push(metrics.loadEventEnd);
    
    // Alert if consistent slow performance
    const recent = this.performanceMetrics.slice(-5);
    if (recent.every(time => time > 5000)) {
      this.alertIncidentTeam('Consistent slow performance detected');
    }
  }
}
```

### Regular Health Checks

```bash
#!/bin/bash
# health-check.sh - Run every 5 minutes via cron

# Test key endpoints
endpoints=("/" "/auth/login.html" "/app/index.html")
failed=0

for endpoint in "${endpoints[@]}"; do
  response=$(curl -s -o /dev/null -w "%{http_code}" "https://budgetbucket.app${endpoint}")
  if [[ $response -ne 200 ]]; then
    echo "ALERT: ${endpoint} returned ${response}"
    failed=1
  fi
done

# Test smoke test
smoke_result=$(curl -s "https://budgetbucket.app/test/smoke-test.html?autorun=true")
if [[ $smoke_result == *"FAILED"* ]]; then
  echo "ALERT: Smoke test failed"
  failed=1
fi

# Alert if any checks failed
if [[ $failed -eq 1 ]]; then
  # Send alert to monitoring system
  echo "Health check failure at $(date)" | mail -s "Budget Buckets Health Check Failed" incidents@company.com
fi
```

## References

- [Service Restart Procedures](./restart-services.md)
- [Troubleshooting Guide](../guides/troubleshooting.md)
- [System Architecture](../architecture/system-overview.md)
- [Configuration Reference](../reference/configuration.md)
- [Deployment Guide](../guides/deploy.md)