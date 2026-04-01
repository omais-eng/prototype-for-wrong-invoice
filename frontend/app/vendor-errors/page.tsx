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
  AlertOctagon,
  Mail,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle,
  XCircle,
  AlertCircle,
  Building2,
} from 'lucide-react'
import {
  getVendors,
  getEmailLogs,
  getInvoices,
  Vendor,
  EmailLog,
  Invoice,
  InvoiceStatus,
  formatDate,
  formatDateTime,
  formatCurrency,
  MOCK_INVOICES,
} from '@/lib/api'
import StatusBadge from '@/components/StatusBadge'
import clsx from 'clsx'

const ERROR_COLORS: Record<string, string> = {
  PRICE_MISMATCH: '#f87171',
  PO_MISMATCH: '#fb923c',
  DUPLICATE_INVOICE: '#fbbf24',
  MISSING_FIELD: '#a78bfa',
  TAX_CALCULATION: '#60a5fa',
  EXPIRED_CONTRACT: '#f472b6',
}

export default function VendorErrorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null)
  const [vendorInvoices, setVendorInvoices] = useState<Record<string, Invoice[]>>({})
  const [activeTab, setActiveTab] = useState<'vendors' | 'chart' | 'emails'>('vendors')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [v, e] = await Promise.all([getVendors(), getEmailLogs()])
      setVendors(v)
      setEmailLogs(e)
      setLoading(false)
    }
    load()
  }, [])

  async function toggleVendor(vendorId: string) {
    if (expandedVendor === vendorId) {
      setExpandedVendor(null)
      return
    }
    setExpandedVendor(vendorId)
    if (!vendorInvoices[vendorId]) {
      // Filter from mock data
      const invs = MOCK_INVOICES.filter(
        (i) => i.vendor_id === vendorId && (i.status === 'invalid' || i.status === 'duplicate')
      )
      setVendorInvoices((prev) => ({ ...prev, [vendorId]: invs }))
    }
  }

  // Build chart data from all vendor errors
  const allErrorCodes = Array.from(
    new Set(vendors.flatMap((v) => Object.keys(v.errors_by_type)))
  )

  const chartData = allErrorCodes.map((code) => ({
    name: code.replace(/_/g, ' '),
    count: vendors.reduce((sum, v) => sum + (v.errors_by_type[code] || 0), 0),
    fill: ERROR_COLORS[code] || '#94a3b8',
  })).sort((a, b) => b.count - a.count)

  const totalErrors = vendors.reduce((s, v) => s + v.invalid_count, 0)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendor Error Logs</h1>
          <p className="text-gray-500 text-sm mt-1">
            Track invoice errors and automated notifications by vendor
          </p>
        </div>
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-4 py-2 rounded-xl">
          <AlertOctagon className="w-4 h-4 text-red-500" />
          <span className="text-sm font-semibold text-red-700">{totalErrors} total errors</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: 'vendors', label: 'Vendor Summary' },
          { key: 'chart', label: 'Error Distribution' },
          { key: 'emails', label: `Email Log (${emailLogs.length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Vendor Summary */}
      {activeTab === 'vendors' && (
        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="h-5 bg-gray-100 rounded w-48" />
              </div>
            ))
          ) : (
            vendors
              .sort((a, b) => b.error_rate - a.error_rate)
              .map((vendor) => {
                const isExpanded = expandedVendor === vendor.id
                const invs = vendorInvoices[vendor.id] || []

                return (
                  <div key={vendor.id} className="card border overflow-hidden">
                    <button
                      onClick={() => toggleVendor(vendor.id)}
                      className="w-full flex items-center gap-4 p-5 text-left hover:bg-gray-50 transition-colors"
                    >
                      {/* Vendor Info */}
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-slate-500" />
                      </div>
                      <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-4">
                        <div className="sm:col-span-2">
                          <p className="text-sm font-semibold text-gray-900">{vendor.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{vendor.email}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Total Invoices</p>
                          <p className="text-sm font-medium text-gray-700">{vendor.total_invoices}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Errors</p>
                          <p className="text-sm font-medium text-red-600">{vendor.invalid_count}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Error Rate</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={clsx(
                                  'h-full rounded-full',
                                  vendor.error_rate < 10 ? 'bg-emerald-500' :
                                  vendor.error_rate < 20 ? 'bg-amber-400' : 'bg-red-500'
                                )}
                                style={{ width: `${Math.min(vendor.error_rate, 100)}%` }}
                              />
                            </div>
                            <span className={clsx(
                              'text-xs font-semibold',
                              vendor.error_rate < 10 ? 'text-emerald-600' :
                              vendor.error_rate < 20 ? 'text-amber-600' : 'text-red-600'
                            )}>
                              {vendor.error_rate}%
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Top error badges */}
                        <div className="hidden sm:flex gap-1">
                          {Object.entries(vendor.errors_by_type)
                            .slice(0, 2)
                            .map(([code, count]) => (
                              <span
                                key={code}
                                className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{
                                  backgroundColor: (ERROR_COLORS[code] || '#94a3b8') + '20',
                                  color: ERROR_COLORS[code] || '#6b7280',
                                  border: `1px solid ${(ERROR_COLORS[code] || '#94a3b8')}40`,
                                }}
                              >
                                {code.replace(/_/g, ' ')}: {count}
                              </span>
                            ))}
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {/* Expanded: Error breakdown + invoices */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 p-5 bg-gray-50/50 space-y-5">
                        {/* Error Type Breakdown */}
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                            Error Breakdown
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {Object.entries(vendor.errors_by_type).map(([code, count]) => (
                              <div
                                key={code}
                                className="bg-white border border-gray-200 rounded-lg px-3 py-2 flex items-center justify-between"
                              >
                                <span className="text-xs text-gray-600 font-medium">
                                  {code.replace(/_/g, ' ')}
                                </span>
                                <span
                                  className="text-sm font-bold"
                                  style={{ color: ERROR_COLORS[code] || '#6b7280' }}
                                >
                                  {count}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Invalid Invoices */}
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                            Invalid Invoices
                          </h4>
                          {invs.length === 0 ? (
                            <p className="text-sm text-gray-400">No invalid invoices in current view</p>
                          ) : (
                            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                  <tr>
                                    <th className="table-header">Invoice #</th>
                                    <th className="table-header">Date</th>
                                    <th className="table-header">Amount</th>
                                    <th className="table-header">Status</th>
                                    <th className="table-header">Errors</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {invs.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-gray-50">
                                      <td className="table-cell font-medium text-blue-600">{inv.invoice_number}</td>
                                      <td className="table-cell text-gray-500">{formatDate(inv.date)}</td>
                                      <td className="table-cell font-semibold">{formatCurrency(inv.amount)}</td>
                                      <td className="table-cell">
                                        <StatusBadge status={inv.status as InvoiceStatus} size="sm" />
                                      </td>
                                      <td className="table-cell">
                                        <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                                          {inv.errors?.length || 0} error{(inv.errors?.length || 0) !== 1 ? 's' : ''}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
          )}
        </div>
      )}

      {/* Tab: Error Chart */}
      {activeTab === 'chart' && (
        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Error Type Distribution</h2>
          <p className="text-xs text-gray-400 mb-6">Total occurrences across all vendors</p>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} layout="vertical" barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                width={130}
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
              <Bar
                dataKey="count"
                name="Error Count"
                radius={[0, 4, 4, 0]}
                fill="#f87171"
              />
            </BarChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {chartData.map(({ name, count, fill }) => (
              <div key={name} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: fill }} />
                <span className="text-xs text-gray-600 flex-1 min-w-0 truncate">{name}</span>
                <span className="text-xs font-bold text-gray-800">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Email Log */}
      {activeTab === 'emails' && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <Mail className="w-4 h-4 text-gray-400" />
            <h2 className="text-base font-semibold text-gray-900">Automated Rejection Emails</h2>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {emailLogs.length} sent
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Vendor</th>
                  <th className="table-header">Email</th>
                  <th className="table-header">Invoice</th>
                  <th className="table-header">Subject</th>
                  <th className="table-header">Sent At</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="table-cell">
                          <div className="h-4 bg-gray-100 rounded w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : emailLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12">
                      <Mail className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                      <p className="text-gray-400 text-sm">No emails sent yet</p>
                    </td>
                  </tr>
                ) : (
                  emailLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="table-cell font-medium text-gray-800">{log.vendor}</td>
                      <td className="table-cell text-gray-500 text-xs">{log.vendor_email}</td>
                      <td className="table-cell">
                        <span className="font-medium text-blue-600 text-xs">{log.invoice_number}</span>
                      </td>
                      <td className="table-cell text-gray-600 max-w-xs truncate text-xs">
                        {log.subject}
                      </td>
                      <td className="table-cell text-gray-500 text-xs whitespace-nowrap">
                        {formatDateTime(log.sent_at)}
                      </td>
                      <td className="table-cell">
                        <span className={clsx(
                          'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                          log.status === 'sent' ? 'bg-emerald-50 text-emerald-700' :
                          log.status === 'failed' ? 'bg-red-50 text-red-700' :
                          'bg-amber-50 text-amber-700'
                        )}>
                          {log.status === 'sent' && <CheckCircle className="w-3 h-3" />}
                          {log.status === 'failed' && <XCircle className="w-3 h-3" />}
                          {log.status === 'bounced' && <AlertCircle className="w-3 h-3" />}
                          {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
