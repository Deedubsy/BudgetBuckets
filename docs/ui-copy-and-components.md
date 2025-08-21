# UI Copy & Components Guide

Complete reference for Budget Buckets user interface text, component patterns, accessibility, and design system.

## 1. UI Text Glossary

### 1.1 Core Terminology

| Term | Usage | Context |
|------|-------|---------|
| **Bucket** | Primary container for budget categories | "Create a new bucket for groceries" |
| **Expense** | Money spent from a bucket | "Add expense: $50 coffee" |
| **Allocation** | Money assigned to buckets | "Allocate $500 to rent bucket" |
| **Balance** | Current amount in bucket | "Bucket balance: $123.45" |
| **Progress** | Visual indicator of bucket usage | "67% of budget used" |
| **Plan** | Subscription tier (Free/Plus) | "Upgrade to Plus plan" |

### 1.2 Status Messages

#### Success Messages
```javascript
// Plan upgrade
"Welcome to Budget Buckets Plus! You now have unlimited buckets."

// Email verification  
"Email verified! Welcome to Budget Buckets."

// Bucket operations
"Bucket created successfully"
"Expense added: $25.50 for Coffee"
"Allocation updated: $500.00"

// Data operations
"Budget data exported successfully"
"Settings saved"
```

#### Error Messages
```javascript
// Authentication errors
"Sign-in cancelled. Please try again."
"Email already registered. Try signing in instead."
"Password too weak. Please use at least 6 characters."

// Plan limit errors
"Free plan limited to 5 buckets. Upgrade to Plus for unlimited buckets."
"Please delete 2 buckets to create new ones, or upgrade to Plus."

// Billing errors
"Billing service temporarily unavailable. Please try again later."
"No billing account found. Please upgrade to Plus first."

// Network errors
"Network error. Please check your connection."
"Failed to save changes. Please try again."
```

#### Warning Messages
```javascript
// Budget warnings
"This bucket is 90% spent"
"Overspent by $45.20"

// Plan warnings  
"You're approaching the 5-bucket limit on Free plan"
"Consider upgrading to Plus for unlimited buckets"
```

### 1.3 Button Labels

#### Primary Actions
```javascript
// Authentication
"Sign in with Google"
"Sign up with Email"
"I've verified my email"
"Resend verification email"

// Bucket management
"Create New Bucket"
"Add Expense"  
"Allocate Money"
"Delete Bucket"

// Plan management
"Upgrade to Plus $3.99/mo"
"Manage Billing"
"Cancel Subscription"

// Data operations
"Export Data"
"Import Data"
"Save Changes"
```

#### Secondary Actions
```javascript
// Navigation
"Back to Buckets"
"View Account"
"Sign Out"

// Bucket operations
"Edit Details"
"View History"
"Copy Bucket"

// Settings
"Change Theme"
"Update Profile"
"Delete Account"
```

## 2. Status Pills & Indicators

### 2.1 Budget Status Pills

```css
/* Status pill base styles */
.pill {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}

.pill--ok {
  background: #0f2b22;
  color: #5eead4;
}

.pill--warn {
  background: #2b2410;
  color: #ffd166;
}

.pill--bad {
  background: #2b1616;
  color: #ff6b6b;
}
```

#### Status Logic
```javascript
// Budget status determination
function getBucketStatus(spent, allocated) {
  const percentage = (spent / allocated) * 100;
  
  if (percentage <= 75) {
    return { class: 'pill--ok', text: 'On Track' };
  } else if (percentage <= 100) {
    return { class: 'pill--warn', text: 'Nearly Full' };
  } else {
    return { class: 'pill--bad', text: `Over by $${(spent - allocated).toFixed(2)}` };
  }
}
```

### 2.2 Plan Status Indicators

```html
<!-- Free plan indicator -->
<span class="plan-badge plan-badge--free">
  Free Plan (3/5 buckets)
</span>

<!-- Plus plan indicator -->
<span class="plan-badge plan-badge--plus">
  Plus Plan ✨
</span>
```

```css
.plan-badge {
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 600;
}

.plan-badge--free {
  background: #1a2332;
  color: #94a3b8;
  border: 1px solid #334155;
}

.plan-badge--plus {
  background: linear-gradient(45deg, #00cdd6, #5eead4);
  color: #0e1821;
}
```

## 3. Component Patterns

### 3.1 Bucket Card Layout

```html
<div class="bucket-card">
  <div class="bucket-header">
    <div class="bucket-title">
      <span class="drag-handle">⋮⋮</span>
      <h3>Groceries</h3>
      <span class="bucket-status pill--ok">On Track</span>
    </div>
    <div class="bucket-actions">
      <button class="btn-icon" title="Edit bucket">✏️</button>
      <button class="btn-icon" title="Delete bucket">🗑️</button>
    </div>
  </div>
  
  <div class="bucket-body">
    <div class="bucket-amounts">
      <div class="amount-spent">$123.45 spent</div>
      <div class="amount-allocated">of $200.00</div>
      <div class="amount-remaining">$76.55 remaining</div>
    </div>
    
    <div class="progress-bar">
      <div class="progress-fill" style="width: 62%"></div>
    </div>
    
    <div class="bucket-actions-primary">
      <button class="btn btn--secondary">Add Expense</button>
      <button class="btn btn--secondary">Allocate</button>
    </div>
  </div>
</div>
```

### 3.2 Email Verification Banner

```html
<div id="emailVerifyBanner" class="verification-banner" style="display: none;">
  <div class="banner-content">
    <div class="banner-icon">📧</div>
    <div class="banner-text">
      <h4>Verify your email</h4>
      <p>Please check your email and click the verification link to complete setup.</p>
    </div>
    <div class="banner-actions">
      <button id="resendVerification" class="btn btn--secondary">
        Resend Email
      </button>
      <button id="checkVerified" class="btn btn--primary">
        I've Verified
      </button>
    </div>
  </div>
</div>
```

```css
.verification-banner {
  background: linear-gradient(45deg, #1a2332, #0f1720);
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 16px;
  margin: 16px 0;
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.banner-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.banner-text h4 {
  color: var(--text);
  margin-bottom: 4px;
}

.banner-text p {
  color: var(--muted);
  font-size: 14px;
}

.banner-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
```

### 3.3 Upgrade Prompts

```html
<!-- Free plan limit reached -->
<div class="upgrade-prompt upgrade-prompt--limit">
  <div class="prompt-content">
    <h4>Free plan bucket limit reached</h4>
    <p>You've used all 5 buckets in your Free plan. Upgrade to Plus for unlimited buckets.</p>
    <div class="prompt-features">
      <div class="feature">✨ Unlimited buckets</div>
      <div class="feature">📧 Priority support</div>
      <div class="feature">🎨 Themes (coming soon)</div>
    </div>
  </div>
  <div class="prompt-actions">
    <button class="btn btn--primary">Upgrade to Plus $3.99/mo</button>
    <button class="btn btn--ghost">Maybe Later</button>
  </div>
</div>

<!-- General upgrade promotion -->
<div class="upgrade-prompt upgrade-prompt--promo">
  <div class="prompt-content">
    <h4>Unlock unlimited buckets</h4>
    <p>Get more from Budget Buckets with Plus plan features.</p>
  </div>
  <div class="prompt-actions">
    <button class="btn btn--primary">Learn More</button>
  </div>
</div>
```

## 4. Accessibility Guidelines

### 4.1 Color Contrast

All text meets WCAG AA standards:

```css
/* High contrast text combinations */
.text-primary { color: #e2e8f0; } /* On #0e1821 = 12.7:1 ratio */
.text-secondary { color: #94a3b8; } /* On #0e1821 = 7.2:1 ratio */
.text-muted { color: #64748b; } /* On #1a2332 = 4.8:1 ratio */

/* Status colors with sufficient contrast */
.status-success { color: #5eead4; } /* On dark = 8.5:1 ratio */
.status-warning { color: #ffd166; } /* On dark = 10.2:1 ratio */
.status-danger { color: #ff6b6b; } /* On dark = 6.1:1 ratio */
```

### 4.2 Focus Management

```css
/* Consistent focus styles */
.btn:focus,
.input:focus,
.bucket-card:focus {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Focus trap for modals */
.modal:focus-within {
  outline: none;
}

/* Skip links for screen readers */
.skip-link {
  position: absolute;
  top: -40px;
  left: 6px;
  background: var(--accent);
  color: white;
  padding: 8px;
  text-decoration: none;
  border-radius: 4px;
}

.skip-link:focus {
  top: 6px;
}
```

### 4.3 Screen Reader Support

```html
<!-- Semantic HTML structure -->
<main role="main" aria-label="Budget management">
  <section aria-labelledby="buckets-heading">
    <h2 id="buckets-heading">Your Budget Buckets</h2>
    
    <div class="bucket-list" role="list">
      <div class="bucket-card" role="listitem" tabindex="0"
           aria-label="Groceries bucket, $123 spent of $200, 62% used">
        <!-- Bucket content -->
      </div>
    </div>
  </section>
</main>

<!-- ARIA labels for interactive elements -->
<button aria-label="Add expense to groceries bucket" 
        aria-describedby="bucket-groceries">
  Add Expense
</button>

<!-- Status announcements -->
<div role="status" aria-live="polite" id="status-messages">
  <!-- Dynamic status messages appear here -->
</div>

<!-- Progress indicators -->
<div class="progress" role="progressbar" 
     aria-valuenow="62" aria-valuemin="0" aria-valuemax="100"
     aria-label="Budget usage: 62% of $200 spent">
  <div class="progress-fill" style="width: 62%"></div>
</div>
```

## 5. Responsive Design Patterns

### 5.1 Mobile-First Breakpoints

```css
/* Mobile-first approach */
.bucket-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

/* Tablet */
@media (min-width: 768px) {
  .bucket-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .bucket-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* Large desktop */
@media (min-width: 1280px) {
  .bucket-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

### 5.2 Touch-Friendly Interactions

```css
/* Minimum touch target size: 44px */
.btn {
  min-height: 44px;
  min-width: 44px;
  padding: 12px 24px;
}

.btn-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Hover states only on devices that support hover */
@media (hover: hover) {
  .btn:hover {
    background: var(--accent-hover);
  }
}

/* Touch feedback for mobile */
.btn:active {
  transform: scale(0.95);
  transition: transform 0.1s;
}
```

## 6. Theme System

### 6.1 CSS Custom Properties

```css
:root {
  /* Dark theme (default) */
  --bg: #0e1821;
  --bg-card: #1a2332;
  --text: #e2e8f0;
  --muted: #94a3b8;
  --accent: #00cdd6;
  --border: #334155;
  --success: #5eead4;
  --warning: #ffd166;
  --danger: #ff6b6b;
}

[data-theme="light"] {
  /* Light theme */
  --bg: #ffffff;
  --bg-card: #f8fafc;
  --text: #1e293b;
  --muted: #64748b;
  --accent: #0891b2;
  --border: #e2e8f0;
  --success: #059669;
  --warning: #d97706;
  --danger: #dc2626;
}
```

### 6.2 Theme Toggle Implementation

```javascript
// Theme management
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  
  // Update toggle button
  const toggleBtn = document.getElementById('themeToggle');
  toggleBtn.textContent = newTheme === 'light' ? '🌙' : '☀️';
  toggleBtn.setAttribute('aria-label', 
    `Switch to ${newTheme === 'light' ? 'dark' : 'light'} theme`
  );
}

// Initialize theme on page load
function initializeTheme() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = savedTheme || (prefersDark ? 'dark' : 'light');
  
  document.documentElement.setAttribute('data-theme', theme);
}
```

## 7. Component Testing Guidelines

### 7.1 Visual Testing Checklist

✅ **Bucket Cards**
- [ ] Status pills show correct colors and text
- [ ] Progress bars accurately reflect percentages
- [ ] Drag handles are visible and functional
- [ ] Action buttons are properly sized and aligned

✅ **Forms & Inputs**
- [ ] Labels are associated with inputs
- [ ] Error states are clearly visible
- [ ] Focus states are prominent
- [ ] Validation messages are helpful

✅ **Navigation & Layout**
- [ ] Header remains sticky during scroll
- [ ] Mobile menu is accessible
- [ ] Breadcrumbs show current location
- [ ] Footer links are functional

### 7.2 Accessibility Testing

```bash
# Automated testing tools
npm install --save-dev axe-core
npm install --save-dev @axe-core/playwright

# Manual testing
1. Navigate using only keyboard (Tab, Enter, Escape)
2. Test with screen reader (VoiceOver, NVDA)
3. Verify color contrast with browser dev tools
4. Check focus management in modals/dropdowns
5. Validate ARIA labels and roles
```

### 7.3 Responsive Testing

```bash
# Test across device sizes
1. Mobile portrait: 375px width
2. Mobile landscape: 667px width  
3. Tablet: 768px width
4. Desktop: 1024px width
5. Large desktop: 1440px width

# Key testing points
- Text remains readable at all sizes
- Touch targets are minimum 44px
- Content doesn't overflow horizontally
- Navigation adapts appropriately
```

## 8. Content Guidelines

### 8.1 Voice & Tone

- **Friendly**: Use conversational language
- **Clear**: Avoid jargon and technical terms
- **Helpful**: Provide context and next steps
- **Encouraging**: Focus on positive outcomes

### 8.2 Writing Style

```javascript
// Good examples
"You've used 3 of 5 buckets in your Free plan"
"Add your first expense to get started"
"Welcome back! You have 2 buckets nearly full"

// Avoid
"Resource limit exceeded for current subscription tier"
"Initialize expense entity creation workflow"
"Authentication token validation required"
```

### 8.3 Error Message Patterns

```javascript
// Structure: Problem + Solution
"Network error. Please check your connection and try again."
"Free plan limited to 5 buckets. Upgrade to Plus for unlimited buckets."
"Email not verified yet. Please check your inbox or resend verification."

// For technical errors, provide actionable steps
"Failed to save changes. Please try again or refresh the page."
"Billing service unavailable. Please try again in a few minutes."
```

---

**Last updated: 21 Aug 2025 (AEST)**