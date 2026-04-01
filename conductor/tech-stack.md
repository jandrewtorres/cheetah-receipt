# Tech Stack

## Frontend (Web)
- **Framework**: [Next.js 14](https://nextjs.org/) (App Router) — Providing SSR, ISR, and optimized client-side routing.
- **Styling**: [TailwindCSS](https://tailwindcss.com/) — Utility-first CSS for rapid, consistent UI development.
- **Icons**: [Lucide-React](https://lucide.dev/) — Lightweight and flexible icon set.
- **Validation**: [Zod](https://zod.dev/) & [React Hook Form](https://react-hook-form.com/) — Robust form management and schema-based validation.

## Frontend (Mobile)
- **Framework**: [React Native](https://reactnative.dev/) with [Expo](https://expo.dev/) — Accelerated mobile development with cross-platform support.
- **Push Notifications**: Expo Push Notifications integrated with Supabase Realtime for instant updates.

## Backend & Infrastructure
- **API Runtime**: Next.js API Routes (Node.js).
- **Backend-as-a-Service**: [Supabase](https://supabase.com/) — Providing PostgreSQL database, user authentication (Supabase Auth), and asset storage (Supabase Storage).
- **Payments**: [Stripe Connect](https://stripe.com/connect) — Managing marketplace payouts and 90/10 commission splits.
- **OCR Engine**: [OpenAI GPT-4o Vision](https://openai.com/) — Sophisticated image-to-data extraction for receipt analysis.
- **Email**: [Resend](https://resend.com/) — Fast and reliable transactional email delivery.

## Security & Reliability
- **Unit Testing**: [Vitest](https://vitest.dev/) — Fast and modern test runner for TypeScript and React.
- **Fraud Detection**: Custom scoring engine implemented in TypeScript for behavior-based risk assessment.
- **Environment Management**: Strict environment variable configuration for secure API key handling.

## Deployment
- **Web**: AWS Amplify — Continuous deployment for Next.js applications.
- **Mobile**: EAS Build — Automated cloud builds for Expo applications.
