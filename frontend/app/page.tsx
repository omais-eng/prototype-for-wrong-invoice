'use client'

import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  FileText,
  CheckCircle,
  XCircle,
  Copy,
  Clock,
  ThumbsUp,
  Upload,
  TrendingUp,
  Activity,
  RefreshCw,
} from 'lucide-react'
import {
  getStats,
  getRecentActivity,
  DashboardStats,
  ActivityItem,
  formatDateTime,
  formatCurrency,
  MOCK_INVOICES,
} from '@/lib/api'
import InvoiceUpload from '@/components/InvoiceUpload'
import clsx from 'clsx'

const CHART_DATA = [
  { month: 'Oct', valid: 110, invalid: 22, duplicate: 8 },
  { month: 'Nov', valid: 124, invalid: 18, duplicate: 11 },
  { month: 'Dec', valid: 98, invalid: 31, duplicate: 7 },
  { month: 'Jan', valid: 145, invalid: 24, duplicate: 9 },
  { month: 'Feb', valid: 162, invalid: 19, duplicate: 13 },
  { month: 'Mar', valid: 189, invalid: 34, duplicate: 15 },
]

const ACTIVITY_ICONS: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  uploaded: { icon: Upload, color: 'text-blue-600', bg: 'bg-blue-50' },
  approved: { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  rejected: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
  flagged: { icon: XCircle, color: 'text-amber-500', bg: 'bg-amber-50' },
  email_sent: { icon: Activity, color: 'text-purple-500', bg: 'bg-purple-50' },
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [s, a] = await Promise.all([getStats(), getRecentActivity()])
      setStats(s)
      setActivity(a)
      setLoading(false)
    }
    load()
  }, [])

  const statCards = stats
    ? [
        {
          label: 'Total Invoices',
          value: stats.total_invoices.toLocaleString(),
          icon: FileText,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          border: 'border-blue-100',
          trend: '+12% this month',
          trendUp: true,
        },
        {
          label: 'Valid',
          value: stats.valid.toLocaleString(),
          icon: CheckCircle,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50',
          border: 'border-emerald-100',
          trend: `${((stats.valid / stats.total_invoices) * 100).toFixed(1)}% pass rate`,
          trendUp: true,
        },
        {
          label: 'Invalid',
          value: stats.invalid.toLocaleString(),
          icon: XCircle,
          color: 'text-red-500',
          bg: 'bg-red-50',
          border: 'border-red-100',
          trend: `${((stats.invalid / stats.total_invoices) * 100).toFixed(1)}% error rate`,
          trendUp: false,
        },
        {
          label: 'Duplicates',
          value: stats.duplicates.toLocaleString(),
          icon: Copy,
          color: 'text-amber-600',
          bg: 'bg-amber-50',
          border: 'border-amber-100',
          trend: `${((stats.duplicates / stats.total_invoices) * 100).toFixed(1)}% dup rate`,
          trendUp: false,
        },
        {
          label: 'Pending Approval',
          value: stats.pending_approval.toLocaleString(),
          icon: Clock,
          color: 'text-purple-600',
          bg: 'bg-purple-50',
          border: 'border-purple-100',
          trend: 'Awaiting review',
          trendUp: null,
        },
        {
          label: 'Approved Today',
          value: stats.approved_today.toLocaleString(),
          icon: ThumbsUp,
          color: 'text-teal-600',
          bg: 'bg-teal-50',
          border: 'border-teal-100',
          trend: 'of today\'s batch',
          trendUp: true,
        },
      ]
    : []

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            AI Invoice Resolution Platform — Real-time overview
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="btn-secondary"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button onClick={() => setShowUpload(true)} className="btn-primary">
            <Upload className="w-4 h-4" />
            Upload Invoice
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-10 w-10 bg-gray-100 rounded-xl mb-4" />
              <div className="h-7 bg-gray-100 rounded w-16 mb-2" />
              <div className="h-4 bg-gray-100 rounded w-24" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          {statCards.map((card) => {
            const Icon = card.icon
            return (
              <div key={card.label} className={clsx('card p-5 border', card.border)}>
                <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center mb-4', card.bg)}>
                  <Icon className={clsx('w-5 h-5', card.color)} />
                </div>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-500 font-medium mt-0.5">{card.label}</p>
                <div className="flex items-center gap-1 mt-2">
                  {card.trendUp !== null && (
                    <TrendingUp
                      className={clsx(
                        'w-3 h-3',
                        card.trendUp ? 'text-emerald-500' : 'text-red-400'
                      )}
                    />
                  )}
                  <span className={clsx(
                    'text-xs',
                    card.trendUp === true ? 'text-emerald-600' :
                    card.trendUp === false ? 'text-red-500' : 'text-gray-400'
                  )}>
                    {card.trend}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Bar Chart */}
        <div className="card p-6 xl:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Invoice Volume by Status</h2>
              <p className="text-xs text-gray-400 mt-0.5">Last 6 months</p>
            </div>
            <div className="flex items-center gap-4">
              {[
                { color: 'bg-blue-500', label: 'Valid' },
                { color: 'bg-red-400', label: 'Invalid' },
                { color: 'bg-amber-400', label: 'Duplicate' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div className={clsx('w-2.5 h-2.5 rounded-sm', item.color)} />
                  <span className="text-xs text-gray-500">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          {mounted ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={CHART_DATA} barGap={4} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    fontSize: '12px',
                  }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="valid" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Valid" />
                <Bar dataKey="invalid" fill="#f87171" radius={[4, 4, 0, 0]} name="Invalid" />
                <Bar dataKey="duplicate" fill="#fbbf24" radius={[4, 4, 0, 0]} name="Duplicate" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 240 }} className="flex items-center justify-center text-gray-300 text-sm">Loading chart…</div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="card p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Recent Activity</h2>
            <span className="text-xs text-blue-600 font-medium cursor-pointer hover:underline">View all</span>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto">
            {activity.map((item) => {
              const cfg = ACTIVITY_ICONS[item.type] || ACTIVITY_ICONS.uploaded
              const Icon = cfg.icon
              return (
                <div key={item.id} className="flex items-start gap-3">
                  <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', cfg.bg)}>
                    <Icon className={clsx('w-4 h-4', cfg.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 leading-snug">{item.message}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-medium text-gray-500">{item.invoice_number}</span>
                      <span className="text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{formatDateTime(item.timestamp)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Recent Invoices</h2>
          <a href="/prototype-for-wrong-invoice/invoices/" className="text-xs text-blue-600 font-medium hover:underline">
            View all invoices
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">Invoice #</th>
                <th className="table-header">Vendor</th>
                <th className="table-header">Date</th>
                <th className="table-header">Amount</th>
                <th className="table-header">Status</th>
                <th className="table-header">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {MOCK_INVOICES.slice(0, 5).map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-cell font-medium text-blue-600">{inv.invoice_number}</td>
                  <td className="table-cell">{inv.vendor}</td>
                  <td className="table-cell text-gray-400">{inv.date}</td>
                  <td className="table-cell font-semibold">{formatCurrency(inv.amount)}</td>
                  <td className="table-cell">
                    <span className={clsx(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                      inv.status === 'valid' ? 'bg-emerald-50 text-emerald-700' :
                      inv.status === 'invalid' ? 'bg-red-50 text-red-700' :
                      inv.status === 'duplicate' ? 'bg-amber-50 text-amber-700' :
                      inv.status === 'pending' ? 'bg-blue-50 text-blue-700' :
                      inv.status === 'approved' ? 'bg-teal-50 text-teal-700' :
                      inv.status === 'rejected' ? 'bg-rose-50 text-rose-700' :
                      'bg-gray-100 text-gray-600'
                    )}>
                      {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                    </span>
                  </td>
                  <td className="table-cell">
                    {inv.risk_score !== undefined && inv.risk_score > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={clsx(
                              'h-full rounded-full',
                              inv.risk_score < 30 ? 'bg-emerald-500' :
                              inv.risk_score < 70 ? 'bg-amber-400' : 'bg-red-500'
                            )}
                            style={{ width: `${inv.risk_score}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">{inv.risk_score}%</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showUpload && (
        <InvoiceUpload onClose={() => setShowUpload(false)} />
      )}
    </div>
  )
}
