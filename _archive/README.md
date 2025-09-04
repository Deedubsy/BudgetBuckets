# Archive Directory

This directory contains legacy files that have been migrated to the new EJS template system or are no longer needed in the main codebase.

## Files Archived

### Legacy HTML Pages
These static HTML files have been converted to EJS templates in `/views/pages/`:
- `account.html` - Old account management page (functionality moved to SPA)
- `index.html` - Duplicate root page (consolidated into home.html → views/pages/home.ejs)

### Development & Debug Tools  
- `server-dev.js` - Development server (merged into main server.js)
- `test.html` - Legacy test page (replaced by comprehensive test suites)
- `debug-firebase.html` - Firebase debugging tool (replaced by proper development tools)
- `environment-switcher.html` - Environment switching utility (integrated into main app)
- `force-production-firebase.html` - Firebase production testing (replaced by proper CI/CD)

## Why Files Were Archived

1. **Consolidation**: Multiple similar files merged into single canonical versions
2. **Migration**: Static HTML converted to EJS template system for maintainability  
3. **Modernization**: Legacy tools replaced with proper development/testing infrastructure
4. **Organization**: Debug and development tools centralized in proper locations

## Restore Process

If any archived file needs to be restored:
1. Copy from `_archive/` back to root or appropriate location
2. Update any references in `server.js` routes
3. Ensure any dependencies (CSS, JS) are available
4. Test functionality before committing

## Migration Date

All files archived during the Budget Buckets repository cleanup on 2025-08-23.

## Related Documentation

- See `/MIGRATION_PLAN.md` for complete migration details
- See `/REFACTOR_MIGRATION_LOG.md` for technical changes made
- See `/docs/` for current system architecture and setup guides