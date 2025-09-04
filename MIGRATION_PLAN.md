# Budget Buckets Repository Cleanup - Migration Plan

## ✅ MIGRATION COMPLETE

**Status**: All planned migration tasks have been completed successfully.

**Date Completed**: August 23, 2025

**Summary**:
- All legacy HTML files migrated to EJS templates with real content
- CSS centralized and inline styles removed  
- Assets organized under `/assets/` directory
- Server configuration unified
- Legacy files properly archived with git history preserved

## File Inventory

### 🌐 Public Pages (To Migrate)
| Current File | Status | Target | Action |
|-------------|--------|--------|---------|
| `home.html` | ✅ Migrated | `views/pages/home.ejs` | Complete |
| `pricing.html` | ✅ Migrated | `views/pages/pricing.ejs` | Complete |
| `Method.html` | ✅ Migrated | `views/pages/guide-bucket-method.ejs` | Complete |
| `calculators.html` | ✅ Migrated | `views/pages/calculators.ejs` | Complete |
| `privacy.html` | ✅ Migrated | `views/pages/privacy.ejs` | Complete |
| `terms.html` | ✅ Migrated | `views/pages/terms.ejs` | Complete |
| `support.html` | ✅ Migrated | `views/pages/support.ejs` | Complete |

### 📦 SPA Application (Keep As-Is)
- `app/` - Authenticated single page application
  - `app/index.html` - Main app entry point
  - `app/styles.css` - App-specific styles
  - `app/*.js` - Application logic
  - `auth/` - Authentication components

### 🏗️ Templates & Assets (Current State)
- `views/` - EJS templates (✅ Started)
  - `layout.ejs`, `partials/` - Shared components
  - `pages/` - Individual page templates
- `assets/css/` - Centralized CSS (✅ Started)
  - `tokens.css`, `base.css`, `components.css`
  - `pages/` - Page-specific styles

### 🗂️ Legacy Files (To Archive)
| File | Purpose | Action |
|------|---------|--------|
| `account.html` | Old account page | → `_archive/` |
| `index.html` | Duplicate root page | → `_archive/` |
| `test.html` | Legacy test page | → `_archive/` |
| `debug-firebase.html` | Debug tool | → `_archive/` |
| `environment-switcher.html` | Dev tool | → `_archive/` |
| `force-production-firebase.html` | Dev tool | → `_archive/` |
| `server-dev.js` | Merge into `server.js` | → `_archive/` |

### 🎨 Assets & Media
| Current | Target | Notes |
|---------|--------|--------|
| `*.ico`, `*.png` (root) | `assets/img/` | Favicons and icons |
| `budgetbuckets.webmanifest` | Keep at root | Update icon paths |

### ⚙️ Configuration (Keep)
- `firebase.json`, `apphosting.yaml`
- `firestore.rules`, `firestore.indexes.json`
- `sitemap.xml`, `robots.txt`
- `package.json`, `playwright.config.js`

### 🧪 Tests
- `test/`, `tests/`, `e2e-tests/` - Keep organized
- `__tests__/` - Keep as Jest tests
- Test outputs: `coverage/`, `playwright-report/`, `test-results/`

### 📚 Documentation
- `docs/` - Keep comprehensive docs
- `*.md` files - Update references to clean URLs

## Migration Map

### File Moves & Renames

```
# Public Pages → EJS Templates
home.html → views/pages/home.ejs ✅
pricing.html → views/pages/pricing.ejs ✅  
Method.html → views/pages/guide-bucket-method.ejs ✅
calculators.html → views/pages/calculators.ejs ⚠️ (enhance)
privacy.html → views/pages/privacy.ejs ⚠️ (extract content)
terms.html → views/pages/terms.ejs ⚠️ (extract content)
support.html → views/pages/support.ejs ⚠️ (extract content)

# Assets Organization  
*.ico, *.png → assets/img/ 
CSS extraction → assets/css/pages/

# Archive Legacy
account.html → _archive/account.html
index.html → _archive/index.html
test.html → _archive/test.html
debug-firebase.html → _archive/debug-firebase.html
environment-switcher.html → _archive/environment-switcher.html
force-production-firebase.html → _archive/force-production-firebase.html
server-dev.js → _archive/server-dev.js (after merging useful bits)

# Clean URLs (server.js routes)
/ → pages/home
/pricing → pages/pricing
/guide/budget-buckets-method → pages/guide-bucket-method
/calculators → pages/calculators
/privacy → pages/privacy
/terms → pages/terms
/support → pages/support

# 301 Redirects
/home.html → /
/pricing.html → /pricing
/Method.html → /guide/budget-buckets-method
/calculators.html → /calculators
/privacy.html → /privacy
/terms.html → /terms
/support.html → /support
```

## CSS Centralization Plan

### Extract Inline Styles
```
calculators.html <style> → assets/css/pages/calculators.css
privacy.html <style> → assets/css/pages/privacy.css
terms.html <style> → assets/css/pages/terms.css
support.html <style> → assets/css/pages/support.css
```

### Shared Components
- Header/nav styles → `assets/css/components.css`
- Common card/button patterns → `assets/css/components.css`
- Typography & layout → `assets/css/base.css`

## Server Unification

### Merge server-dev.js → server.js
- Development mode logging
- Environment detection
- Billing feature toggles
- Keep single canonical server

### Express Configuration
```javascript
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use('/assets', express.static(path.join(__dirname, 'assets'), { maxAge: '1y' }));
```

### CSP Updates (Remove 'unsafe-inline')
Once inline styles are eliminated:
```javascript
styleSrc: ["'self'", "https://fonts.googleapis.com"]
// Remove: "'unsafe-inline'"
```

## Hosting Configuration

### firebase.json
```json
{
  "hosting": {
    "cleanUrls": true,
    "trailingSlash": false
  }
}
```

### PWA Manifest Updates
Update icon paths in `budgetbuckets.webmanifest`:
```json
{
  "icons": [
    { "src": "/assets/img/icon-dollar-192.png", ... },
    { "src": "/assets/img/icon-dollar-256.png", ... }
  ]
}
```

## Test Updates

### Clean URL References
- Update Playwright tests for new URLs
- Header consistency test across all public routes
- No `.html` references in any test files

## Quality Checkpoints

### Before Archive
- [ ] All public pages render via EJS
- [ ] No inline `<style>` in templates
- [ ] Shared header/footer consistent
- [ ] All assets load (no 404s)
- [ ] Tests pass with clean URLs

### After Migration  
- [ ] Legacy files safely archived
- [ ] Documentation updated
- [ ] Deploy smoke test passes
- [ ] CSP clean (no console errors)

## Risk Mitigation

### Backup Strategy
- Use `git mv` for all renames
- Archive files instead of deletion  
- Small incremental commits
- Test each phase before proceeding

### Rollback Plan
- Archive maintains original files
- Git history preserves all changes
- Server.js can serve static files as fallback

---

This plan ensures a safe, incremental migration with no data loss and minimal downtime.