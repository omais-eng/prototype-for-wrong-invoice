'use client'

import { useState, useRef, DragEvent } from 'react'
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { uploadInvoice, Invoice, formatCurrency } from '@/lib/api'
import StatusBadge from './StatusBadge'
import ValidationDetails from './ValidationDetails'
import clsx from 'clsx'

interface InvoiceUploadProps {
  onClose: () => void
  onSuccess?: (invoice: Invoice) => void
}

type UploadState = 'idle' | 'uploading' | 'done' | 'error'

export default function InvoiceUpload({ onClose, onSuccess }: InvoiceUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<Invoice | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const ACCEPTED_TYPES = ['.pdf', '.xlsx', '.xls', '.csv', '.png', '.jpg', '.jpeg']

  function handleDrag(e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragActive(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (selected) setFile(selected)
  }

  async function handleUpload() {
    if (!file) return
    setUploadState('uploading')
    setProgress(0)

    // Simulate progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) { clearInterval(interval); return prev }
        return prev + Math.floor(Math.random() * 15 + 5)
      })
    }, 200)

    try {
      const invoice = await uploadInvoice(file)
      clearInterval(interval)
      setProgress(100)
      setResult(invoice)
      setUploadState('done')
      onSuccess?.(invoice)
    } catch (err) {
      clearInterval(interval)
      setError('Upload failed. Please try again.')
      setUploadState('error')
    }
  }

  function reset() {
    setFile(null)
    setUploadState('idle')
    setProgress(0)
    setResult(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function getFileIcon() {
    if (!file) return null
    const ext = file.name.split('.').pop()?.toLowerCase()
    const colorMap: Record<string, string> = {
      pdf: 'text-red-500',
      xlsx: 'text-green-600',
      xls: 'text-green-600',
      csv: 'text-blue-500',
      png: 'text-purple-500',
      jpg: 'text-purple-500',
      jpeg: 'text-purple-500',
    }
    return (
      <FileText className={clsx('w-8 h-8', colorMap[ext || ''] || 'text-gray-500')} />
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Upload Invoice</h2>
            <p className="text-sm text-gray-500 mt-0.5">AI validation will run automatically</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Upload Result */}
          {uploadState === 'done' && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <CheckCircle className="w-6 h-6 text-emerald-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Upload Complete</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Invoice has been processed by AI</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">{result.invoice_number}</span>
                  <StatusBadge status={result.status} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs">Vendor</p>
                    <p className="font-medium text-gray-800 mt-0.5">{result.vendor}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Amount</p>
                    <p className="font-medium text-gray-800 mt-0.5">{formatCurrency(result.amount)}</p>
                  </div>
                </div>
                {result.risk_score !== undefined && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">Risk Score</span>
                      <span className={clsx(
                        'text-xs font-semibold',
                        result.risk_score < 30 ? 'text-emerald-600' :
                        result.risk_score < 70 ? 'text-amber-600' : 'text-red-600'
                      )}>{result.risk_score}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          'h-full rounded-full transition-all',
                          result.risk_score < 30 ? 'bg-emerald-500' :
                          result.risk_score < 70 ? 'bg-amber-500' : 'bg-red-500'
                        )}
                        style={{ width: `${result.risk_score}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {result.errors && result.errors.length > 0 && (
                <ValidationDetails errors={result.errors} />
              )}

              <button onClick={reset} className="btn-secondary w-full justify-center">
                Upload Another Invoice
              </button>
            </div>
          )}

          {/* Upload Error */}
          {uploadState === 'error' && (
            <div>
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Upload Failed</p>
                  <p className="text-xs text-red-600 mt-0.5">{error}</p>
                </div>
              </div>
              <button onClick={reset} className="btn-secondary w-full justify-center">
                Try Again
              </button>
            </div>
          )}

          {/* Upload Form */}
          {(uploadState === 'idle' || uploadState === 'uploading') && (
            <>
              {/* Dropzone */}
              {!file ? (
                <div
                  className={clsx(
                    'border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer',
                    dragActive
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  )}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                      <Upload className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        Drag & drop your invoice here
                      </p>
                      <p className="text-xs text-gray-400 mt-1">or click to browse files</p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-1">
                      {ACCEPTED_TYPES.map((t) => (
                        <span key={t} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                          {t.toUpperCase().replace('.', '')}
                        </span>
                      ))}
                    </div>
                  </div>
                  <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPTED_TYPES.join(',')}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    {getFileIcon()}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    {uploadState === 'idle' && (
                      <button
                        onClick={reset}
                        className="p-1.5 hover:bg-gray-100 rounded-lg"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    )}
                  </div>

                  {/* Progress bar */}
                  {uploadState === 'uploading' && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500 flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Uploading & validating...
                        </span>
                        <span className="text-xs font-medium text-blue-600">{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-200"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button onClick={onClose} className="btn-secondary flex-1 justify-center">
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!file || uploadState === 'uploading'}
                  className={clsx(
                    'btn-primary flex-1 justify-center',
                    (!file || uploadState === 'uploading') && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {uploadState === 'uploading' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload & Validate
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
