// src/app/layout.tsx
import type { Metadata } from 'next';
import { DM_Sans, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Cheetah Receipts', template: '%s | Cheetah Receipts' },
  description: 'The marketplace for buying and selling cash receipts. Find verified receipts with barcodes, store locations, and return dates.',
  keywords: ['receipts', 'marketplace', 'returns', 'cash receipts', 'barcode'],
  openGraph: {
    title: 'Cheetah Receipts',
    description: 'Buy and sell cash receipts with verified barcodes and return dates.',
    type: 'website',
    url: 'https://cheetahreceipts.com',
  },
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${jetbrains.variable}`}>
      <body className="bg-surface-900 text-white antialiased">
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: '#0f172a',
              color: '#f1f5f9',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              fontFamily: 'var(--font-dm-sans)',
              fontWeight: 600,
            },
            success: { iconTheme: { primary: '#4ade80', secondary: '#0f172a' } },
            error:   { iconTheme: { primary: '#f87171', secondary: '#0f172a' } },
          }}
        />
      </body>
    </html>
  );
}
