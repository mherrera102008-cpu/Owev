// @ts-nocheck
'use client';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useState } from 'react';
import { FileText, Clock, AlertCircle, CheckCircle, Plus, Trash2, DollarSign, Settings } from 'lucide-react';
import Link from 'next/link';

const STATUS_LABELS = {
  upcoming: { label: 'Upcoming', color: 'bg-blue-100 text-blue-700' },
  due: { label: 'Due Today', color: 'bg-amber-100 text-amber-700' },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700' },
};

type StatusFilter = 'all' | 'upcoming' | 'due' | 'overdue' | 'paid';

export default function DashboardContent() {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const summary = useQuery(api.dashboard.summary);
  const invoices = useQuery(api.invoices.list, filter === 'all' ? {} : { status: filter });
  const markPaid = useMutation(api.invoices.markPaid);
  const remove = useMutation(api.invoices.remove);

  const formatAmount = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

  const formatDate = (ms: number) =>
    new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-gray-900" />
            <span className="text-xl font-bold text-gray-900">InvoiceTracker</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <Link
              href="/dashboard/new"
              className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Invoice
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
              <span className="text-sm text-gray-500 font-medium">Upcoming</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{summary?.upcoming ?? '—'}</p>
            <p className="text-xs text-gray-400 mt-1">invoices pending</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <AlertCircle className="h-4 w-4 text-red-600" />
              </div>
              <span className="text-sm text-gray-500 font-medium">Overdue</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{summary?.overdue ?? '—'}</p>
            <p className="text-xs text-gray-400 mt-1">need attention</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <span className="text-sm text-gray-500 font-medium">Paid</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{summary?.paidThisMonth ?? '—'}</p>
            <p className="text-xs text-gray-400 mt-1">this month</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <DollarSign className="h-4 w-4 text-purple-600" />
              </div>
              <span className="text-sm text-gray-500 font-medium">Outstanding</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {summary ? formatAmount(summary.unpaidAmount) : '—'}
            </p>
            <p className="text-xs text-gray-400 mt-1">total unpaid</p>
          </div>
        </div>

        {/* Invoice table */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Invoices</h2>
            {/* Filter tabs */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {(['all', 'upcoming', 'due', 'overdue', 'paid'] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                    filter === s
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {s === 'due' ? 'Due Today' : s}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {!invoices ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
              Loading...
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-4 bg-gray-50 rounded-full mb-4">
                <FileText className="h-8 w-8 text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium">No invoices found</p>
              <p className="text-gray-400 text-sm mt-1">
                {filter === 'all' ? 'Create your first invoice to get started' : `No ${filter} invoices`}
              </p>
              {filter === 'all' && (
                <Link
                  href="/dashboard/new"
                  className="mt-4 flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  New Invoice
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">#</th>
                    <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">Client</th>
                    <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">Amount</th>
                    <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">Due Date</th>
                    <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">Status</th>
                    <th className="text-right text-xs font-medium text-gray-400 px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {invoices.map((invoice) => (
                    <tr key={invoice._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-400">#{invoice.invoiceNumber}</td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">{invoice.clientName}</p>
                        <p className="text-xs text-gray-400">{invoice.clientEmail}</p>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        {formatAmount(invoice.amount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDate(invoice.dueDate)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_LABELS[invoice.status].color}`}>
                          {STATUS_LABELS[invoice.status].label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {invoice.status !== 'paid' && (
                            <button
                              onClick={() => markPaid({ id: invoice._id })}
                              className="text-xs font-medium text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1 rounded-md transition-colors"
                            >
                              Mark Paid
                            </button>
                          )}
                          <button
                            onClick={() => remove({ id: invoice._id })}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
      </main>
    </div>
  );
}
