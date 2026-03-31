# Implementation Plan: Production Readiness (Refactor/Chore)

## Phase 1: Foundation (Structured Logging Integration)
This phase focuses on integrating **Pino** into both the Next.js and React Native environments and creating a unified logging utility.

- [ ] **Task: Setup Pino in Next.js (Web & API)**
    - [ ] Create unit tests for a new `Logger` utility in `src/lib/logger.ts` (Red Phase).
    - [ ] Install `pino` and `pino-pretty` (for development).
    - [ ] Implement `src/lib/logger.ts` to export a Pino instance configured for JSON output in production and pretty-printing in development (Green Phase).
    - [ ] Ensure sensitive fields (e.g., "password", "token") are redacted via Pino's built-in redaction (Refactor Phase).
- [ ] **Task: Setup Structured Logging in React Native**
    - [ ] Create unit tests for the mobile logger in `mobile/src/services/logger.ts` (Red Phase).
    - [ ] Install `pino` and necessary polyfills (e.g., `fast-redaction`) in the `mobile/` directory.
    - [ ] Implement `mobile/src/services/logger.ts` with a React Native-compatible Pino configuration (Green Phase).
- [ ] **Task: Standardize Logging Interface**
    - [ ] Create a unified interface or wrapper if needed to ensure Web/Mobile loggers have identical APIs (e.g., `.info()`, `.error()`, `.warn()`).
- [ ] **Task: Conductor - User Manual Verification 'Phase 1: Foundation' (Protocol in workflow.md)**

## Phase 2: Log Sanitization & Code Cleanup
Replacing legacy console calls and removing dead code.

- [ ] **Task: Sanitize Next.js Codebase**
    - [ ] Run `grep -r "console\." src/` to identify all occurrences.
    - [ ] Systematically replace each `console.log/error/warn` with `Logger.info/error/warn`.
    - [ ] Verify that no logs leak sensitive data.
- [ ] **Task: Sanitize React Native Codebase**
    - [ ] Run `grep -r "console\." mobile/src/` to identify all occurrences.
    - [ ] Replace occurrences with the mobile `Logger`.
- [ ] **Task: Dead Code & Comment Removal**
    - [ ] Search for and remove large blocks of commented-out code in `src/` and `mobile/src/`.
    - [ ] Remove completed "TODO" or "FIXME" markers.
- [ ] **Task: Automated Verification**
    - [ ] Implement a pre-commit or CI check (e.g., a simple shell script or lint rule) to prevent future `console.log` additions.
- [ ] **Task: Conductor - User Manual Verification 'Phase 2: Log Sanitization & Code Cleanup' (Protocol in workflow.md)**

## Phase 3: Robust Error Handling (Full Stack)
Implementing global error boundaries and standardized API error responses.

- [ ] **Task: Web Global Error Boundaries**
    - [ ] Write tests for the Next.js `error.tsx` component to ensure it logs errors to Pino and displays a user-friendly fallback (Red Phase).
    - [ ] Refine `src/app/error.tsx` and `src/app/not-found.tsx` to use the new `Logger` (Green Phase).
- [ ] **Task: Mobile Global Error Boundaries**
    - [ ] Implement a top-level Error Boundary component in `mobile/src/App.tsx` or as a wrapper for the root navigator.
    - [ ] Ensure uncaught mobile exceptions are logged via the mobile `Logger` before the app crashes or shows the fallback UI.
- [ ] **Task: Standardize API Error Responses**
    - [ ] Create a utility for standardized API error responses (e.g., `{ error: { message: string, code: string } }`) in `src/lib/api-error.ts`.
    - [ ] Update key API routes (e.g., Stripe webhooks, OCR scan) to use this utility and log failures consistently.
- [ ] **Task: Conductor - User Manual Verification 'Phase 3: Robust Error Handling' (Protocol in workflow.md)**

## Phase 4: Final Verification & Polish
- [ ] **Task: Full Application Regression Test**
    - [ ] Run all existing tests (`npm test` in root and mobile) to ensure no regressions were introduced during cleanup.
- [ ] **Task: Production Build Verification**
    - [ ] Run `npm run build` to ensure the production build succeeds with the new logging and error handling.
- [ ] **Task: Conductor - User Manual Verification 'Phase 4: Final Verification & Polish' (Protocol in workflow.md)**
