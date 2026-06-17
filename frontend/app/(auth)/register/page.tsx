'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Check } from 'lucide-react'
import { useAuthStore } from '@/lib/store'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const { register } = useAuthStore()
  const router = useRouter()

  const pwStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3
  const pwColors = ['', 'bg-red-500', 'bg-amber-500', 'bg-brand-500']
  const pwLabels = ['', 'Weak', 'Fair', 'Strong']

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      await register(email, password, name)
      router.push('/dashboard')
      toast.success('Welcome to StockSentinel!')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <div className="mb-6">
        <h1 className="text-xl font-bold mb-1">Create your account</h1>
        <p className="text-gray-500 text-sm">Start tracking your portfolio in minutes</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="stat-label block mb-1.5">Full Name</label>
          <div className="relative">
            <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input className="input pl-10" value={name} onChange={e => setName(e.target.value)} placeholder="Arjun Sharma" required />
          </div>
        </div>

        <div>
          <label className="stat-label block mb-1.5">Email</label>
          <div className="relative">
            <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input className="input pl-10" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
          </div>
        </div>

        <div>
          <label className="stat-label block mb-1.5">Password</label>
          <div className="relative">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input className="input pl-10 pr-10" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters" required autoComplete="new-password" />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {password.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 flex gap-1">
                {[1,2,3].map(i => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= pwStrength ? pwColors[pwStrength] : 'bg-surface-border'}`} />
                ))}
              </div>
              <span className={`text-xs font-medium ${pwStrength === 1 ? 'text-red-400' : pwStrength === 2 ? 'text-amber-400' : 'text-brand-400'}`}>
                {pwLabels[pwStrength]}
              </span>
            </div>
          )}
        </div>

        <button className="btn-primary w-full flex items-center justify-center gap-2 mt-2" type="submit" disabled={loading}>
          {loading ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>Get Started <ArrowRight size={16} /></>
          )}
        </button>
      </form>

      <div className="divider my-5" />
      <p className="text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">Sign in</Link>
      </p>
    </div>
  )
}
