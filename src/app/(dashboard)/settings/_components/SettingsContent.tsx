'use client';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useState, useEffect } from 'react';
import { ArrowLeft, FileText, Bell, Save, X, Plus } from 'lucide-react';
import Link from 'next/link';

export default function SettingsContent() {
  const tenant = useQuery(api.tenants.get);
  const updateConfig = useMutation(api.tenants.updateReminderConfig);

  const [daysBefore, setDaysBefore] = useState<number[]>([7, 3, 1]);
  const [daysAfter, setDaysAfter] = useState<number[]>([1, 3, 7]);
  const [newBefore, setNewBefore] = useState('');
  const [newAfter, setNewAfter] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (tenant?.reminderConfig) {
      setDaysBefore(tenant.reminderConfig.daysBefore);
      setDaysAfter(tenant.reminderConfig.daysAfter);
    }
  }, [tenant]);

  const addDay = (list: number[], setList: (v: number[]) => void, val: string) => {
    const n = parseInt(val);
    if (!isNaN(n) && n > 0 && !list.includes(n)) {
      setList([...list, n].sort((a, b) => b - a));
    }
  };

  const removeDay = (list: number[], setList: (v: number[]) => void, n: number) => {
    setList(list.filter((d) => d !== n));
  };

  const handleSave = async () => {
    setSaving(true);
    await updateConfig({ daysBefore, daysAfter });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="h-4 w-4 text-gray-600" />
          </Link>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-900" />
            <span className="text-lg font-bold text-gray-900">InvoiceTracker</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Reminder Schedule */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Bell className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Reminder Schedule</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                Configure when automatic reminders are sent for each invoice
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Days before */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Before due date
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {daysBefore.map((d) => (
                  <span
                    key={d}
                    className="flex items-center gap-1.5 bg-blue-50 text-blue-700 text-sm px-3 py-1 rounded-full"
                  >
                    {d} day{d !== 1 ? 's' : ''} before
                    <button onClick={() => removeDay(daysBefore, setDaysBefore, d)}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {daysBefore.length === 0 && (
                  <span className="text-sm text-gray-400 italic">No reminders before due date</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  placeholder="Days"
                  value={newBefore}
                  onChange={(e) => setNewBefore(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addDay(daysBefore, setDaysBefore, newBefore);
                      setNewBefore('');
                    }
                  }}
                  className="w-24 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <button
                  onClick={() => { addDay(daysBefore, setDaysBefore, newBefore); setNewBefore(''); }}
                  className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 px-2.5 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Days after */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                After due date (overdue reminders)
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {daysAfter.map((d) => (
                  <span
                    key={d}
                    className="flex items-center gap-1.5 bg-red-50 text-red-700 text-sm px-3 py-1 rounded-full"
                  >
                    {d} day{d !== 1 ? 's' : ''} after
                    <button onClick={() => removeDay(daysAfter, setDaysAfter, d)}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {daysAfter.length === 0 && (
                  <span className="text-sm text-gray-400 italic">No reminders after due date</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  placeholder="Days"
                  value={newAfter}
                  onChange={(e) => setNewAfter(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addDay(daysAfter, setDaysAfter, newAfter);
                      setNewAfter('');
                    }
                  }}
                  className="w-24 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <button
                  onClick={() => { addDay(daysAfter, setDaysAfter, newAfter); setNewAfter(''); }}
                  className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 px-2.5 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Info card */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
          <p className="text-sm text-blue-800 font-medium mb-1">How reminders work</p>
          <p className="text-sm text-blue-700 leading-relaxed">
            When you create an invoice, reminders are automatically scheduled for each configured day.
            Reminders are cancelled instantly when you mark an invoice as paid.
            Changes to this schedule only apply to new invoices.
          </p>
        </div>
      </main>
    </div>
  );
}
