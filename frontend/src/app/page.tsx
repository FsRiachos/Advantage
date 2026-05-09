'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Upload, CheckCircle2, XCircle, Loader2, Hourglass, CalendarDays, Sparkles, AlertCircle } from 'lucide-react';

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
  
  // New State for Interactive Calendar
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

    const { data: payData } = await supabase
      .from('payments')
      .select('*')
      .eq('athlete_id', athleteData.id)
      .order('created_at', { ascending: true });

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

      // Create the billing_month string (e.g., "2026-05")
      const billingMonthStr = `${currentYear}-${String(selectedMonthIndex + 1).padStart(2, '0')}`;

      const { data: paymentData } = await supabase
        .from('payments')
        .insert({ 
          athlete_id: athlete.id, 
          image_url: publicUrl, 
          status: 'pending',
          billing_month: billingMonthStr // <--- Now tied to the specific month!
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
  };

  useEffect(() => { loadPrivateData(); }, [token]);

  if (error) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-400">{error}</div>;
  if (!athlete) return <div className="min-h-screen flex items-center justify-center animate-pulse">Loading Secure Portal...</div>;

  return (
    <div className="min-h-screen pb-20">
      <div className="fixed top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-indigo-100/50 to-transparent -z-20" />
      
      <div className="max-w-6xl mx-auto px-6 pt-12">
        <header className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-tighter mb-4">
            <Sparkles className="w-3 h-3" /> Secure Portal
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">
            HELLO, {athlete.name.split(' ')[0].toUpperCase()}<span className="text-indigo-600">.</span>
          </h1>
          <p className="text-slate-500 font-medium mt-1">Your monthly club fee is <span className="text-indigo-600 font-bold">€{athlete.monthly_fee}</span></p>
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
                
                // Find payment using the new billing_month, fallback to created_at for older data
                const paymentForMonth = payments.find(p => {
                  if (p.billing_month) return p.billing_month === billingMonthStr;
                  return new Date(p.created_at).getMonth() === index && new Date(p.created_at).getFullYear() === currentYear;
                });

                const isFuture = index > currentMonthIndex;
                const isSelected = selectedMonthIndex === index;
                
                // Determine interactivity
                const isPaid = paymentForMonth?.status === 'verified';
                const isPending = paymentForMonth?.status === 'pending' || paymentForMonth?.status === 'processing';
                const canSelect = !isFuture && !isPaid && !isPending;

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
                    </div>
                    
                    <div className="flex items-center justify-center h-12">
                      {isPaid && <CheckCircle2 className="w-10 h-10 text-emerald-500" />}
                      {isPending && <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />}
                      {!isPaid && !isPending && !isFuture && (
                        <div className="text-center group">
                           <XCircle className={`w-8 h-8 mx-auto ${isSelected ? 'text-indigo-400' : 'text-rose-400'}`} />
                           {canSelect && <p className="text-[10px] font-bold text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity mt-1">Tap to pay</p>}
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

          {/* Dynamic Upload Form */}
          <div className="lg:col-span-4">
            <div className={`glass-panel rounded-3xl p-8 sticky top-12 border transition-all duration-300 ${selectedMonthIndex !== null ? 'border-indigo-200 shadow-xl shadow-indigo-500/10' : 'border-slate-200 opacity-70'}`}>
              
              {selectedMonthIndex !== null ? (
                <>
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
                      <span className="text-sm font-bold">AI Verifying...</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="font-bold text-slate-900 mb-2">Select a Month</h3>
                  <p className="text-sm text-slate-500">Tap an unpaid month on the calendar to upload a receipt.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}