---
title: "ADR: Frontend Framework Decision"
status: "accepted"
date: "2025-08-20"
owner: "engineering"
tags: ["adr", "frontend", "javascript"]
---

# ADR: Frontend Framework Decision

## Status
**Status:** accepted  
**Date:** 2025-08-20  
**Owner:** engineering

## Context

Budget Buckets needed a frontend approach for building the budgeting interface. Requirements:

**Performance:**
- Fast initial page load for financial data access
- Responsive interactions for budget calculations
- Minimal bundle size for mobile users

**Complexity:**
- Simple UI patterns (forms, lists, basic interactions)
- Limited state management needs (mostly CRUD operations)
- Straightforward data flow from Firestore to UI

**Development:**
- Quick iteration and deployment
- Minimal build toolchain complexity
- Easy debugging and maintenance

**User Base:**
- Personal finance users on various devices
- No complex collaboration features
- Standard web browser capabilities

## Decision

We chose **Vanilla JavaScript** with ES6 modules instead of a modern framework:

**Approach:**
- Pure HTML/CSS/JavaScript with no framework
- ES6 modules for code organization
- Direct DOM manipulation for UI updates
- Firebase SDK for data binding and real-time updates

**Architecture:**
- Modular JavaScript files by feature area
- Event-driven UI updates
- Simple state management through Firebase real-time listeners

## Consequences

### Positive
- **Performance**: No framework overhead, faster initial load
- **Simplicity**: No build step, direct browser execution
- **Bundle Size**: Minimal JavaScript payload
- **Debugging**: Direct browser DevTools debugging, no source maps needed
- **Learning Curve**: Standard web APIs, no framework-specific concepts
- **Flexibility**: Full control over DOM manipulation and performance optimization
- **Maintenance**: No framework version upgrades or breaking changes

### Negative
- **Development Velocity**: More verbose code for UI updates
- **Code Organization**: Requires discipline to maintain clean architecture
- **Reactivity**: Manual DOM updates instead of automatic reactive binding
- **Component Reuse**: No built-in component system
- **State Management**: Manual synchronization between data and UI
- **Modern Patterns**: Missing modern development conveniences (JSX, computed properties, etc.)

### Neutral
- **Team Expertise**: Requires solid vanilla JavaScript skills
- **Third-party Integration**: Fewer libraries designed for vanilla JS
- **Testing**: Requires different testing approaches than framework-based apps

## Alternatives Considered

### React
- **Pros**: Mature ecosystem, excellent developer tools, component reusability
- **Cons**: Build complexity, larger bundle, overkill for simple CRUD interface
- **Decision**: Rejected - too heavy for Budget Buckets' simple UI needs

### Vue.js
- **Pros**: Gentler learning curve than React, good documentation, smaller than React
- **Cons**: Still requires build tooling, unnecessary for straightforward forms/lists
- **Decision**: Rejected - adds complexity without sufficient benefit

### Svelte
- **Pros**: Compiles to vanilla JS, excellent performance, modern syntax
- **Cons**: Build step required, smaller ecosystem, compile-time complexity
- **Decision**: Rejected - build step conflicts with simplicity goal

### Alpine.js
- **Pros**: Lightweight, no build step, progressive enhancement
- **Cons**: Limited for complex interactions, still an additional dependency
- **Decision**: Considered but rejected - vanilla JS is simpler for this use case

### Lit (Web Components)
- **Pros**: Standards-based, good encapsulation, no framework lock-in
- **Cons**: Web Components complexity, browser support considerations
- **Decision**: Rejected - more complex than needed for Budget Buckets UI

## Implementation Evidence

The vanilla JavaScript approach is evident throughout the codebase:

```javascript
// Direct DOM manipulation (app/app.js)
function updateBucketDisplay(bucket) {
  const bucketElement = document.getElementById(`bucket-${bucket.id}`);
  const amountElement = bucketElement.querySelector('.bucket-amount');
  amountElement.textContent = formatCurrency(bucket.totalAmount);
  
  // Update progress bar
  const progressBar = bucketElement.querySelector('.progress-bar');
  const percentage = (bucket.currentAmount / bucket.goalAmount) * 100;
  progressBar.style.width = `${Math.min(percentage, 100)}%`;
}
```

```javascript
// ES6 module organization (auth/firebase.js)
export const authHelpers = {
  async waitForAuth() { /* ... */ },
  async signInWithGoogle() { /* ... */ },
  async signOut() { /* ... */ }
};

export const firestoreHelpers = {
  async saveDocument() { /* ... */ },
  async loadDocument() { /* ... */ }
};
```

```javascript
// Event-driven updates (app/app.js)
// Firebase real-time listener triggers UI updates
const unsubscribe = onSnapshot(doc(db, `users/${uid}/budgets/${budgetId}`), (doc) => {
  if (doc.exists()) {
    const budgetData = doc.data();
    updateBudgetUI(budgetData);
    recalculateTotals();
  }
});
```

## Performance Validation

Vanilla JavaScript delivers measurable benefits:
- **Bundle Size**: ~50KB total JavaScript vs ~200KB+ for typical React apps
- **Load Time**: <1s first contentful paint on 3G networks
- **Runtime Performance**: No virtual DOM overhead, direct DOM updates
- **Memory Usage**: Lower baseline memory consumption

## Maintenance Considerations

Code organization strategies without framework:
- **Module Separation**: Clear separation of concerns (`auth/`, `app/`, `migrations/`)
- **Event Patterns**: Consistent event handling patterns across components
- **Error Boundaries**: Centralized error handling without framework try/catch boundaries
- **Testing Strategy**: Focus on integration tests over unit tests

## Future Considerations

Framework adoption criteria for potential future migration:
- UI complexity increases significantly (collaborative features, complex visualizations)
- Team growth requires more structured development patterns
- Performance requirements change (complex state management, heavy real-time updates)
- User base grows requiring more sophisticated UX patterns

## References

- [System Overview](../architecture/system-overview.md)
- [Performance Benchmarks](../planning/optimization-recommendations.md)
- [Browser Support Requirements](../../README.md#browser-support)