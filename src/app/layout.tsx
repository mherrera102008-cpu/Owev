import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import ConvexClientProvider from '@/components/providers/ConvexClientProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'InvoiceTracker',
  description: 'Automated invoice tracking and payment reminders',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <ConvexClientProvider>
            {children}
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
