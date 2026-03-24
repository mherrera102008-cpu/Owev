import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

const FEATURES = [
  { symbol: '◆', title: 'Unlimited Invoices',  desc: 'Create and track as many invoices as you need, with no limits.' },
  { symbol: '$', title: 'Automated Reminders', desc: 'Scheduled emails go out automatically until you get paid.' },
  { symbol: '✓', title: 'Mark Paid Instantly', desc: 'One click to close an invoice and cancel all pending reminders.' },
];

export default async function RootPage() {
  const { userId } = await auth();
  if (userId) redirect('/dashboard');

  const sg = 'font-[family-name:var(--font-space-grotesk)]';

  return (
    <div className="bg-[var(--t-bg)] text-[var(--t-fg)] min-h-screen selection:bg-[var(--t-fg)] selection:text-[var(--t-bg)]">

      {/* Nav */}
      <nav className="border-b border-[var(--t-border)] h-14 flex items-stretch fixed top-0 left-0 right-0 bg-[var(--t-bg)] z-50">
        <Link href="/" className="flex items-center gap-2.5 px-5 border-r border-[var(--t-border)] hover:bg-[var(--t-surface)] transition-colors">
          <div className="w-7 h-7 relative shrink-0">
            <Image src="/owev-logo.png" alt="Owev" fill className="object-contain dark:invert" priority />
          </div>
          <span className={`${sg} font-bold text-sm tracking-widest small-caps text-[var(--t-fg)]`}>Owev</span>
        </Link>
        <div className="flex items-stretch ml-auto">
          <Link href="/sign-in" className={`flex items-center px-5 border-l border-[var(--t-border)] ${sg} small-caps font-bold text-xs tracking-wider text-[var(--t-fg)] hover:bg-[var(--t-surface)] transition-colors`}>
            Sign In
          </Link>
          <Link href="/sign-up" className={`flex items-center px-5 border-l border-[var(--t-border)] bg-[var(--t-fg)] text-[var(--t-bg)] ${sg} small-caps font-bold text-xs tracking-wider hover:opacity-80 transition-opacity`}>
            Get Started
          </Link>
        </div>
      </nav>

      <main className="pt-14">

        {/* Hero */}
        <div className="border-b border-[var(--t-border)] px-8 py-28 md:py-40">
          <div className="max-w-3xl mx-auto">
            <p className={`${sg} small-caps font-bold text-xs tracking-[0.3em] text-[var(--t-muted)] mb-10`}>
              ◆ Automated Invoice Tracking
            </p>
            <h1 className={`${sg} font-bold text-5xl md:text-7xl tracking-tighter uppercase leading-none mb-10 text-[var(--t-fg)]`}>
              Stop Chasing<br />Payments.
            </h1>
            <p className="text-base md:text-lg text-[var(--t-muted)] leading-relaxed max-w-xl mb-14">
              Create invoices, set your schedule, and Owev automatically sends professional reminders until you get paid.
            </p>
            <div className="flex items-stretch gap-0">
              <Link href="/sign-up" className={`bg-[var(--t-fg)] text-[var(--t-bg)] px-8 py-4 ${sg} small-caps font-bold text-xs tracking-wider hover:opacity-80 transition-opacity border border-[var(--t-border)]`}>
                Start for Free →
              </Link>
              <Link href="/sign-in" className={`px-8 py-4 ${sg} small-caps font-bold text-xs tracking-wider border border-[var(--t-border)] border-l-0 text-[var(--t-fg)] hover:bg-[var(--t-surface)] transition-colors`}>
                Sign In
              </Link>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 border-b border-[var(--t-border)]">
          {FEATURES.map(({ symbol, title, desc }, i) => (
            <div key={title} className={`px-10 py-14 flex flex-col gap-6 border-b md:border-b-0 ${i < FEATURES.length - 1 ? 'md:border-r border-[var(--t-border)]' : ''}`}>
              <span className={`${sg} font-bold text-2xl text-[var(--t-dim)]`}>{symbol}</span>
              <div>
                <p className={`${sg} font-bold text-base uppercase tracking-tight mb-3 text-[var(--t-fg)]`}>{title}</p>
                <p className="text-sm text-[var(--t-muted)] leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-8 py-20 text-center">
          <p className={`${sg} small-caps font-bold text-xs tracking-[0.3em] text-[var(--t-muted)] mb-6`}>Ready to get paid faster?</p>
          <Link href="/sign-up" className={`inline-block bg-[var(--t-fg)] text-[var(--t-bg)] px-12 py-4 ${sg} small-caps font-bold text-xs tracking-wider hover:opacity-80 transition-opacity border border-[var(--t-border)]`}>
            Create Your Account →
          </Link>
        </div>

      </main>
    </div>
  );
}
