'use client';
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import ThemeToggle from '@/components/ui/ThemeToggle';

const NAV = [
  { href: '/dashboard',     label: 'Dashboard', symbol: '◆' },
  { href: '/dashboard/new', label: 'New Invoice', symbol: '+' },
  { href: '/billing',       label: 'Billing',    symbol: '$' },
  { href: '/settings',      label: 'Settings',   symbol: '⚙' },
];

export default function TerminalShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const active = (href: string) =>
    href === '/dashboard' ? path === '/dashboard' : path.startsWith(href);

  return (
    <div className="bg-[var(--t-bg)] text-[var(--t-fg)] min-h-screen antialiased selection:bg-[var(--t-fg)] selection:text-[var(--t-bg)]">

      {/* ── Top Nav ─────────────────────────────────────────── */}
      <nav className="bg-[var(--t-bg)] flex justify-between items-stretch w-full h-14 fixed top-0 left-0 right-0 border-b border-[var(--t-border)] z-50">

        {/* Left: logo + nav tabs */}
        <div className="flex items-stretch">
          <Link href="/dashboard" className="flex items-center gap-2.5 px-5 border-r border-[var(--t-border)] shrink-0 hover:bg-[var(--t-surface)] transition-colors">
            <div className="w-7 h-7 relative shrink-0">
              <Image src="/owev-logo.png" alt="Owev" fill className="object-contain dark:invert" priority />
            </div>
            <span className="font-[family-name:var(--font-space-grotesk)] font-bold text-sm tracking-widest small-caps text-[var(--t-fg)] hidden sm:block">
              Owev
            </span>
          </Link>

          {/* Nav tabs — desktop only */}
          <div className="hidden md:flex items-stretch">
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`font-[family-name:var(--font-space-grotesk)] font-bold small-caps tracking-wider text-xs px-5 flex items-center border-r border-[var(--t-border)] transition-colors whitespace-nowrap ${
                  active(href)
                    ? 'bg-[var(--t-fg)] text-[var(--t-bg)]'
                    : 'text-[var(--t-fg)] hover:bg-[var(--t-surface)]'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right: theme toggle + user */}
        <div className="flex items-center gap-3 px-4">
          <ThemeToggle />
          <UserButton />
        </div>
      </nav>

      {/* ── Page content ────────────────────────────────────── */}
      <div className="mt-14 min-h-[calc(100vh-3.5rem)]">
        {children}
      </div>

      {/* ── Mobile bottom nav ───────────────────────────────── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--t-bg)] border-t border-[var(--t-border)] grid grid-cols-4 h-14 z-50">
        {NAV.map(({ href, label, symbol }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              active(href)
                ? 'bg-[var(--t-fg)] text-[var(--t-bg)]'
                : 'text-[var(--t-fg)] hover:bg-[var(--t-surface)]'
            }`}
          >
            <span className="text-xs leading-none">{symbol}</span>
            <span className="text-[11px] font-[family-name:var(--font-space-grotesk)] font-bold tracking-widest small-caps leading-none">
              {label.split(' ')[0]}
            </span>
          </Link>
        ))}
      </div>

    </div>
  );
}
