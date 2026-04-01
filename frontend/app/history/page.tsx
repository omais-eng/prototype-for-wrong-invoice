'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  History,
  SlidersHorizontal,
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

const PAGE_SIZE = 10

export default function HistoryPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params: Record<string, unknown> = { page, limit: PAGE_SIZE }
    if (statusFilter !== 'all') params.status = statusFilter
    if (search) params.vendor = search
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    if (amountMin) params.amount_min = parseFloat(amountMin)
    if (amountMax) params.amount_max = parseFloat(amountMax)
    const result = await getInvoices(params as Parameters<typeof getInvoices>[0])
    setInvoices(result.invoices)
    setTotal(result.total)
    setLoading(false)
  }, [page, statusFilter, search, dateFrom, dateTo, amountMin, amountMax])

  useEffect(() => {
    load()
  }, [load])

  function clearFilters() {
    setSearch('')
    setStatusFilter('all')
    setDateFrom('')
    setDateTo('')
    setAmountMin('')
    setAmountMax('')
    setPage(1)
  }

  const hasFilters = search || statusFilter !== 'all' || dateFrom || dateTo || amountMin || amountMax

  function exportCSV() {
    const data = MOCK_INVOICES
    const headers = ['Invoice #', 'Vendor', 'Date', 'Amount', 'Currency', 'PO Number', 'Status', 'Risk Score']
    const rows = data.map((inv) => [
      inv.invoice_number,
      inv.vendor,
      inv.date,
      inv.amount.toFixed(2),
      inv.currency,
      inv.po_number || '',
      inv.status,
      inv.risk_score?.toString() || '',
    ])

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `airp-invoice-history-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoice History</h1>
          <p className="text-gray-500 text-sm mt-1">
            Complete searchable log of all processed invoices
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx('btn-secondary', showFilters && 'bg-blue-50 border-blue-200 text-blue-600')}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Advanced Filters
            {hasFilters && (
              <span className="w-2 h-2 bg-blue-500 rounded-full" />
            )}
          </button>
          <button onClick={exportCSV} className="btn-primary">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card p-4 mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by vendor name, invoice number..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="input pl-9"
          />
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="card p-4 mb-3 border-blue-100 border">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                className="select"
              >
                {[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'valid', label: 'Valid' },
                  { value: 'invalid', label: 'Invalid' },
                  { value: 'duplicate', label: 'Duplicate' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'rejected', label: 'Rejected' },
                ].map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                className="select"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                className="select"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Min Amount ($)</label>
              <input
                type="number"
                placeholder="0"
                value={amountMin}
                onChange={(e) => { setAmountMin(e.target.value); setPage(1) }}
                className="select w-32"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Max Amount ($)</label>
              <input
                type="number"
                placeholder="Any"
                value={amountMax}
                onChange={(e) => { setAmountMax(e.target.value); setPage(1) }}
                className="select w-32"
              />
            </div>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 pb-0.5"
              >
                <X className="w-3.5 h-3.5" />
                Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <p className="text-sm text-gray-500">
            {total} invoice{total !== 1 ? 's' : ''}
            {hasFilters && ' (filtered)'}
          </p>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-blue-600 hover:underline">
              Clear filters
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-100">
              <tr>
                <th className="table-header">Invoice #</th>
                <th className="table-header">Vendor</th>
                <th className="table-header">Date</th>
                <th className="table-header">PO Number</th>
                <th className="table-header">Amount</th>
                <th className="table-header">Status</th>
                <th className="table-header">Risk</th>
                <th className="table-header">Errors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="table-cell">
                        <div className="h-4 bg-gray-100 rounded w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <History className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No invoices found</p>
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedInvoice(invoice)}
                  >
                    <td className="table-cell">
                      <span className="font-medium text-blue-600 hover:underline">
                        {invoice.invoice_number}
                      </span>
                    </td>
                    <td className="table-cell font-medium text-gray-800">{invoice.vendor}</td>
                    <td className="table-cell text-gray-500">{formatDate(invoice.date)}</td>
                    <td className="table-cell text-gray-500">{invoice.po_number || '—'}</td>
                    <td className="table-cell font-semibold text-gray-800">
                      {formatCurrency(invoice.amount)}
                    </td>
                    <td className="table-cell">
                      <StatusBadge status={invoice.status as InvoiceStatus} />
                    </td>
                    <td className="table-cell">
                      {invoice.risk_score !== undefined && invoice.risk_score > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={clsx(
                                'h-full rounded-full',
                                invoice.risk_score < 30 ? 'bg-emerald-500' :
                                invoice.risk_score < 70 ? 'bg-amber-400' : 'bg-red-500'
                              )}
                              style={{ width: `${invoice.risk_score}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{invoice.risk_score}%</span>
                        </div>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="table-cell">
                      {(invoice.errors?.length || 0) > 0 ? (
                        <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                          {invoice.errors!.length} error{invoice.errors!.length !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                          Clean
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-30 rounded-lg hover:bg-gray-100"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .map((p, idx, arr) => (
                  <span key={p}>
                    {idx > 0 && arr[idx - 1] !== p - 1 && (
                      <span className="px-1 text-gray-300 text-sm">...</span>
                    )}
                    <button
                      onClick={() => setPage(p)}
                      className={clsx(
                        'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                        page === p ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                      )}
                    >
                      {p}
                    </button>
                  </span>
                ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-30 rounded-lg hover:bg-gray-100"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-white w-full max-w-xl h-full overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{selectedInvoice.invoice_number}</h2>
                <p className="text-sm text-gray-500">{selectedInvoice.vendor}</p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center gap-3">
                <StatusBadge status={selectedInvoice.status as InvoiceStatus} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Vendor', value: selectedInvoice.vendor },
                  { label: 'Amount', value: formatCurrency(selectedInvoice.amount) },
                  { label: 'Invoice Date', value: formatDate(selectedInvoice.date) },
                  { label: 'PO Number', value: selectedInvoice.po_number || '—' },
                  { label: 'Submitted', value: formatDate(selectedInvoice.created_at) },
                  { label: 'Last Updated', value: formatDate(selectedInvoice.updated_at) },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-400 font-medium mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-gray-800">{value}</p>
                  </div>
                ))}
              </div>

              {selectedInvoice.ai_summary && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">AI Analysis</h3>
                  <p className="text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-lg p-3 leading-relaxed">
                    {selectedInvoice.ai_summary}
                  </p>
                </div>
              )}

              {selectedInvoice.risk_score !== undefined && selectedInvoice.risk_score > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Risk Score</h3>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          'h-full rounded-full',
                          selectedInvoice.risk_score < 30 ? 'bg-emerald-500' :
                          selectedInvoice.risk_score < 70 ? 'bg-amber-400' : 'bg-red-500'
                        )}
                        style={{ width: `${selectedInvoice.risk_score}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-700">{selectedInvoice.risk_score}%</span>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Validation Results</h3>
                <ValidationDetails errors={selectedInvoice.errors || []} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
