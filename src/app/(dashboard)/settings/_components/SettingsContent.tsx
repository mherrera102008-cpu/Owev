'use client';
import { useQuery, useMutation, useConvexAuth } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SettingsContent() {
  const { isAuthenticated } = useConvexAuth();
  const tenant = useQuery(api.tenants.get, isAuthenticated ? {} : 'skip');
  const updateConfig = useMutation(api.tenants.updateReminderConfig);

  const [daysBefore, setDaysBefore] = useState<number[]>([7, 3, 1]);
  const [daysAfter,  setDaysAfter]  = useState<number[]>([1, 3, 7]);
  const [newBefore,  setNewBefore]  = useState('');
  const [newAfter,   setNewAfter]   = useState('');
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  useEffect(() => {
    if (tenant?.reminderConfig) {
      setDaysBefore(tenant.reminderConfig.daysBefore);
      setDaysAfter(tenant.reminderConfig.daysAfter);
    }
  }, [tenant]);

  const addDay = (list: number[], setList: (v: number[]) => void, val: string) => {
    const n = parseInt(val);
    if (!isNaN(n) && n > 0 && !list.includes(n)) setList([...list, n].sort((a, b) => b - a));
  };
  const removeDay = (list: number[], setList: (v: number[]) => void, n: number) =>
    setList(list.filter((d) => d !== n));

  const handleSave = async () => {
    setSaving(true);
    await updateConfig({ daysBefore, daysAfter });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const sg = 'font-[family-name:var(--font-space-grotesk)]';
  const inputCls = `w-24 px-0 py-2.5 bg-transparent border-b-2 border-[var(--t-border)] text-sm text-[var(--t-fg)] placeholder:text-[var(--t-dim)] focus:outline-none ${sg}`;

  const DaySection = ({
    title, list, setList, newVal, setNew,
  }: {
    title: string; list: number[]; setList: (v: number[]) => void; newVal: string; setNew: (v: string) => void;
  }) => (
    <div className="px-7 py-7 border-b border-[var(--t-border)]">
      <p className={`${sg} small-caps font-bold text-xs tracking-wider text-[var(--t-fg)] mb-5`}>{title}</p>

      {/* Tag row */}
      <div className="flex flex-wrap gap-0 mb-5">
        {list.length === 0 ? (
          <span className={`border border-[var(--t-border)] px-4 py-2 text-xs ${sg} small-caps font-bold text-[var(--t-dim)]`}>
            None configured
          </span>
        ) : (
          <div className="flex flex-wrap gap-0 border border-[var(--t-border)] w-fit">
            {list.map((d) => (
              <div key={d} className="flex items-center gap-3 px-4 py-2 border-r border-[var(--t-border)] last:border-r-0 hover:bg-[var(--t-surface)] transition-colors">
                <span className={`${sg} font-bold text-xs small-caps text-[var(--t-fg)]`}>{d}D</span>
                <button
                  onClick={() => removeDay(list, setList, d)}
                  className="text-[var(--t-dim)] hover:text-[var(--t-fg)] font-bold text-base leading-none transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add row */}
      <div className="flex items-end gap-4">
        <div>
          <label className={`block ${sg} small-caps font-bold text-xs text-[var(--t-muted)] tracking-wider mb-2`}>Days</label>
          <input
            type="number" min="1" placeholder="e.g. 5"
            value={newVal}
            onChange={(e) => setNew(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { addDay(list, setList, newVal); setNew(''); } }}
            className={inputCls}
          />
        </div>
        <button
          onClick={() => { addDay(list, setList, newVal); setNew(''); }}
          className={`border border-[var(--t-border)] px-5 py-2.5 ${sg} small-caps font-bold text-xs tracking-wider text-[var(--t-fg)] hover:bg-[var(--t-fg)] hover:text-[var(--t-bg)] transition-colors`}
        >
          + Add
        </button>
      </div>
    </div>
  );

  return (
    <div className="px-5 md:px-10 py-10 max-w-2xl mx-auto pb-20 md:pb-14">

      {/* Page header */}
      <div className="mb-10">
        <Link href="/dashboard" className={`${sg} small-caps font-bold text-xs tracking-wider text-[var(--t-muted)] hover:text-[var(--t-fg)] transition-colors underline underline-offset-4`}>
          ← Dashboard
        </Link>
        <h1 className={`${sg} font-bold text-2xl md:text-3xl tracking-tight uppercase mt-4 text-[var(--t-fg)]`}>Settings</h1>
        <p className={`${sg} small-caps font-bold text-sm mt-1.5 text-[var(--t-muted)]`}>
          Configure your reminder schedule
        </p>
      </div>

      {/* Reminder config */}
      <div className="border border-[var(--t-border)] mb-6">

        <div className="px-7 py-5 border-b border-[var(--t-border)] bg-[var(--t-surface)]">
          <h2 className={`${sg} font-bold text-sm small-caps tracking-widest text-[var(--t-fg)]`}>Reminder Schedule</h2>
          <p className={`${sg} small-caps font-bold text-xs text-[var(--t-muted)] mt-1.5 tracking-wider`}>
            Automatic reminders sent relative to due date
          </p>
        </div>

        <DaySection title="Before Due Date"         list={daysBefore} setList={setDaysBefore} newVal={newBefore} setNew={setNewBefore} />
        <DaySection title="After Due Date (Overdue)" list={daysAfter}  setList={setDaysAfter}  newVal={newAfter}  setNew={setNewAfter} />

        <div className="px-7 py-5 bg-[var(--t-surface)] flex items-center justify-between flex-wrap gap-4">
          <p className={`text-xs ${sg} small-caps font-bold text-[var(--t-muted)]`}>
            Changes apply to new invoices only
          </p>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`bg-[var(--t-fg)] text-[var(--t-bg)] px-8 py-2.5 ${sg} small-caps font-bold text-xs tracking-wider hover:opacity-80 transition-opacity disabled:opacity-40 border border-[var(--t-border)]`}
          >
            {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

      </div>

      {/* Info note */}
      <div className="border border-[var(--t-border)] px-7 py-5 bg-[var(--t-surface)]">
        <p className={`${sg} small-caps font-bold text-xs tracking-wider text-[var(--t-fg)] mb-3`}>How Reminders Work</p>
        <p className="text-sm leading-relaxed text-[var(--t-muted)]">
          When you create an invoice, reminders are automatically scheduled based on this configuration. They are canceled the moment an invoice is marked as paid.
        </p>
      </div>

    </div>
  );
}
