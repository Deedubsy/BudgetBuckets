---
title: "Budget Buckets - Changelog"
owner: "engineering"
status: "active"
last_review: "2025-08-23"
tags: ["changelog", "releases", "history"]
---

# Changelog

All notable changes to Budget Buckets are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Complete end-to-end account creation flow** with email verification
- New authentication pages: `/auth/verify.html`, `/auth/choose-plan.html`
- Enhanced authentication logic preventing auto-account creation on sign-in failures
- Plan selection interface with Free and Plus plan options
- Comprehensive E2E test suite for authentication flows (`tests/e2e/auth-creation.spec.ts`)
- SessionStorage-based race condition protection for plan selections
- Debug logging for authentication flow troubleshooting
- Modern **Stripe.js client-side integration** replacing server-side redirects
- Embedded Payment Element with dark theme matching app design
- Dynamic payment modal for in-app subscription upgrades
- New API endpoints: `/api/billing/stripe-key`, `/api/billing/setup-intent`, `/api/billing/create-subscription`
- Setup Intent pattern for secure payment method collection
- Enhanced Content Security Policy with Stripe domains
- Comprehensive error handling for billing operations

### Changed
- **BREAKING**: Account creation now requires explicit user action - no auto-creation on sign-in failures
- **BREAKING**: Email verification now mandatory for password-based accounts
- Authentication flow now enforces complete user journey: sign-up → verification → plan selection → app access
- Improved form validation with disabled HTML5 validation for better error handling
- **BREAKING**: Migrated from Stripe Checkout sessions to modern Payment Elements
- Upgrade flow now uses embedded payment form instead of redirects
- Improved user experience with in-app payment processing
- Enhanced billing error messages for better user guidance
- Removed duplicate manage billing button from account header
- Updated documentation with modern Stripe.js implementation details

### Fixed
- **Authentication redirect loops** between plan selection and login pages
- **Email verification page flash redirect** issue after account creation
- **Plan selection page layout** being constrained by auth-container max-width
- **Auto-account creation** on sign-in with non-existing emails
- **Email verification error message** - now redirects to login with email context instead of showing error
- **Auth page styling inconsistencies** - removed conflicting base.css from verify and choose-plan pages
- **Plan selection redirect loops** - improved logic to only redirect when user has complete plan (free/plus), not free_pending
- Form validation error handling for client-side vs Firebase errors
- Firestore race conditions during plan selection causing redirect loops
- Content Security Policy violations preventing Stripe.js loading
- Billing portal access errors for users without Stripe customers
- Calculator input visibility and tab switching functionality
- Stripe initialization and payment element creation error handling

### Technical Improvements
- Added `stripe-publish-key` environment variable support
- Enhanced logging and debugging for payment flows
- Improved client-side Stripe integration with comprehensive error handling
- Updated server-side billing endpoints for modern Stripe patterns

## [2.1.0] - 2025-08-20

### Added
- Anti-phishing security measures to login page
- Sample data generation button for screenshot creation
- Comprehensive SEO optimizations and favicon assets

### Fixed  
- Bank badge text contrast on colored bucket backgrounds
- Text contrast issues in bank account input section

### Changed
- Moved bank account input from header to bucket content area
- Improved accessibility with better color contrast ratios

## [2.0.0] - 2025-01-15

### Added
- **Pricing page** with AUD pricing and monthly/yearly billing toggle
- 14-day trial badge and comprehensive feature comparison
- Navigation integration across all pages
- OAuth popup/redirect fallback system for improved authentication reliability

### Fixed
- **Critical**: Google OAuth popup blocked by Content Security Policy
- Authentication redirect loops on custom domain
- Firebase initialization errors with module imports

### Changed
- **Breaking**: Updated authentication flow to use custom domain (budgetbucket.app)
- Improved Content Security Policy to allow necessary Firebase domains
- Enhanced error handling for authentication failures

### Security
- Added comprehensive security headers (CSP, HSTS, X-Frame-Options)
- Implemented domain restrictions for OAuth providers
- Enhanced client-side security measures

## [1.2.1] - 2024-12-03

### Fixed
- Budget calculations not updating in real-time
- Expense item deletion not saving properly
- Mobile responsiveness issues on budget creation form

### Security
- Updated Firebase SDK to latest version (10.7.1)
- Improved Firestore security rules validation

## [1.2.0] - 2024-11-20

### Added
- **Savings goals tracking** with progress visualization
- Bank account assignment for expenses and savings
- Color-coded budget categories
- Export budget data as JSON
- Keyboard shortcuts for common actions

### Changed
- Improved budget overview layout with better visual hierarchy
- Enhanced mobile experience with responsive design improvements
- Optimized Firestore queries for better performance

### Fixed
- Currency formatting inconsistencies
- Budget total calculations with mixed frequencies
- Data persistence issues on slow connections

## [1.1.2] - 2024-10-15

### Fixed
- Critical authentication bug causing infinite redirect loops
- Budget data not loading for users with special characters in email
- Memory leak in real-time database listeners

### Security
- Patched XSS vulnerability in budget name display
- Updated authentication token validation

## [1.1.1] - 2024-09-28

### Fixed
- Income frequency calculations for weekly/fortnightly periods
- Budget validation allowing negative amounts
- UI responsiveness issues on tablet devices

### Performance
- Reduced initial page load time by 40%
- Optimized Firebase bundle size
- Improved client-side caching

## [1.1.0] - 2024-09-10

### Added
- **Multi-budget support** - users can create and manage multiple budgets
- Budget templates for common scenarios (Student, Family, Retiree)
- Income frequency options (Weekly, Fortnightly, Monthly, Yearly)
- Data validation with user-friendly error messages
- Offline support with data synchronization

### Changed
- Redesigned budget creation flow with step-by-step wizard
- Improved navigation between budgets
- Enhanced accessibility with proper ARIA labels and keyboard navigation

### Fixed
- Budget calculations not accounting for excluded items
- Date formatting issues in different locales
- Mobile keyboard covering input fields

## [1.0.2] - 2024-08-20

### Fixed
- Critical data loss bug when editing expense categories
- Firebase authentication state persistence issues
- Budget totals not updating after item deletion

### Security
- Implemented proper user data isolation in Firestore rules
- Added rate limiting for database operations
- Enhanced input sanitization

## [1.0.1] - 2024-08-05

### Fixed
- Initial budget creation not saving properly
- Google sign-in button not responding on mobile devices
- Calculation errors with floating-point numbers

### Performance
- Reduced database read operations by 60%
- Implemented client-side caching for user preferences
- Optimized real-time listeners

## [1.0.0] - 2024-07-15

### Added
- **Initial release** of Budget Buckets
- Core budgeting functionality with expenses and savings tracking
- Google OAuth and email/password authentication
- Real-time data synchronization with Firebase
- Responsive web design for mobile and desktop
- Basic budget calculations and surplus/deficit tracking

### Features
- **Budget Management**:
  - Create and edit personal budgets
  - Add expense categories with individual line items
  - Track savings goals and contributions
  - Real-time calculation of budget balance

- **User Experience**:
  - Clean, intuitive interface
  - Mobile-responsive design
  - Real-time updates across browser tabs
  - Persistent authentication state

- **Technical Foundation**:
  - Vanilla JavaScript with ES6 modules
  - Firebase Authentication and Firestore
  - Progressive Web App capabilities
  - Client-side validation and error handling

## Development Milestones

### Pre-1.0 Development (2024-01-01 to 2024-07-14)

**Phase 1 - Foundation (January - March 2024)**
- Project setup and architecture decisions
- Firebase integration and authentication
- Basic UI framework and responsive design
- Initial database schema design

**Phase 2 - Core Features (April - May 2024)**
- Budget creation and management
- Expense and savings tracking
- Real-time calculations and updates
- Data validation and error handling

**Phase 3 - Polish (June - July 2024)**
- UI/UX improvements and accessibility
- Performance optimizations
- Testing and bug fixes
- Documentation and deployment preparation

## Migration Notes

### 2.0.0 Migration
- **Authentication**: Users may need to sign in again due to domain changes
- **Data**: All existing budget data preserved and migrated automatically
- **Breaking Changes**: Custom domain requires updating bookmarks to budgetbucket.app

### 1.1.0 Migration  
- **Data Schema**: Automatic migration to support multiple budgets
- **User Impact**: Existing single budget becomes "My Budget" in new multi-budget interface
- **Breaking Changes**: URL structure changed to include budget ID

## Security Updates

### 2025-08-20
- Implemented comprehensive Content Security Policy
- Added security headers for XSS and clickjacking protection
- Enhanced authentication flow security

### 2024-12-03
- Updated Firebase SDK to address security vulnerabilities
- Improved Firestore security rules validation
- Enhanced client-side input sanitization

### 2024-10-15
- Fixed XSS vulnerability in budget name display
- Updated authentication token validation
- Added rate limiting for sensitive operations

## Performance Improvements

### 2.0.0
- Reduced JavaScript bundle size by 25%
- Implemented client-side caching for static assets
- Optimized Firebase Hosting configuration

### 1.1.0  
- 40% reduction in initial page load time
- Optimized Firestore queries and indexes
- Implemented connection pooling for Firebase operations

### 1.0.2
- 60% reduction in database read operations
- Added client-side data caching
- Optimized real-time listener management

## Browser Compatibility

### Current Support (2.0.0+)
- **Chrome**: 88+ (full support)
- **Firefox**: 85+ (full support) 
- **Safari**: 14+ (full support)
- **Edge**: 88+ (full support)
- **Mobile Safari**: 14+ (full support)
- **Chrome Mobile**: 88+ (full support)

### Legacy Support
- **Internet Explorer**: Not supported (never supported)
- **Older browsers**: Graceful degradation with core functionality

## Known Issues

### Current (2.1.0)
- OAuth popup may be blocked by aggressive popup blockers (workaround: redirect fallback implemented)
- Large budgets (100+ categories) may experience slight performance degradation
- Some screen readers may have difficulty with dynamic calculation updates

### Resolved
- ~~Authentication redirect loops (fixed in 2.0.0)~~
- ~~Data loss during category editing (fixed in 1.0.2)~~  
- ~~Mobile keyboard covering inputs (fixed in 1.1.0)~~

## Planned Features

### Next Release (2.2.0)
- [ ] Budget sharing between users
- [ ] Advanced reporting and analytics
- [ ] CSV import/export functionality
- [ ] Dark mode theme
- [ ] Progressive Web App offline capabilities

### Future Releases
- [ ] Mobile native app (React Native)
- [ ] Integration with banking APIs
- [ ] AI-powered spending insights
- [ ] Multi-currency support
- [ ] Automated bill tracking

## Contributing

Changes to Budget Buckets are tracked in this changelog. All significant changes should be documented here according to the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.

### Changelog Guidelines
- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** for vulnerability fixes

For contribution guidelines, see [CONTRIBUTING.md](./contributing.md).

## References

- [System Architecture](./architecture/system-overview.md)
- [Development Setup](./guides/setup-dev.md)
- [Deployment Guide](./guides/deploy.md)
- [Security Notes](./security/security-notes.md)

---

**Note**: This changelog is automatically updated with each release. For the most current development status, check the [project repository](https://github.com/Deedubsy/BudgetBuckets).