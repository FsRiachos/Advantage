'use client';

import React, { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Upload, CheckCircle, XCircle, Clock, Receipt, Users, TrendingUp, Sparkles } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Payment {
  id: string
  athlete_id: string
  image_url: string
  amount_detected: number | null
  status: 'pending' | 'verified' | 'rejected' | 'processing'
  created_at: string
}

interface Athlete {
  id: string
  name: string
  monthly_fee: number
}

export default function Home() {
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [selectedAthlete, setSelectedAthlete] = useState('')
  const [uploading, setUploading] = useState(false)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !selectedAthlete) return

    setUploading(true)

    try {
      // Upload image to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('Receipts')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('Receipts')
        .getPublicUrl(fileName)

      // Create payment record
      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .insert({
          athlete_id: selectedAthlete,
          image_url: publicUrl,
          status: 'pending'
        })
        .select()
        .single()

      if (paymentError) throw paymentError

      // Call Edge Function to verify payment
      const { data: functionData, error: functionError } = await supabase.functions
        .invoke('verify-payment', {
          body: {
            imageUrl: publicUrl,
            paymentId: paymentData.id
          }
        })

      if (functionError) throw functionError

      // Refresh payments list
      fetchPayments()
      
    } catch (error) {
      console.error('Error uploading payment:', error)
      alert('Error uploading payment. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const fetchAthletes = async () => {
    const { data, error } = await supabase
      .from('athletes')
      .select('*')
      .order('name')

    if (error) console.error('Error fetching athletes:', error)
    else setAthletes(data || [])
  }

  const fetchPayments = async () => {
    const { data, error } = await supabase
      .from('payments')
      .select('*, athletes(name)')
      .order('created_at', { ascending: false })

    if (error) console.error('Error fetching payments:', error)
    else setPayments(data || [])
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'processing':
        return <Clock className="w-5 h-5 text-yellow-500" />
      default:
        return <Clock className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    return `status-${status}`
  }

  // Load data on mount
  React.useEffect(() => {
    fetchAthletes()
    fetchPayments()
  }, [])

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Modern Header */}
        <div className="page-header mb-8 fade-in-up">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <h1 className="text-4xl md:text-5xl font-bold mb-2 flex items-center justify-center md:justify-start gap-3">
                <Receipt className="w-10 h-10" />
                Payment Verification
              </h1>
              <p className="text-indigo-100 text-lg">AI-powered payment processing for athletes</p>
            </div>
            <div className="flex items-center gap-8">
              <div className="text-center">
                <div className="text-3xl font-bold">{payments.filter(p => p.status === 'verified').length}</div>
                <div className="text-indigo-100 text-sm">Verified</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">{payments.filter(p => p.status === 'pending').length}</div>
                <div className="text-indigo-100 text-sm">Pending</div>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="section-container mb-8 fade-in-up">
          <div className="flex items-center justify-center md:justify-start gap-3 mb-6">
            <div className="p-3 bg-indigo-100 rounded-xl">
              <Upload className="w-6 h-6 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 text-center md:text-left">Upload Payment Receipt</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 max-w-4xl mx-auto">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3 flex items-center justify-center md:justify-start gap-2">
                <Users className="w-4 h-4" />
                Select Athlete
              </label>
              <select
                value={selectedAthlete}
                onChange={(e) => setSelectedAthlete(e.target.value)}
                className="modern-select w-full"
              >
                <option value="">Choose an athlete...</option>
                {athletes.map((athlete) => (
                  <option key={athlete.id} value={athlete.id}>
                    {athlete.name} - ${athlete.monthly_fee.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3 flex items-center justify-center md:justify-start gap-2">
                <Receipt className="w-4 h-4" />
                Upload Receipt Image
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={!selectedAthlete || uploading}
                  className="modern-input file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed w-full"
                />
                {!selectedAthlete && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-xl flex items-center justify-center pointer-events-none">
                    <p className="text-slate-500 text-sm text-center px-4">Select an athlete first</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {uploading && (
            <div className="flex items-center justify-center p-6 bg-indigo-50 rounded-xl border border-indigo-200">
              <Upload className="loading-spinner mr-3" />
              <span className="text-indigo-700 font-medium text-center">Processing payment with AI...</span>
            </div>
          )}
        </div>

        {/* Payments List */}
        <div className="section-container fade-in-up">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
            <div className="flex items-center justify-center md:justify-start gap-3">
              <div className="p-3 bg-emerald-100 rounded-xl">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 text-center md:text-left">Recent Payments</h2>
            </div>
            <div className="flex items-center justify-center md:justify-end gap-2 text-sm text-slate-600">
              <Sparkles className="w-4 h-4" />
              AI-Processed
            </div>
          </div>
          
          {payments.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Receipt className="w-10 h-10 text-slate-400" />
              </div>
              <p className="text-slate-500 text-lg font-medium">No payments found</p>
              <p className="text-slate-400 text-sm mt-1">Upload your first payment receipt to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 justify-items-center">
              {payments.map((payment) => (
                <div key={payment.id} className="payment-card w-full max-w-sm">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${
                        payment.status === 'verified' ? 'bg-emerald-100' :
                        payment.status === 'rejected' ? 'bg-rose-100' :
                        payment.status === 'processing' ? 'bg-blue-100' :
                        'bg-amber-100'
                      }`}>
                        {getStatusIcon(payment.status)}
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-slate-800">
                          {(payment as any).athletes?.name || 'Unknown Athlete'}
                        </p>
                        <p className="text-sm text-slate-500">
                          {new Date(payment.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mb-4">
                    <span className={`status-${payment.status}`}>
                      {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                    </span>
                    {payment.amount_detected && (
                      <div className="text-right">
                        <p className="text-2xl font-bold text-slate-800">
                          ${payment.amount_detected.toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-500">Detected</p>
                      </div>
                    )}
                  </div>
                  
                  {payment.image_url && (
                    <div className="relative group">
                      <img
                        src={payment.image_url}
                        alt="Payment receipt"
                        className="image-preview w-full h-32 object-cover"
                        onClick={() => window.open(payment.image_url, '_blank')}
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-xl flex items-center justify-center cursor-pointer" onClick={() => window.open(payment.image_url, '_blank')}>
                        <p className="text-white text-sm font-medium text-center px-4">View Full Size</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
