# Track Specification: Production Readiness (Refactor/Chore)

## Overview
This track aims to finalize the Cheetah codebase for a production-ready state, as outlined in Goal #1 of the product definition. This involves sanitizing existing debug logs, removing dead code, implementing a robust structured logging system with **Pino**, and establishing comprehensive error boundaries across both the Next.js web application and the React Native mobile app.

## Functional Requirements
1. **Structured Logging (Pino)**
   - Integrate `pino` into the Next.js backend and frontend.
   - Implement a compatible structured logging utility for React Native.
   - Configure logs for "External-Ready" structure (JSON) to facilitate future integration with services like Sentry or Datadog.
   - Ensure logs are filtered by environment (e.g., debug logs disabled in production).

2. **Log Sanitization**
   - Identify and replace all 20+ instances of `console.log`, `console.warn`, and `console.error` with the new Pino-based logger.
   - Ensure sensitive information (PII, API keys) is never logged.

3. **Dead Code & Comment Cleanup**
   - Remove all commented-out code blocks across the `src/` and `mobile/` directories.
   - Delete any "TODO" or "FIXME" markers that have been addressed.

4. **Comprehensive Error Handling**
   - Implement/Refine global React Error Boundaries in the Next.js App Router (`error.tsx`).
   - Implement global Error Boundaries in the React Native mobile app to prevent silent crashes and provide user-friendly feedback.
   - Standardize API error responses across all Next.js routes.

## Non-Functional Requirements
- **Performance:** Logging should have minimal impact on application performance (Pino is selected for this reason).
- **Maintainability:** Standardized logging and error handling should make debugging in production easier.
- **Security:** Strict avoidance of logging sensitive credentials or user data.

## Acceptance Criteria
- [ ] Zero `console.log` or `console.error` calls remaining in the codebase (verified via grep).
- [ ] A unified `Logger` utility is used for all application logging.
- [ ] Error boundaries are active and provide a fallback UI on both Web and Mobile.
- [ ] All commented-out code blocks are removed.
- [ ] Production logs are structured as JSON and ready for external ingestion.

## Out of Scope
- Full integration with external monitoring services (e.g., Sentry, LogRocket) — the system will only be *prepared* for these.
- Performance profiling or optimization beyond logging overhead.
- Refactoring core business logic (e.g., fraud scoring, payment processing).
