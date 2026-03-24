'use client';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-16 h-7" />;

  const isDark = theme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label="Toggle theme"
      className="border border-[var(--t-border)] px-3 py-1 font-[family-name:var(--font-space-grotesk)] small-caps font-bold text-[10px] tracking-widest text-[var(--t-fg)] hover:bg-[var(--t-fg)] hover:text-[var(--t-bg)] transition-colors"
    >
      {isDark ? 'Light' : 'Dark'}
    </button>
  );
}
