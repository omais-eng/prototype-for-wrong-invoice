'use client'

import { useState, useEffect } from 'react'
import {
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Filter,
  AlertCircle,
  TrendingUp,
} from 'lucide-react'
import {
  getInvoices,
  Invoice,
  InvoiceStatus,
  formatCurrency,
  formatDate,
  MOCK_INVOICES,
} from '@/lib/api'
import StatusBadge from '@/components/StatusBadge'
import ValidationDetails from '@/components/ValidationDetails'
import clsx from 'clsx'

const ERROR_TYPE_OPTIONS = [
  { value: 'all', label: 'All Error Types' },
  { value: 'PRICE_MISMATCH', label: 'Price Mismatch' },
  { value: 'PO_MISMATCH', label: 'PO Mismatch' },
  { value: 'DUPLICATE_INVOICE', label: 'Duplicate Invoice' },
  { value: 'MISSING_FIELD', label: 'Missing Field' },
  { value: 'TAX_CALCULATION', label: 'Tax Calculation' },
  { value: 'EXPIRED_CONTRACT', label: 'Expired Contract' },
]

export default function ValidationPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [errorFilter, setErrorFilter] = useState('all')

  useEffect(() => {
    async function load() {
      setLoading(true)
      // Load invalid + duplicate invoices
      const [inv, dup] = await Promise.all([
        getInvoices({ status: 'invalid' }),
        getInvoices({ status: 'duplicate' }),
      ])
      setInvoices([...inv.invoices, ...dup.invoices])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = errorFilter === 'all'
    ? invoices
    : invoices.filter((inv) =>
        inv.errors?.some((e) => e.code === errorFilter)
      )

  // Error type stats
  const errorStats = MOCK_INVOICES
    .flatMap((i) => i.errors || [])
    .reduce<Record<string, number>>((acc, e) => {
      acc[e.code] = (acc[e.code] || 0) + 1
      return acc
    }, {})

  const topErrors = Object.entries(errorStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  const maxCount = Math.max(...topErrors.map(([, c]) => c), 1)

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Validation Results</h1>
          <p className="text-gray-500 text-sm mt-1">
            {filtered.length} invoice{filtered.length !== 1 ? 's' : ''} with validation issues
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <div className="card p-5 border border-red-100 lg:col-span-1">
          <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center mb-3">
            <ShieldAlert className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
          <p className="text-xs text-gray-500 font-medium mt-0.5">Total Issues Found</p>
          <p className="text-xs text-red-500 mt-1">Requires attention</p>
        </div>

        <div className="card p-5 lg:col-span-3">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Top Error Types</h3>
          </div>
          <div className="space-y-2.5">
            {topErrors.map(([code, count]) => (
              <div key={code} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-36 flex-shrink-0 font-medium">
                  {code.replace(/_/g, ' ')}
                </span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-400 rounded-full transition-all"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-700 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="card p-4 mb-5">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600 font-medium">Filter by error type:</span>
          <select
            value={errorFilter}
            onChange={(e) => setErrorFilter(e.target.value)}
            className="select"
          >
            {ERROR_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Invoice List */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-5 bg-gray-100 rounded w-48 mb-3" />
              <div className="h-4 bg-gray-100 rounded w-64" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="card p-16 text-center">
            <ShieldAlert className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 text-sm">No invoices match this filter</p>
          </div>
        ) : (
          filtered.map((invoice) => {
            const isExpanded = expandedId === invoice.id
            const errorCount = invoice.errors?.length || 0
            const hasErrors = errorCount > 0

            return (
              <div
                key={invoice.id}
                className={clsx(
                  'card border overflow-hidden transition-all',
                  hasErrors ? 'border-red-100' : 'border-gray-200'
                )}
              >
                {/* Row Header */}
                <button
                  onClick={() => toggleExpand(invoice.id)}
                  className="w-full flex items-center gap-4 p-5 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Invoice</p>
                      <p className="text-sm font-semibold text-blue-600">{invoice.invoice_number}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Vendor</p>
                      <p className="text-sm font-medium text-gray-800">{invoice.vendor}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Amount</p>
                      <p className="text-sm font-semibold text-gray-800">{formatCurrency(invoice.amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Date</p>
                      <p className="text-sm text-gray-600">{formatDate(invoice.date)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status={invoice.status as InvoiceStatus} />
                    {hasErrors && (
                      <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full border border-red-100">
                        <AlertCircle className="w-3 h-3" />
                        {errorCount} error{errorCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {/* Risk Score */}
                    {invoice.risk_score !== undefined && invoice.risk_score > 0 && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={clsx(
                              'h-full rounded-full',
                              invoice.risk_score < 30 ? 'bg-emerald-500' :
                              invoice.risk_score < 70 ? 'bg-amber-400' : 'bg-red-500'
                            )}
                            style={{ width: `${invoice.risk_score}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">{invoice.risk_score}%</span>
                      </div>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 pb-5 pt-4 bg-gray-50/50 space-y-5">
                    {/* AI Summary */}
                    {invoice.ai_summary && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <span className="w-5 h-5 bg-blue-100 rounded text-blue-600 flex items-center justify-center text-xs font-bold">AI</span>
                          AI Analysis Summary
                        </h4>
                        <p className="text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-lg p-3 leading-relaxed">
                          {invoice.ai_summary}
                        </p>
                      </div>
                    )}

                    {/* Risk Score Detail */}
                    {invoice.risk_score !== undefined && invoice.risk_score > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                          Risk Assessment
                        </h4>
                        <div className="bg-white border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">Overall Risk Score</span>
                            <span className={clsx(
                              'text-sm font-bold',
                              invoice.risk_score < 30 ? 'text-emerald-600' :
                              invoice.risk_score < 70 ? 'text-amber-600' : 'text-red-600'
                            )}>
                              {invoice.risk_score}% —{' '}
                              {invoice.risk_score < 30 ? 'Low Risk' :
                               invoice.risk_score < 70 ? 'Medium Risk' : 'High Risk'}
                            </span>
                          </div>
                          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={clsx(
                                'h-full rounded-full transition-all',
                                invoice.risk_score < 30 ? 'bg-emerald-500' :
                                invoice.risk_score < 70 ? 'bg-amber-400' : 'bg-red-500'
                              )}
                              style={{ width: `${invoice.risk_score}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Validation Errors */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        Validation Errors & Suggested Corrections
                      </h4>
                      <ValidationDetails errors={invoice.errors || []} />
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
