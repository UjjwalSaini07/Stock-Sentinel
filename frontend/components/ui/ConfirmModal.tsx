'use client'
import React from 'react'
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'info' | 'success'
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'info'
}: ConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      {/* Glassmorphic Container Card */}
      <div 
        className={`relative overflow-hidden w-full max-w-sm rounded-2xl bg-black/85 backdrop-blur-2xl border border-white/[0.08] p-6 text-center space-y-5 transition-all duration-300 ${
          type === 'danger' ? 'shadow-[0_0_50px_rgba(239,68,68,0.08)]' :
          type === 'success' ? 'shadow-[0_0_50px_rgba(38,163,102,0.08)]' :
          'shadow-[0_0_50px_rgba(59,130,246,0.08)]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Sphere in background */}
        <div className={`absolute -top-12 left-1/2 -translate-x-1/2 w-[160px] h-[160px] blur-[60px] pointer-events-none rounded-full ${
          type === 'danger' ? 'bg-red-500/10' :
          type === 'success' ? 'bg-brand-500/10' :
          'bg-blue-500/10'
        }`} />

        {/* Circular Glowing Icon Badge */}
        <div className={`mx-auto p-4 rounded-full border w-fit flex items-center justify-center relative ${
          type === 'danger' ? 'bg-red-500/10 border-red-500/25 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.1)]' :
          type === 'success' ? 'bg-brand-500/10 border-brand-500/25 text-brand-400 shadow-[0_0_20px_rgba(38,163,102,0.1)]' :
          'bg-blue-500/10 border-blue-500/25 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.1)]'
        }`}>
          {type === 'danger' ? <AlertTriangle size={24} className="animate-pulse" /> :
           type === 'success' ? <CheckCircle2 size={24} /> :
           <Info size={24} />}
        </div>

        {/* Text Details */}
        <div className="space-y-2 z-10 relative">
          <h3 className="text-lg font-black text-white tracking-tight uppercase">{title}</h3>
          <p className="text-xs text-gray-400 leading-relaxed font-sans px-2">{message}</p>
        </div>

        {/* Action Buttons Grid */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/5 z-10 relative">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-300 hover:text-white bg-white/[0.02] hover:bg-white/[0.06] border border-white/10 transition-all duration-150 active:scale-95"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold text-white transition-all duration-150 active:scale-95 border ${
              type === 'danger' 
                ? 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)] hover:shadow-[0_0_20px_rgba(239,68,68,0.25)]' 
                : type === 'success' 
                ? 'bg-gradient-to-r from-brand-500 to-emerald-600 hover:from-brand-600 hover:to-emerald-700 border-brand-500/30 shadow-[0_0_15px_rgba(38,163,102,0.15)]'
                : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
