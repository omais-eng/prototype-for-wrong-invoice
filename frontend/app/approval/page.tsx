'use client'

import { useState, useEffect } from 'react'
import {
  CheckCircle,
  XCircle,
  MessageSquare,
  ThumbsUp,
  ClipboardList,
  X,
  Loader2,
} from 'lucide-react'
import {
  getInvoices,
  approveInvoice,
  rejectInvoice,
  Invoice,
  formatCurrency,
  formatDate,
} from '@/lib/api'
import clsx from 'clsx'

type ActionState = 'idle' | 'loading' | 'done'

interface InvoiceAction {
  id: string
  type: 'approved' | 'rejected' | 'clarification'
}

export default function ApprovalPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [actions, setActions] = useState<Record<string, ActionState>>({})
  const [processed, setProcessed] = useState<InvoiceAction[]>([])
  const [rejectModal, setRejectModal] = useState<{ invoice: Invoice } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [clarModal, setClarModal] = useState<{ invoice: Invoice } | null>(null)
  const [clarNote, setClarNote] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const result = await getInvoices({ status: 'pending' })
      setInvoices(result.invoices)
      setLoading(false)
    }
    load()
  }, [])

  async function handleApprove(invoice: Invoice) {
    setActions((prev) => ({ ...prev, [invoice.id]: 'loading' }))
    await approveInvoice(invoice.id)
    setActions((prev) => ({ ...prev, [invoice.id]: 'done' }))
    setProcessed((prev) => [...prev, { id: invoice.id, type: 'approved' }])
  }

  async function handleReject() {
    if (!rejectModal) return
    const invoice = rejectModal.invoice
    setRejectModal(null)
    setActions((prev) => ({ ...prev, [invoice.id]: 'loading' }))
    await rejectInvoice(invoice.id, rejectReason)
    setActions((prev) => ({ ...prev, [invoice.id]: 'done' }))
    setProcessed((prev) => [...prev, { id: invoice.id, type: 'rejected' }])
    setRejectReason('')
  }

  async function handleClarification() {
    if (!clarModal) return
    const invoice = clarModal.invoice
    setClarModal(null)
    setActions((prev) => ({ ...prev, [invoice.id]: 'done' }))
    setProcessed((prev) => [...prev, { id: invoice.id, type: 'clarification' }])
    setClarNote('')
  }

  const approvedToday = processed.filter((p) => p.type === 'approved').length
  const pendingCount = invoices.filter((inv) => !processed.find((p) => p.id === inv.id)).length

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Approval Queue</h1>
          <p className="text-gray-500 text-sm mt-1">
            Review and approve invoices that passed AI validation
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl">
            <ThumbsUp className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-700">
              Approved today: {approvedToday}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl">
            <ClipboardList className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-700">
              Pending: {pendingCount}
            </span>
          </div>
        </div>
      </div>

      {/* Invoice Cards */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="h-5 bg-gray-100 rounded w-40" />
                  <div className="h-4 bg-gray-100 rounded w-56" />
                </div>
                <div className="flex gap-2">
                  <div className="h-9 bg-gray-100 rounded w-24" />
                  <div className="h-9 bg-gray-100 rounded w-24" />
                </div>
              </div>
            </div>
          ))
        ) : invoices.length === 0 ? (
          <div className="card p-16 text-center">
            <ClipboardList className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 text-base font-medium">No invoices pending approval</p>
            <p className="text-gray-400 text-sm mt-1">All queued invoices have been processed</p>
          </div>
        ) : (
          invoices.map((invoice) => {
            const action = actions[invoice.id]
            const processedAction = processed.find((p) => p.id === invoice.id)
            const isDone = action === 'done'
            const isLoading = action === 'loading'

            return (
              <div
                key={invoice.id}
                className={clsx(
                  'card border transition-all',
                  isDone
                    ? processedAction?.type === 'approved'
                      ? 'border-emerald-200 bg-emerald-50/40'
                      : processedAction?.type === 'rejected'
                      ? 'border-red-200 bg-red-50/30'
                      : 'border-amber-200 bg-amber-50/30'
                    : 'border-gray-200'
                )}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    {/* Invoice Info */}
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-semibold text-gray-900">
                          {invoice.invoice_number}
                        </h3>
                        <span className="text-xs bg-blue-50 text-blue-600 font-medium px-2 py-0.5 rounded-full border border-blue-100">
                          Pending Approval
                        </span>
                        {isDone && processedAction && (
                          <span className={clsx(
                            'text-xs font-semibold px-2 py-0.5 rounded-full',
                            processedAction.type === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                            processedAction.type === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          )}>
                            {processedAction.type === 'approved' ? 'Approved' :
                             processedAction.type === 'rejected' ? 'Rejected' : 'Clarification Sent'}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Vendor</p>
                          <p className="text-sm font-medium text-gray-800">{invoice.vendor}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Amount</p>
                          <p className="text-sm font-bold text-gray-900">{formatCurrency(invoice.amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">PO Number</p>
                          <p className="text-sm text-gray-700">{invoice.po_number || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Invoice Date</p>
                          <p className="text-sm text-gray-700">{formatDate(invoice.date)}</p>
                        </div>
                      </div>

                      {/* AI Summary */}
                      {invoice.ai_summary && (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                          <p className="text-xs text-blue-500 font-semibold uppercase tracking-wide mb-1">
                            AI Assessment
                          </p>
                          <p className="text-sm text-blue-800 leading-relaxed">{invoice.ai_summary}</p>
                        </div>
                      )}

                      {/* Risk Score */}
                      {invoice.risk_score !== undefined && (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">Risk Score:</span>
                          <div className="flex items-center gap-2">
                            <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
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
                              'text-xs font-semibold',
                              invoice.risk_score < 30 ? 'text-emerald-600' :
                              invoice.risk_score < 70 ? 'text-amber-600' : 'text-red-600'
                            )}>
                              {invoice.risk_score}% — {invoice.risk_score < 30 ? 'Low' : invoice.risk_score < 70 ? 'Medium' : 'High'} Risk
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    {!isDone && (
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleApprove(invoice)}
                          disabled={isLoading}
                          className="btn-success min-w-32 justify-center"
                        >
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                          Approve
                        </button>
                        <button
                          onClick={() => setRejectModal({ invoice })}
                          disabled={isLoading}
                          className="btn-danger min-w-32 justify-center"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                        <button
                          onClick={() => setClarModal({ invoice })}
                          disabled={isLoading}
                          className="btn-warning min-w-32 justify-center"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Clarify
                        </button>
                      </div>
                    )}

                    {isDone && processedAction && (
                      <div className={clsx(
                        'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium flex-shrink-0',
                        processedAction.type === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                        processedAction.type === 'rejected' ? 'bg-red-50 border-red-200 text-red-700' :
                        'bg-amber-50 border-amber-200 text-amber-700'
                      )}>
                        {processedAction.type === 'approved' && <CheckCircle className="w-4 h-4" />}
                        {processedAction.type === 'rejected' && <XCircle className="w-4 h-4" />}
                        {processedAction.type === 'clarification' && <MessageSquare className="w-4 h-4" />}
                        {processedAction.type === 'approved' ? 'Approved' :
                         processedAction.type === 'rejected' ? 'Rejected' : 'Clarification Requested'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Reject Invoice</h2>
                <p className="text-sm text-gray-500">{rejectModal.invoice.invoice_number}</p>
              </div>
              <button onClick={() => setRejectModal(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explain why this invoice is being rejected..."
                  rows={4}
                  className="input resize-none"
                />
              </div>
              <p className="text-xs text-gray-400">
                A rejection email will be automatically sent to {rejectModal.invoice.vendor}.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setRejectModal(null)}
                  className="btn-secondary flex-1 justify-center"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectReason.trim()}
                  className={clsx('btn-danger flex-1 justify-center', !rejectReason.trim() && 'opacity-50 cursor-not-allowed')}
                >
                  <XCircle className="w-4 h-4" />
                  Reject Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clarification Modal */}
      {clarModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Request Clarification</h2>
                <p className="text-sm text-gray-500">{clarModal.invoice.invoice_number}</p>
              </div>
              <button onClick={() => setClarModal(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Clarification Note <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={clarNote}
                  onChange={(e) => setClarNote(e.target.value)}
                  placeholder="What information do you need from the vendor?"
                  rows={4}
                  className="input resize-none"
                />
              </div>
              <p className="text-xs text-gray-400">
                An email will be sent to {clarModal.invoice.vendor} requesting clarification.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setClarModal(null)} className="btn-secondary flex-1 justify-center">
                  Cancel
                </button>
                <button
                  onClick={handleClarification}
                  disabled={!clarNote.trim()}
                  className={clsx('btn-warning flex-1 justify-center', !clarNote.trim() && 'opacity-50 cursor-not-allowed')}
                >
                  <MessageSquare className="w-4 h-4" />
                  Send Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
