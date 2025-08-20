---
title: "Budget Buckets Documentation Index"
owner: "development-team"
status: "active"
last_review: "2025-08-20"
tags: ["index", "navigation"]
---

# Budget Buckets Documentation

Welcome to the Budget Buckets documentation hub. This index provides navigation to all project documentation organized by category.

## 📚 Documentation Categories

### 🏗️ Architecture
System design, data models, and technical decisions.

- **[System Overview](./architecture/system-overview.md)** *(active, 2025-08-20)* - C4 Context & Container diagrams, component overview
- **[Data Flow](./architecture/dataflow.md)** *(active, 2025-08-20)* - Authentication and feature request flows
- **[Data Model](./architecture/data-model.md)** *(active, 2025-08-20)* - Firestore collections and document schemas
- **[Project Structure](./architecture/project-structure.md)** *(active, 2025-08-11)* - System architecture and file organization

### 🎯 Decisions (ADRs)
Architecture Decision Records documenting key technical choices.

- **[ADR-20250820-stack-choice](./decisions/ADR-20250820-stack-choice.md)** *(accepted, 2025-08-20)* - Framework-free vanilla JS approach
- **[ADR-20250820-auth-approach](./decisions/ADR-20250820-auth-approach.md)** *(accepted, 2025-08-20)* - Firebase Authentication strategy
- **[ADR-20250820-frontend-framework](./decisions/ADR-20250820-frontend-framework.md)** *(accepted, 2025-08-20)* - No framework decision

### 📖 Guides
Step-by-step instructions and how-to documentation.

- **[Development Setup](./guides/setup-dev.md)** *(active, 2025-08-20)* - Clean machine to running app
- **[Deployment Guide](./guides/deploy.md)** *(active, 2025-08-20)* - Firebase App Hosting deployment
- **[Database Migrations](./guides/database-migrations.md)** *(active, 2025-08-20)* - Firestore schema changes
- **[Troubleshooting](./guides/troubleshooting.md)** *(active, 2025-08-20)* - Common issues and solutions
- **[Setup and Development Guide](./guides/setup-and-development.md)** *(active, 2025-08-13)* - Complete setup and development guide

### 🔧 Reference
API documentation, configuration, and technical specifications.

- **[HTTP API](./reference/http-api.md)** *(active, 2025-08-20)* - Express routes and endpoints
- **[Configuration](./reference/configuration.md)** *(active, 2025-08-20)* - Environment variables and settings

### 📋 Runbooks
Operational procedures and incident response.

- **[Restart Services](./runbooks/restart-services.md)** *(active, 2025-08-20)* - Service restart procedures
- **[Incident Playbook](./runbooks/incident-playbook.md)** *(active, 2025-08-20)* - Emergency response procedures
- **[Rotate Secrets](./runbooks/rotate-secrets.md)** *(active, 2025-08-20)* - Firebase API key rotation

### 🔒 Security & Compliance
Security measures, data protection, and compliance documentation.

- **[Security Notes](./security/security-notes.md)** *(active, 2025-08-20)* - Authentication, authorization, and data protection

### 🧪 Testing
Testing strategy, tools, and procedures.

- **[Testing Strategy](./testing/testing-strategy.md)** *(active, 2025-08-20)* - Test types, coverage, and execution

### 📋 Planning
Roadmaps, optimization plans, and future enhancements.

- **[Optimization Recommendations](./planning/optimization-recommendations.md)** *(active, 2025-08-11)* - Performance and feature planning document

### 🤝 Contributing
Development processes and contribution guidelines.

- **[Contributing Guide](./contributing.md)** *(active, 2025-08-20)* - Development workflow and standards

### 📝 Changelog
Release history and changes.

- **[Changelog](./changelog.md)** *(active, 2025-08-20)* - Version history and notable changes

### 🗃️ Templates
Document templates for creating new documentation.

- **[ADR Template](./_templates/adr-template.md)** - Template for Architecture Decision Records
- **[Runbook Template](./_templates/runbook-template.md)** - Template for operational runbooks

## 📊 Documentation Health

### Status Overview
- **Active**: 3 documents
- **Draft**: 0 documents  
- **Deprecated**: 0 documents
- **Archived**: 0 documents

### Recent Updates
- **2025-08-13**: Setup and Development Guide updated
- **2025-08-11**: Project Structure and Optimization docs updated
- **2025-08-20**: Documentation restructured and indexed

## 🚀 Quick Start

New to Budget Buckets? Start here:

1. **[Setup and Development Guide](./guides/setup-and-development.md)** - Get the project running locally
2. **[Project Structure](./architecture/project-structure.md)** - Understand the codebase organization  
3. **[Optimization Recommendations](./planning/optimization-recommendations.md)** - Learn about performance and future plans

## 📝 Contributing Documentation

### Creating New Documents

1. **Choose the right category** from the list above
2. **Use the appropriate template** from `_templates/`
3. **Add YAML front matter** with title, owner, status, tags
4. **Update this index** with your new document

### Document Lifecycle

- **Draft**: Work in progress, not ready for use
- **Active**: Current and maintained documentation
- **Deprecated**: No longer recommended but kept for reference
- **Archived**: Historical documentation moved to archive folder

### Documentation Standards

- Use descriptive titles and clear headings
- Include YAML front matter for metadata
- Update `last_review` date when making changes
- Add appropriate tags for discoverability
- Link to related documents when relevant

## 🔍 Finding Documentation

### By Category
Use the category folders to browse by topic area.

### By Tag
Common tags used across documentation:
- `guide` - Step-by-step instructions
- `architecture` - System design docs
- `planning` - Future roadmap items
- `performance` - Optimization related
- `setup` - Installation and configuration

### By Status
- Check document front matter for current status
- Active documents are regularly maintained
- Deprecated docs may have newer alternatives

---

**Last Updated**: 2025-08-20  
**Maintained By**: Development Team