'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Upload, CheckCircle2, XCircle, Loader2, Hourglass, CalendarDays, Trophy, AlertCircle, AlertTriangle } from 'lucide-react';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Home() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [athlete, setAthlete] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  
  const currentYear = new Date().getFullYear();
  const currentMonthIndex = new Date().getMonth();
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(currentMonthIndex);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const loadPrivateData = async () => {
    if (!token) {
      setError('Invalid Access: Please use your private club link.');
      return;
    }

    const { data: athleteData, error: aError } = await supabase
      .from('athletes')
      .select('*')
      .eq('secret_token', token)
      .single();

    if (aError || !athleteData) {
      setError('Access Denied: This link is no longer valid.');
      return;
    }
    setAthlete(athleteData);

    // IMPORTANT: Changed to descending so we always evaluate their most recent upload attempt
    const { data: payData } = await supabase
      .from('payments')
      .select('*')
      .eq('athlete_id', athleteData.id)
      .order('created_at', { ascending: false });

    setPayments(payData || []);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !athlete || selectedMonthIndex === null) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${athlete.id}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('Receipts').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('Receipts').getPublicUrl(fileName);

      const billingMonthStr = `${currentYear}-${String(selectedMonthIndex + 1).padStart(2, '0')}`;

      const { data: paymentData } = await supabase
        .from('payments')
        .insert({ 
          athlete_id: athlete.id, 
          image_url: publicUrl, 
          status: 'pending',
          billing_month: billingMonthStr 
        })
        .select().single();

      await supabase.functions.invoke('verify-payment', {
        body: { imageUrl: publicUrl, paymentId: paymentData.id }
      });

      setTimeout(() => loadPrivateData(), 3000);
    } catch (err) {
      alert('Upload failed. Check your connection.');
    } finally {
      setUploading(false);
    }

    event.target.value = '';

  };

  useEffect(() => { loadPrivateData(); }, [token]);

  if (error) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-400">{error}</div>;
  if (!athlete) return <div className="min-h-screen flex items-center justify-center animate-pulse">Loading Secure Portal...</div>;

  // Find the currently selected payment to display dynamic feedback
  const selectedBillingMonthStr = selectedMonthIndex !== null ? `${currentYear}-${String(selectedMonthIndex + 1).padStart(2, '0')}` : null;
  const selectedPaymentInfo = selectedMonthIndex !== null ? payments.find(p => {
    if (p.billing_month) return p.billing_month === selectedBillingMonthStr;
    return new Date(p.created_at).getMonth() === selectedMonthIndex && new Date(p.created_at).getFullYear() === currentYear;
  }) : null;

  return (
    <div className="min-h-screen pb-20">
      <div className="fixed top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-indigo-100/50 to-transparent -z-20" />
      
      <div className="max-w-6xl mx-auto px-6 pt-12">
        <header className="mb-12 flex flex-col-reverse sm:flex-row justify-between items-start sm:items-center gap-6">
          
          {/* Left Side: Greeting */}
          <div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">
              HELLO, {athlete.name.split(' ')[0].toUpperCase()}<span className="text-indigo-600">.</span>
            </h1>
            <p className="text-slate-500 font-medium mt-1">Your monthly club fee is <span className="text-indigo-600 font-bold">€{athlete.monthly_fee}</span></p>
          </div>

          {/* Right Side: Club Logo & Name */}
          <div className="flex items-center gap-4 bg-white/40 px-4 py-2.5 rounded-2xl border border-slate-200/60 shadow-sm backdrop-blur-sm">
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Official Portal</p>
              <p className="text-base md:text-xl font-black text-slate-900 tracking-tight leading-none">
                Clube Ténis da Golegã
              </p>
            </div>
            <img 
              src="/ctg.jpeg" 
              alt="Clube Ténis da Golegã" 
              className="w-12 h-12 md:w-16 md:h-16 object-cover rounded-xl shadow-sm border border-slate-200" 
            />
          </div>

        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Calendar Feed */}
          <div className="lg:col-span-8 space-y-6">
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 mb-6">
              <CalendarDays className="w-6 h-6 text-indigo-600" /> {currentYear} Billing Cycle
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {months.map((monthName, index) => {
                const billingMonthStr = `${currentYear}-${String(index + 1).padStart(2, '0')}`;
                
                const paymentForMonth = payments.find(p => {
                  if (p.billing_month) return p.billing_month === billingMonthStr;
                  return new Date(p.created_at).getMonth() === index && new Date(p.created_at).getFullYear() === currentYear;
                });

                const isFuture = index > currentMonthIndex;
                const isSelected = selectedMonthIndex === index;
                
                const isPaid = paymentForMonth?.status === 'verified';
                const isPending = paymentForMonth?.status === 'pending' || paymentForMonth?.status === 'processing';
                const isRejected = paymentForMonth?.status === 'rejected';
                
                // Allow selection if it's not a future month
                const canSelect = !isFuture;

                return (
                  <div 
                    key={monthName} 
                    onClick={() => canSelect && setSelectedMonthIndex(index)}
                    className={`relative p-5 rounded-2xl border transition-all duration-200 
                      ${isFuture ? 'bg-slate-50/50 border-slate-100 opacity-60' : 'bg-white shadow-sm'}
                      ${canSelect ? 'cursor-pointer hover:border-indigo-300 hover:shadow-md' : 'cursor-default'}
                      ${isSelected ? 'ring-2 ring-indigo-600 border-indigo-600 scale-[1.02]' : 'border-slate-200/60'}
                    `}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <p className={`text-sm font-bold ${isSelected ? 'text-indigo-600' : 'text-slate-500'}`}>{monthName}</p>
                      {isPending && <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded">Pending</span>}
                      {isRejected && <span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest bg-rose-50 px-2 py-0.5 rounded">Rejected</span>}
                    </div>
                    
                    <div className="flex items-center justify-center h-12">
                      {isPaid && <CheckCircle2 className="w-10 h-10 text-emerald-500" />}
                      {isPending && <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />}
                      {(!isPaid && !isPending && !isFuture) && (
                        <div className="text-center group">
                           <XCircle className={`w-8 h-8 mx-auto ${isSelected ? 'text-indigo-400' : 'text-rose-400'}`} />
                           {canSelect && !isPaid && <p className="text-[10px] font-bold text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity mt-1">Tap to pay</p>}
                        </div>
                      )}
                      {isFuture && (
                        <div className="flex flex-col items-center">
                          <Hourglass className="w-6 h-6 text-slate-300 mb-1" />
                          <span className="text-[10px] font-bold text-slate-400">€{athlete.monthly_fee}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dynamic Action Panel */}
          <div className="lg:col-span-4">
            <div className={`glass-panel rounded-3xl p-8 sticky top-12 border transition-all duration-300 ${selectedMonthIndex !== null ? 'border-indigo-200 shadow-xl shadow-indigo-500/10' : 'border-slate-200 opacity-70'}`}>
              
              {selectedMonthIndex === null ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="font-bold text-slate-900 mb-2">Select a Month</h3>
                  <p className="text-sm text-slate-500">Tap a month on the calendar to view status or upload a receipt.</p>
                </div>
              ) : selectedPaymentInfo?.status === 'verified' ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Payment Verified</h3>
                  <p className="text-sm font-medium text-slate-500 mb-6">
                    Your club fee for <strong className="text-slate-900">{months[selectedMonthIndex]} {currentYear}</strong> is paid and confirmed. Thank you!
                  </p>
                </div>
              ) : selectedPaymentInfo?.status === 'pending' || selectedPaymentInfo?.status === 'processing' ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Verifying Payment...</h3>
                  <p className="text-sm font-medium text-slate-500 mb-6">
                    Our AI is currently analyzing your receipt for <strong className="text-slate-900">{months[selectedMonthIndex]} {currentYear}</strong>. This usually takes about 10 seconds.
                  </p>
                  <button onClick={loadPrivateData} className="text-xs font-bold text-indigo-600 hover:text-indigo-800">Refresh Status</button>
                </div>
              ) : (
                // Show Upload Form (Handles both "No Payment" and "Rejected" states)
                <>
                  {selectedPaymentInfo?.status === 'rejected' && (
                    <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-bold text-rose-800">Payment Rejected</h4>
                          <p className="text-xs text-rose-600 mt-1">{selectedPaymentInfo.reject_reason || "The uploaded receipt was not accepted."}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <h2 className="text-xl font-bold mb-2 flex items-center gap-3 text-slate-900">
                    <Upload className="w-5 h-5 text-indigo-600" /> Submit Receipt
                  </h2>
                  <p className="text-sm font-medium text-slate-500 mb-6">
                    Uploading payment for <strong className="text-indigo-600">{months[selectedMonthIndex]} {currentYear}</strong>
                  </p>
                  
                  <label className="group flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-indigo-200 bg-indigo-50/30 rounded-2xl cursor-pointer hover:bg-indigo-50 transition-all">
                    <div className="text-center p-4">
                      <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6 text-indigo-600" />
                      </div>
                      <p className="text-xs font-bold text-indigo-600">Select receipt image</p>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={uploading} />
                  </label>
                  
                  {uploading && (
                    <div className="mt-4 bg-indigo-600 text-white rounded-xl p-4 flex items-center justify-center gap-3 shadow-lg shadow-indigo-200">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm font-bold">AI Analyzing...</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

        </div>
        <footer className="mt-16 pt-8 pb-4 border-t border-slate-200/60">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[10px] text-slate-400 font-medium max-w-2xl text-center md:text-left leading-relaxed">
              <strong>Privacy Notice (GDPR):</strong> Uploaded receipts are processed securely by AI solely for the purpose of verifying monthly club fees. Your financial data is never used for advertising. You retain the right to request the deletion of your data and images at any time by contacting your club administrator.
            </p>
            <div className="flex items-center gap-3 text-[10px] text-slate-300 font-bold uppercase tracking-widest whitespace-nowrap">
              <span>Secure Portal</span>
              <span>&middot;</span>
              <span>AI Verified</span>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}