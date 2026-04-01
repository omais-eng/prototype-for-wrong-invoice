'use client'

import { ValidationError } from '@/lib/api'
import { AlertCircle, AlertTriangle, Info, Lightbulb } from 'lucide-react'
import clsx from 'clsx'

interface ValidationDetailsProps {
  errors: ValidationError[]
}

const SEVERITY_CONFIG = {
  error: {
    icon: AlertCircle,
    containerClass: 'bg-red-50 border-red-200',
    iconClass: 'text-red-500',
    labelClass: 'text-red-800',
    messageClass: 'text-red-700',
    badge: 'bg-red-100 text-red-700',
  },
  warning: {
    icon: AlertTriangle,
    containerClass: 'bg-amber-50 border-amber-200',
    iconClass: 'text-amber-500',
    labelClass: 'text-amber-800',
    messageClass: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
  },
  info: {
    icon: Info,
    containerClass: 'bg-blue-50 border-blue-200',
    iconClass: 'text-blue-500',
    labelClass: 'text-blue-800',
    messageClass: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-700',
  },
}

const ERROR_CODE_LABELS: Record<string, string> = {
  PRICE_MISMATCH: 'Price Mismatch',
  PO_MISMATCH: 'PO Number Mismatch',
  DUPLICATE_INVOICE: 'Duplicate Invoice',
  MISSING_FIELD: 'Missing Field',
  TAX_CALCULATION: 'Tax Calculation Error',
  EXPIRED_CONTRACT: 'Expired Contract',
  QUANTITY_MISMATCH: 'Quantity Mismatch',
  INVALID_DATE: 'Invalid Date',
}

export default function ValidationDetails({ errors }: ValidationDetailsProps) {
  if (!errors || errors.length === 0) {
    return (
      <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-sm font-medium">No validation errors — invoice passed all checks.</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {errors.map((error, idx) => {
        const config = SEVERITY_CONFIG[error.severity] || SEVERITY_CONFIG.info
        const Icon = config.icon

        return (
          <div
            key={idx}
            className={clsx('border rounded-lg p-4', config.containerClass)}
          >
            <div className="flex items-start gap-3">
              <Icon className={clsx('w-4 h-4 mt-0.5 flex-shrink-0', config.iconClass)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', config.badge)}>
                    {ERROR_CODE_LABELS[error.code] || error.code}
                  </span>
                  <span className="text-xs text-gray-400">Field: {error.field}</span>
                </div>
                <p className={clsx('text-sm', config.messageClass)}>{error.message}</p>
                {error.suggestion && (
                  <div className="mt-2 flex items-start gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 mt-0.5 text-gray-400 flex-shrink-0" />
                    <p className="text-xs text-gray-500 italic">{error.suggestion}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
