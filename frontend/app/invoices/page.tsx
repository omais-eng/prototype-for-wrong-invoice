'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Upload,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Filter,
  X,
} from 'lucide-react'
import {
  getInvoices,
  Invoice,
  InvoiceStatus,
  formatCurrency,
  formatDate,
} from '@/lib/api'
import StatusBadge from '@/components/StatusBadge'
import InvoiceUpload from '@/components/InvoiceUpload'
import ValidationDetails from '@/components/ValidationDetails'
import clsx from 'clsx'

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'valid', label: 'Valid' },
  { value: 'invalid', label: 'Invalid' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

const PAGE_SIZE = 8

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [vendorSearch, setVendorSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params: Record<string, unknown> = {
      page,
      limit: PAGE_SIZE,
    }
    if (statusFilter !== 'all') params.status = statusFilter
    if (vendorSearch) params.vendor = vendorSearch
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo

    const result = await getInvoices(params as Parameters<typeof getInvoices>[0])
    setInvoices(result.invoices)
    setTotal(result.total)
    setLoading(false)
  }, [page, statusFilter, vendorSearch, dateFrom, dateTo])

  useEffect(() => {
    load()
  }, [load])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  function clearFilters() {
    setStatusFilter('all')
    setVendorSearch('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const hasFilters = statusFilter !== 'all' || vendorSearch || dateFrom || dateTo

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoice Inbox</h1>
          <p className="text-gray-500 text-sm mt-1">
            {total} invoice{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <button onClick={() => setShowUpload(true)} className="btn-primary">
          <Upload className="w-4 h-4" />
          Upload Invoice
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by vendor..."
              value={vendorSearch}
              onChange={(e) => { setVendorSearch(e.target.value); setPage(1) }}
              className="input pl-9"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="select"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
              className="select text-sm"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
              className="select text-sm"
            />
          </div>

          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
              <X className="w-3.5 h-3.5" />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">Invoice #</th>
                <th className="table-header">Vendor</th>
                <th className="table-header">Date</th>
                <th className="table-header">PO Number</th>
                <th className="table-header">Amount</th>
                <th className="table-header">Status</th>
                <th className="table-header">Risk Score</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="table-cell">
                        <div className="h-4 bg-gray-100 rounded w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No invoices found</p>
                    {hasFilters && (
                      <button onClick={clearFilters} className="text-blue-600 text-sm mt-2 hover:underline">
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="table-cell">
                      <button
                        onClick={() => setSelectedInvoice(invoice)}
                        className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        {invoice.invoice_number}
                      </button>
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
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={clsx(
                                'h-full rounded-full',
                                invoice.risk_score < 30 ? 'bg-emerald-500' :
                                invoice.risk_score < 70 ? 'bg-amber-400' : 'bg-red-500'
                              )}
                              style={{ width: `${invoice.risk_score}%` }}
                            />
                          </div>
                          <span className={clsx(
                            'text-xs font-medium',
                            invoice.risk_score < 30 ? 'text-emerald-600' :
                            invoice.risk_score < 70 ? 'text-amber-600' : 'text-red-600'
                          )}>
                            {invoice.risk_score}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <button
                        onClick={() => setSelectedInvoice(invoice)}
                        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-200 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </button>
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
                  <>
                    {idx > 0 && arr[idx - 1] !== p - 1 && (
                      <span key={`dots-${p}`} className="px-2 text-gray-300 text-sm">...</span>
                    )}
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={clsx(
                        'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                        page === p
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      )}
                    >
                      {p}
                    </button>
                  </>
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

      {/* Invoice Detail Drawer */}
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
              {/* Status & Risk */}
              <div className="flex items-center gap-4">
                <StatusBadge status={selectedInvoice.status as InvoiceStatus} />
                {selectedInvoice.risk_score !== undefined && selectedInvoice.risk_score > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Risk:</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={clsx(
                            'h-full rounded-full',
                            selectedInvoice.risk_score < 30 ? 'bg-emerald-500' :
                            selectedInvoice.risk_score < 70 ? 'bg-amber-400' : 'bg-red-500'
                          )}
                          style={{ width: `${selectedInvoice.risk_score}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-700">{selectedInvoice.risk_score}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Details Grid */}
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

              {/* AI Summary */}
              {selectedInvoice.ai_summary && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <span className="w-5 h-5 bg-blue-100 rounded text-blue-600 flex items-center justify-center text-xs">AI</span>
                    AI Analysis
                  </h3>
                  <p className="text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-lg p-3 leading-relaxed">
                    {selectedInvoice.ai_summary}
                  </p>
                </div>
              )}

              {/* Validation Errors */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Validation Results</h3>
                <ValidationDetails errors={selectedInvoice.errors || []} />
              </div>
            </div>
          </div>
        </div>
      )}

      {showUpload && (
        <InvoiceUpload
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); load() }}
        />
      )}
    </div>
  )
}
