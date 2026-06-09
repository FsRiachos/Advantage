'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Upload, CheckCircle2, XCircle, Loader2, Hourglass, CalendarDays, AlertCircle, AlertTriangle, CheckSquare, Square, Users } from 'lucide-react';
import { Analytics } from '@vercel/analytics/next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function PortalContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  // Multi-athlete support structures
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [activeMemberIdx, setActiveMemberIdx] = useState<number>(0);
  
  const [payments, setPayments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  
  const currentYear = new Date().getFullYear();
  const currentMonthIndex = new Date().getMonth();
  
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(null);
  
  // Composite keys tracked as: "athlete_id:billing_month"
  const [selectedMonthsForPayment, setSelectedMonthsForPayment] = useState<string[]>([]);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const loadPrivateData = async () => {
    if (!token) {
      setError('Invalid Access: Please use your private club link.');
      return;
    }

    const { data: initialAthlete, error: aError } = await supabase
      .from('athletes')
      .select('*')
      .eq('secret_token', token)
      .single();

    if (aError || !initialAthlete) {
      setError('Access Denied: This link is no longer valid.');
      return;
    }

    // Resolve household structures
    let membersList = [initialAthlete];
    if (initialAthlete.family_id) {
      const { data: household } = await supabase
        .from('athletes')
        .select('*')
        .eq('family_id', initialAthlete.family_id)
        .eq('is_active', true);
      if (household && household.length > 0) {
        membersList = household;
      }
    }
    
    setFamilyMembers(membersList);
    const targetIdx = membersList.findIndex(m => m.id === initialAthlete.id);
    setActiveMemberIdx(targetIdx >= 0 ? targetIdx : 0);

    // Harvest financial records for all family accounts
    const accountIds = membersList.map(m => m.id);
    const { data: payData } = await supabase
      .from('payments')
      .select('*')
      .in('athlete_id', accountIds)
      .order('created_at', { ascending: false });

    setPayments(payData || []);
  };

  const currentAthlete = familyMembers[activeMemberIdx] || null;

  const getPaymentStatusForMonthStr = (athleteId: string, monthStr: string) => {
    const payment = payments.find(p => p.athlete_id === athleteId && p.billing_month === monthStr);
    return payment ? payment.status : 'unpaid';
  };

  const handleMonthClick = (index: number) => {
    if (!currentAthlete) return;
    setSelectedMonthIndex(index);
    const clickedMonthStr = `${currentYear}-${String(index + 1).padStart(2, '0')}`;
    // Select the clicked item as default target using compound lookup structure
    setSelectedMonthsForPayment([`${currentAthlete.id}:${clickedMonthStr}`]);
  };

  const toggleMonthSelection = (compositeKey: string) => {
    setSelectedMonthsForPayment(prev => 
      prev.includes(compositeKey) 
        ? prev.filter(k => k !== compositeKey)
        : [...prev, compositeKey]
    );
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentAthlete || selectedMonthsForPayment.length === 0) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentAthlete.id}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('Receipts').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('Receipts').getPublicUrl(fileName);

      // Compute exact total weight using specific individual pricing values
      let expectedTotalAmount = 0;
      const insertedPaymentIds = [];

      for (const compositeKey of selectedMonthsForPayment) {
        const [athId, monthStr] = compositeKey.split(':');
        const targetMember = familyMembers.find(m => m.id === athId);
        if (targetMember) {
          expectedTotalAmount += targetMember.monthly_fee;
        }

        const { data: paymentData } = await supabase
          .from('payments')
          .insert({ 
            athlete_id: athId, 
            image_url: publicUrl, 
            status: 'pending',
            billing_month: monthStr 
          })
          .select().single();
          
        insertedPaymentIds.push(paymentData.id);
      }

      const { error: functionError } = await supabase.functions.invoke('verify-payment', {
        body: { 
          imageUrl: publicUrl, 
          paymentIds: insertedPaymentIds,
          expectedAmount: Number(expectedTotalAmount)
        }
      });

      if (functionError) {
        alert(`AI Error: ${functionError.message || 'Failed to process tracking parameters.'}`);
      }

      setTimeout(() => loadPrivateData(), 3000);
    } catch (err) {
      alert('Upload broken. Verify connection configuration patterns.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  useEffect(() => { loadPrivateData(); }, [token]);

  if (error) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-400">{error}</div>;
  if (!currentAthlete) return <div className="min-h-screen flex items-center justify-center animate-pulse">Loading Secure Portal Unit...</div>;

  const selectedBillingMonthStr = selectedMonthIndex !== null ? `${currentYear}-${String(selectedMonthIndex + 1).padStart(2, '0')}` : null;
  const selectedPaymentInfo = selectedMonthIndex !== null ? payments.find(p => p.athlete_id === currentAthlete.id && p.billing_month === selectedBillingMonthStr) : null;

  // Build a global list of unpaid months across ALL family members
  const availableMonthsForChecklist: any[] = [];
  familyMembers.forEach(member => {
    months.forEach((name, index) => {
      const monthStr = `${currentYear}-${String(index + 1).padStart(2, '0')}`;
      const status = getPaymentStatusForMonthStr(member.id, monthStr);
      
      if ((status === 'unpaid' || status === 'rejected') && index <= currentMonthIndex) {
        availableMonthsForChecklist.push({
          compositeKey: `${member.id}:${monthStr}`,
          displayLabel: `${member.name.split(' ')[0]} - ${name}`,
          fee: member.monthly_fee
        });
      }
    });
  });

  const calculatedTotal = selectedMonthsForPayment.reduce((sum, key) => {
    const [athId] = key.split(':');
    const member = familyMembers.find(m => m.id === athId);
    return sum + (member ? member.monthly_fee : 0);
  }, 0);

  return (
    <div className="min-h-screen pb-20">
      <div className="fixed top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-indigo-100/50 to-transparent -z-20" />
      
      <div className="max-w-6xl mx-auto px-6 pt-12">
        
        {/* Household tabs displayed when a group configuration matches */}
        {familyMembers.length > 1 && (
          <div className="flex gap-2 mb-6 bg-slate-200/60 p-1.5 rounded-2xl w-fit border border-slate-300/40 backdrop-blur-sm shadow-sm">
            {familyMembers.map((m, idx) => (
              <button
                key={m.id}
                onClick={() => { setActiveMemberIdx(idx); setSelectedMonthIndex(null); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-150
                  ${activeMemberIdx === idx ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}
                `}
              >
                <Users className="w-3.5 h-3.5" /> {m.name.split(' ')[0]}
              </button>
            ))}
          </div>
        )}

        <header className="mb-12 flex flex-col-reverse sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">
              HELLO, {currentAthlete.name.split(' ')[0].toUpperCase()}<span className="text-indigo-600">.</span>
            </h1>
            <p className="text-slate-500 font-medium mt-1">Monthly club membership fee: <span className="text-indigo-600 font-bold">€{currentAthlete.monthly_fee.toFixed(2).replace('.', ',')}</span></p>
          </div>

          <div className="flex items-center gap-4 bg-white/40 px-4 py-2.5 rounded-2xl border border-slate-200/60 shadow-sm backdrop-blur-sm">
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Official Portal</p>
              <p className="text-base md:text-xl font-black text-slate-900 tracking-tight leading-none">Clube Ténis da Golegã</p>
            </div>
            <img src="/ctg.jpeg" alt="Clube Ténis da Golegã" className="w-12 h-12 md:w-16 md:h-16 object-cover rounded-xl shadow-sm border border-slate-200" />
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-6">
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 mb-6">
              <CalendarDays className="w-6 h-6 text-indigo-600" /> {currentYear} Billing Status
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {months.map((monthName, index) => {
                const billingMonthStr = `${currentYear}-${String(index + 1).padStart(2, '0')}`;
                const paymentForMonth = payments.find(p => p.athlete_id === currentAthlete.id && p.billing_month === billingMonthStr);
                const isFuture = index > currentMonthIndex;
                const isSelected = selectedMonthIndex === index;
                const isPaid = paymentForMonth?.status === 'verified';
                const isPending = paymentForMonth?.status === 'pending' || paymentForMonth?.status === 'processing';
                const isRejected = paymentForMonth?.status === 'rejected';
                const canSelect = !isFuture;

                return (
                  <div 
                    key={monthName} 
                    onClick={() => canSelect && handleMonthClick(index)}
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
                      {(!isPaid && !isPending && !isFuture) && <XCircle className={`w-8 h-8 mx-auto ${isSelected ? 'text-indigo-400' : 'text-rose-400'}`} />}
                      {isFuture && (
                        <div className="flex flex-col items-center">
                          <Hourglass className="w-6 h-6 text-slate-300 mb-1" />
                          <span className="text-[10px] font-bold text-slate-400">€{currentAthlete.monthly_fee}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className={`glass-panel rounded-3xl p-8 sticky top-12 border transition-all duration-300 ${selectedMonthIndex !== null ? 'border-indigo-200 shadow-xl shadow-indigo-500/10' : 'border-slate-200 opacity-70'}`}>
              
              {selectedMonthIndex === null ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="font-bold text-slate-900 mb-2">Select Target Month</h3>
                  <p className="text-sm text-slate-500">Tap an active month box on the calendar viewport to initiate verification sequences.</p>
                </div>
              ) : selectedPaymentInfo?.status === 'verified' ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="w-8 h-8" /></div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Payment Verified</h3>
                  <p className="text-sm font-medium text-slate-500">The record container for <strong className="text-slate-900">{months[selectedMonthIndex]} {currentYear}</strong> has resolved successfully.</p>
                </div>
              ) : selectedPaymentInfo?.status === 'pending' || selectedPaymentInfo?.status === 'processing' ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4"><Loader2 className="w-8 h-8 animate-spin" /></div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Verifying...</h3>
                  <p className="text-sm font-medium text-slate-500 mb-6">Our AI engine is currently scanning the structural elements of your uploaded asset.</p>
                  <button onClick={loadPrivateData} className="text-xs font-bold text-indigo-600">Refresh Interface Status</button>
                </div>
              ) : (
                <>
                  {selectedPaymentInfo?.status === 'rejected' && (
                    <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-bold text-rose-800">Verification Rejected</h4>
                          <p className="text-xs text-rose-600 mt-1">{selectedPaymentInfo.reject_reason}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <h2 className="text-xl font-bold mb-4 flex items-center gap-3 text-slate-900">
                    <Upload className="w-5 h-5 text-indigo-600" /> Submit Asset
                  </h2>
                  
                  {availableMonthsForChecklist.length > 0 && (
                    <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Group outstanding items:</p>
                      <div className="space-y-2 mb-4 max-h-40 overflow-y-auto pr-1">
                        {availableMonthsForChecklist.map(m => (
                          <div 
                            key={m.compositeKey} 
                            onClick={() => toggleMonthSelection(m.compositeKey)}
                            className="flex items-center gap-3 cursor-pointer group"
                          >
                            {selectedMonthsForPayment.includes(m.compositeKey) 
                              ? <CheckSquare className="w-5 h-5 text-indigo-600 shadow-sm" /> 
                              : <Square className="w-5 h-5 text-slate-300 group-hover:text-indigo-400" />
                            }
                            <span className={`text-sm font-bold ${selectedMonthsForPayment.includes(m.compositeKey) ? 'text-slate-900' : 'text-slate-500'}`}>
                              {m.displayLabel}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-500">Aggregated Total:</span>
                        <span className="text-lg font-black text-indigo-600">€{calculatedTotal.toFixed(2).replace('.', ',')}</span>
                      </div>
                    </div>
                  )}
                  
                  <label className="group flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-indigo-200 bg-indigo-50/30 rounded-2xl cursor-pointer hover:bg-indigo-50 transition-all">
                    <div className="text-center px-4">
                      <Upload className="w-6 h-6 text-indigo-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                      <p className="text-xs font-bold text-indigo-600">Select receipt image</p>
                      <p className="text-[10px] text-indigo-400 mt-1 font-medium">Receipt must show exactly €{calculatedTotal.toFixed(2).replace('.', ',')}</p>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={uploading || selectedMonthsForPayment.length === 0} />
                  </label>

                  {uploading && (
                    <div className="mt-4 bg-indigo-600 text-white rounded-xl p-4 flex items-center justify-center gap-3 shadow-lg shadow-indigo-200">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm font-bold">AI Analyzing Receipt...</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <Analytics />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-bold text-slate-400 animate-pulse">Loading Secure Portal Unit...</div>}>
      <PortalContent />
    </Suspense>
  );
}