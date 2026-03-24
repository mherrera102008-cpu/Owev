// @ts-nocheck
'use client';
import { useQuery, useMutation, useAction, useConvexAuth } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useState } from 'react';
import Link from 'next/link';

type StatusFilter = 'all' | 'upcoming' | 'due' | 'overdue' | 'paid';

/* Status badge text + colour — no opacity hacks */
const STATUS_LABEL: Record<string, string> = {
  upcoming: '[ Pending ]',
  due:      '[ Due Today ]',
  overdue:  '[ Late ]',
  paid:     '[ Paid ]',
};
const STATUS_COLOR: Record<string, string> = {
  upcoming: 'text-[var(--t-muted)]',
  due:      'text-[var(--t-fg)] font-black',
  overdue:  'text-[var(--t-fg)] font-black',
  paid:     'text-[var(--t-dim)]',
};

export default function DashboardContent() {
  const { isAuthenticated } = useConvexAuth();
  const [filter, setFilter] = useState<StatusFilter>('all');

  const summary      = useQuery(api.dashboard.summary, isAuthenticated ? {} : 'skip');
  const invoices     = useQuery(api.invoices.list, isAuthenticated ? (filter === 'all' ? {} : { status: filter }) : 'skip');
  const markPaid     = useMutation(api.invoices.markPaid);
  const remove       = useMutation(api.invoices.remove);
  const remindClient = useAction(api.reminders.sendManualReminder);
  const [reminding, setReminding] = useState<string | null>(null);

  const ZERO_DECIMAL = new Set(['JPY', 'KRW']);
  const fmtAmt = (c: number, currency?: string) => {
    const cur = currency ?? 'USD';
    const divisor = ZERO_DECIMAL.has(cur) ? 1 : 100;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(c / divisor);
  };
  const fmtDate = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();

  const sg = 'font-[family-name:var(--font-space-grotesk)]';
  const actionBtn = `${sg} small-caps font-bold text-xs underline underline-offset-4 px-2 py-1.5 transition-colors hover:bg-[var(--t-fg)] hover:text-[var(--t-bg)] text-[var(--t-fg)]`;

  return (
    <div className="px-5 md:px-10 py-10 max-w-6xl mx-auto pb-20 md:pb-14">

      {/* ── Stat bar ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 border border-[var(--t-border)] mb-14">

        <div className="p-8 md:p-10 border-b sm:border-b-0 sm:border-r border-[var(--t-border)] flex flex-col gap-4">
          <span className={`${sg} small-caps font-bold text-xs tracking-[0.2em] text-[var(--t-muted)]`}>
            Unpaid
          </span>
          <div className="flex items-end gap-2">
            <span className={`${sg} font-bold text-4xl md:text-5xl tracking-tighter leading-none text-[var(--t-fg)]`}>
              {summary ? (summary.overdue + summary.due + summary.upcoming) : '—'}
            </span>
            <span className={`${sg} small-caps font-bold text-xs text-[var(--t-dim)] mb-1.5`}>invoices</span>
          </div>
        </div>

        <div className="p-8 md:p-10 border-b sm:border-b-0 sm:border-r border-[var(--t-border)] flex flex-col gap-4 bg-[var(--t-surface)]">
          <span className={`${sg} small-caps font-bold text-xs tracking-[0.2em] text-[var(--t-muted)]`}>
            Overdue
          </span>
          <div className="flex items-end gap-2">
            <span className={`${sg} font-bold text-4xl md:text-5xl tracking-tighter leading-none text-[var(--t-fg)]`}>
              {summary?.overdue ?? '—'}
            </span>
            <span className={`${sg} small-caps font-bold text-xs text-[var(--t-dim)] mb-1.5`}>invoices</span>
          </div>
        </div>

        <div className="p-8 md:p-10 flex flex-col gap-4">
          <span className={`${sg} small-caps font-bold text-xs tracking-[0.2em] text-[var(--t-muted)]`}>
            Paid This Month
          </span>
          <div className="flex items-end gap-2">
            <span className={`${sg} font-bold text-4xl md:text-5xl tracking-tighter leading-none text-[var(--t-fg)]`}>
              {summary?.paidThisMonth ?? '—'}
            </span>
            <span className={`${sg} small-caps font-bold text-xs text-[var(--t-dim)] mb-1.5`}>invoices</span>
          </div>
        </div>

      </div>

      {/* ── Ledger header ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 mb-7">
        <div>
          <h1 className={`${sg} font-bold text-2xl md:text-3xl tracking-tight uppercase text-[var(--t-fg)]`}>
            Active Ledger
          </h1>
          <p className={`${sg} small-caps font-bold text-sm mt-1.5 text-[var(--t-muted)]`}>
            All your invoices in one place
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Filter strip */}
          <div className="flex items-stretch border border-[var(--t-border)]">
            {(['all', 'upcoming', 'due', 'overdue', 'paid'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 ${sg} small-caps font-bold text-xs tracking-wider border-r border-[var(--t-border)] last:border-r-0 transition-colors ${
                  filter === s
                    ? 'bg-[var(--t-fg)] text-[var(--t-bg)]'
                    : 'text-[var(--t-fg)] hover:bg-[var(--t-surface)]'
                }`}
              >
                {s === 'due' ? 'Due' : s}
              </button>
            ))}
          </div>
          <Link
            href="/dashboard/new"
            className={`bg-[var(--t-fg)] text-[var(--t-bg)] px-5 py-1.5 ${sg} small-caps font-bold text-xs tracking-wider hover:opacity-80 transition-opacity whitespace-nowrap border border-[var(--t-border)]`}
          >
            + New Invoice
          </Link>
        </div>
      </div>

      {/* ── Ledger table ────────────────────────────────────── */}
      <div className="border border-[var(--t-border)] overflow-hidden mb-14">

        {!invoices ? (
          <div className="flex items-center justify-center py-24">
            <p className={`${sg} small-caps font-bold text-xs tracking-widest text-[var(--t-muted)] animate-pulse`}>
              Loading...
            </p>
          </div>

        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <p className={`${sg} font-bold text-sm uppercase tracking-widest text-[var(--t-fg)]`}>
              No Invoices Found
            </p>
            <p className={`${sg} small-caps font-bold text-xs text-[var(--t-muted)]`}>
              {filter === 'all' ? 'Create your first invoice to begin' : `No ${filter === 'due' ? 'due today' : filter} invoices`}
            </p>
            {filter === 'all' && (
              <Link
                href="/dashboard/new"
                className={`mt-2 bg-[var(--t-fg)] text-[var(--t-bg)] px-6 py-2 ${sg} small-caps font-bold text-xs tracking-wider hover:opacity-80 transition-opacity border border-[var(--t-border)]`}
              >
                Create Invoice
              </Link>
            )}
          </div>

        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--t-fg)] text-[var(--t-bg)]">
                  {['#', 'Client', 'Amount', 'Due Date', 'Status', 'Action'].map((h, i) => (
                    <th
                      key={h}
                      className={`px-5 py-3.5 border-r border-[var(--t-bg)]/10 last:border-r-0 ${sg} small-caps font-bold text-xs tracking-wider ${i === 2 || i === 5 ? 'text-right' : ''}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, idx) => (
                  <tr
                    key={inv._id}
                    className={`border-b border-[var(--t-border)] last:border-b-0 transition-colors hover:bg-[var(--t-surface)] ${idx % 2 === 1 ? 'bg-[var(--t-surface)]' : 'bg-[var(--t-bg)]'}`}
                  >
                    {/* # */}
                    <td className="px-5 py-4 border-r border-[var(--t-border)] text-xs font-mono tabular-nums text-[var(--t-dim)] w-16">
                      {String(inv.invoiceNumber).padStart(3, '0')}
                    </td>
                    {/* Client */}
                    <td className="px-5 py-4 border-r border-[var(--t-border)] min-w-[160px]">
                      <p className="font-bold text-sm text-[var(--t-fg)] leading-snug">{inv.clientName}</p>
                      <p className="text-xs mt-0.5 text-[var(--t-dim)]">{inv.clientEmail}</p>
                    </td>
                    {/* Amount */}
                    <td className={`px-5 py-4 border-r border-[var(--t-border)] text-right ${sg} font-bold text-sm tabular-nums text-[var(--t-fg)] w-28`}>
                      {fmtAmt(inv.amount, inv.currency)}
                    </td>
                    {/* Due date */}
                    <td className="px-5 py-4 border-r border-[var(--t-border)] text-xs tabular-nums text-[var(--t-muted)] w-32">
                      {fmtDate(inv.dueDate)}
                    </td>
                    {/* Status */}
                    <td className="px-5 py-4 border-r border-[var(--t-border)] w-28">
                      <span className={`${sg} small-caps font-bold text-xs ${STATUS_COLOR[inv.status] ?? 'text-[var(--t-fg)]'}`}>
                        {STATUS_LABEL[inv.status] ?? `[ ${inv.status.toUpperCase()} ]`}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {inv.status !== 'paid' && (
                          <>
                            <button
                              onClick={async () => {
                                setReminding(inv._id);
                                try { await remindClient({ invoiceId: inv._id }); } catch {}
                                setReminding(null);
                              }}
                              disabled={reminding === inv._id}
                              className={`${actionBtn} disabled:text-[var(--t-dim)] disabled:no-underline`}
                            >
                              {reminding === inv._id ? 'Sending...' : 'Re-Send'}
                            </button>
                            <button onClick={() => markPaid({ id: inv._id })} className={actionBtn}>
                              Mark Paid
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => remove({ id: inv._id })}
                          className={`${sg} small-caps font-bold text-xs underline underline-offset-4 px-2 py-1.5 transition-colors text-[var(--t-dim)] hover:bg-[var(--t-fg)] hover:text-[var(--t-bg)]`}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Bottom grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Recent activity */}
        <div className="border border-[var(--t-border)]">
          <div className="px-6 py-4 border-b border-[var(--t-border)] bg-[var(--t-surface)]">
            <h3 className={`${sg} font-bold text-sm small-caps tracking-widest text-[var(--t-fg)]`}>Recent Activity</h3>
          </div>
          <div className="divide-y divide-[var(--t-border)]">
            {!invoices || invoices.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className={`${sg} small-caps font-bold text-xs text-[var(--t-muted)]`}>No recent activity</p>
              </div>
            ) : (
              invoices.slice(0, 6).map((inv) => (
                <div key={inv._id} className="flex justify-between items-center px-6 py-4 hover:bg-[var(--t-surface)] transition-colors gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-tight text-[var(--t-fg)] truncate">
                      #{String(inv.invoiceNumber).padStart(3, '0')} — {inv.clientName}
                    </p>
                    <p className="text-xs mt-0.5 text-[var(--t-dim)]">{fmtAmt(inv.amount, inv.currency)}</p>
                  </div>
                  <span className={`${sg} small-caps font-bold text-xs shrink-0 ${STATUS_COLOR[inv.status] ?? 'text-[var(--t-fg)]'}`}>
                    {STATUS_LABEL[inv.status] ?? `[ ${inv.status.toUpperCase()} ]`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* System alert */}
        <div className="border border-[var(--t-border)] flex flex-col">
          <div className="px-6 py-4 border-b border-[var(--t-border)] bg-[var(--t-surface)]">
            <h3 className={`${sg} font-bold text-sm small-caps tracking-widest text-[var(--t-fg)]`}>Status</h3>
          </div>
          <div className="px-6 py-8 flex-1 flex flex-col justify-between">
            <p className="text-sm leading-relaxed text-[var(--t-muted)]">
              {summary && summary.overdue > 0
                ? `${summary.overdue} overdue ${summary.overdue === 1 ? 'invoice' : 'invoices'}. Automated reminders are running — or send one manually from the list above.`
                : 'All invoices are up to date. Nothing needs your attention right now.'}
            </p>
            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setFilter('overdue')}
                className={`flex-1 border border-[var(--t-border)] py-2.5 ${sg} small-caps font-bold text-xs tracking-wider text-[var(--t-fg)] hover:bg-[var(--t-fg)] hover:text-[var(--t-bg)] transition-colors`}
              >
                View Overdue
              </button>
              <Link
                href="/dashboard/new"
                className={`flex-1 bg-[var(--t-fg)] text-[var(--t-bg)] py-2.5 ${sg} small-caps font-bold text-xs tracking-wider text-center hover:opacity-80 transition-opacity border border-[var(--t-border)]`}
              >
                New Invoice
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
