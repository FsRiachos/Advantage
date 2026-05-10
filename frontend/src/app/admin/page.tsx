'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ShieldCheck, LogOut, Share2, AlertCircle, X, CheckCircle, XCircle, Trash2, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminDashboard() {
  const [athletes, setAthletes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // NEW: State holds the entire array of payments for that specific month
  const [selectedMonthData, setSelectedMonthData] = useState<any>(null);
  
  const router = useRouter();

  const currentYear = new Date().getFullYear();
  const currentMonthIndex = new Date().getMonth();
  const monthInitials = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const fullMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) router.push('/login');
    else fetchAdminData();
  };

  const fetchAdminData = async () => {
    // NEW: Added reject_reason and transaction_ref to the query
    const { data } = await supabase
      .from('athletes')
      .select('*, payments(id, status, created_at, amount_detected, billing_month, image_url, reject_reason, transaction_ref)')
      .order('name');
      
    setAthletes(data || []);
    setLoading(false);
  };

  const copyLink = (token: string) => {
    const link = `${window.location.origin}/?token=${token}`;
    navigator.clipboard.writeText(link);
    alert('Private link copied to clipboard!');
  };

  const updateFee = async (id: string, newFee: string) => {
    await supabase.from('athletes').update({ monthly_fee: parseFloat(newFee) }).eq('id', id);
    fetchAdminData();
  };

  const handleOverrideStatus = async (paymentId: string, newStatus: string) => {
    await supabase.from('payments').update({ status: newStatus }).eq('id', paymentId);
    setSelectedMonthData(null); // Close modal to refresh data cleanly
    fetchAdminData();
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!window.confirm("Are you sure you want to completely delete this payment record?")) return;
    await supabase.from('payments').delete().eq('id', paymentId);
    setSelectedMonthData(null); // Close modal to refresh data cleanly
    fetchAdminData();
  };

  useEffect(() => { checkUser(); }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] text-slate-400 font-bold animate-pulse">Authenticating Admin...</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 relative">
      
      {/* NEW: Scrollable Payment Inspection Modal */}
      {selectedMonthData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
              <div>
                <h3 className="text-xl font-black text-slate-900">{selectedMonthData.athleteName}</h3>
                <p className="text-sm font-bold text-slate-500">
                  {selectedMonthData.monthName} {currentYear} &middot; {selectedMonthData.payments.length} Upload Attempt(s)
                </p>
              </div>
              <button onClick={() => setSelectedMonthData(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body - Scrollable list of all attempts */}
            <div className="overflow-y-auto p-6 flex-1 bg-white">
              {selectedMonthData.payments.map((payment: any, index: number) => (
                <div key={payment.id} className="mb-8 last:mb-0 pb-8 last:pb-0 border-b border-slate-100 last:border-0 grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                  
                  {/* Attempt Number Badge */}
                  <div className="absolute -top-3 -left-3 bg-slate-800 text-white text-[10px] font-black px-2 py-1 rounded-lg z-10 shadow-sm">
                    ATTEMPT {selectedMonthData.payments.length - index}
                  </div>

                  <div className="bg-slate-100 rounded-2xl h-64 flex items-center justify-center overflow-hidden relative group border border-slate-200">
                    {payment.image_url ? (
                      <>
                        <img src={payment.image_url} alt="Receipt" className="object-contain w-full h-full" />
                        <a href={payment.image_url} target="_blank" rel="noreferrer" className="absolute bottom-4 right-4 bg-white/90 p-2 rounded-lg shadow opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-xs font-bold text-slate-700">
                          <ExternalLink className="w-4 h-4" /> Open Full
                        </a>
                      </>
                    ) : (
                      <span className="text-slate-400 font-bold">No Image Available</span>
                    )}
                  </div>
                  
                  <div className="flex flex-col justify-center space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${payment.status === 'verified' ? 'bg-emerald-100 text-emerald-700' : payment.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                          {payment.status}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Detected</p>
                        <p className="text-2xl font-black text-slate-900">
                          {payment.amount_detected ? `€${payment.amount_detected}` : '—'}
                        </p>
                      </div>
                    </div>

                    {payment.reject_reason && (
                      <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl">
                         <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">AI Reason</p>
                         <p className="text-xs text-rose-700 font-medium">{payment.reject_reason}</p>
                      </div>
                    )}
                    
                    {payment.transaction_ref && payment.transaction_ref !== 'UNKNOWN' && (
                       <p className="text-[10px] font-bold text-slate-400"><span className="uppercase tracking-widest">Fingerprint:</span> {payment.transaction_ref}</p>
                    )}

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex gap-2">
                        <button onClick={() => handleOverrideStatus(payment.id, 'verified')} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl transition-colors text-xs">
                          <CheckCircle className="w-4 h-4" /> Verify
                        </button>
                        <button onClick={() => handleOverrideStatus(payment.id, 'rejected')} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl transition-colors text-xs">
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                      </div>
                      <button onClick={() => handleDeletePayment(payment.id)} className="w-full flex items-center justify-center gap-2 py-2 px-4 text-slate-400 hover:text-rose-600 font-bold rounded-xl transition-colors mt-2 text-xs">
                        <Trash2 className="w-4 h-4" /> Delete Record
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Dashboard Content */}
      <div className="max-w-7xl mx-auto px-6 pt-12">
        <header className="flex flex-col md:flex-row justify-between md:items-end mb-12 gap-6">
          <div>
            <h1 className="text-4xl font-black text-slate-900 flex items-center gap-3">
              <ShieldCheck className="text-indigo-600 w-10 h-10" /> Admin Control
            </h1>
            <p className="text-slate-500 font-medium mt-2">Financial overview for {currentYear}</p>
          </div>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="flex items-center gap-2 text-slate-400 font-bold hover:text-rose-500 transition-colors">
            <LogOut className="w-5 h-5" /> Logout
          </button>
        </header>

        <div className="space-y-4">
          {athletes.map((a) => {
            let overdueCount = 0;
            const monthStatuses = monthInitials.map((initial, index) => {
              const billingMonthStr = `${currentYear}-${String(index + 1).padStart(2, '0')}`;
              
              // NEW: Get an array of ALL payments for this specific month
              const monthPayments = a.payments?.filter((p: any) => {
                if (p.billing_month) return p.billing_month === billingMonthStr;
                return new Date(p.created_at).getMonth() === index && new Date(p.created_at).getFullYear() === currentYear;
              }) || [];

              // Sort newest first
              monthPayments.sort((p1: any, p2: any) => new Date(p2.created_at).getTime() - new Date(p1.created_at).getTime());

              let status = 'future';
              let bgColor = 'bg-slate-100 text-slate-400';
              let ring = '';

              // Determine the color of the square based on the best/newest status
              if (monthPayments.some((p: any) => p.status === 'verified')) {
                status = 'paid';
                bgColor = 'bg-emerald-500 text-white shadow-sm shadow-emerald-200';
              } else if (monthPayments.some((p: any) => p.status === 'pending' || p.status === 'processing')) {
                status = 'pending';
                bgColor = 'bg-amber-400 text-white animate-pulse';
              } else if (monthPayments.some((p: any) => p.status === 'rejected')) {
                status = 'rejected';
                bgColor = 'bg-rose-600 text-white shadow-sm shadow-rose-200';
              } else if (index < currentMonthIndex) {
                status = 'missing';
                bgColor = 'bg-rose-400 text-white shadow-sm shadow-rose-200';
                overdueCount++;
              } else if (index === currentMonthIndex) {
                status = 'current';
                bgColor = 'bg-slate-200 text-slate-500';
                ring = 'ring-2 ring-indigo-400 ring-offset-2';
              }

              return { initial, name: fullMonths[index], status, bgColor, ring, paymentsArray: monthPayments };
            });

            return (
              <div key={a.id} className="payment-card flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 border-l-4 hover:border-l-indigo-500 transition-colors" style={{ borderLeftColor: overdueCount > 0 ? '#fb7185' : '#10b981' }}>
                
                <div className="flex items-center gap-4 w-full xl:w-1/4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center font-black text-indigo-600 text-xl flex-shrink-0">
                    {a.name[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 truncate">{a.name}</h3>
                    {overdueCount > 0 ? (
                      <p className="text-xs font-bold text-rose-500 flex items-center gap-1 mt-0.5">
                        <AlertCircle className="w-3 h-3" /> {overdueCount} {overdueCount === 1 ? 'month' : 'months'} overdue
                      </p>
                    ) : (
                      <p className="text-xs font-bold text-emerald-500 mt-0.5">Up to date</p>
                    )}
                  </div>
                </div>

                <div className="flex-1 flex flex-col items-start xl:items-center justify-center w-full overflow-x-auto py-2">
                  <div className="flex gap-1.5 sm:gap-2">
                    {monthStatuses.map((m, i) => (
                      <div 
                        key={i} 
                        // OPEN MODAL with the whole array of payments
                        onClick={() => m.paymentsArray.length > 0 ? setSelectedMonthData({ athleteName: a.name, monthName: m.name, payments: m.paymentsArray }) : null}
                        title={`${m.name}: ${m.status.toUpperCase()}${m.paymentsArray.length > 0 ? ` (${m.paymentsArray.length} uploads)` : ''}`}
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold transition-all 
                          ${m.bgColor} ${m.ring} 
                          ${m.paymentsArray.length > 0 ? 'cursor-pointer hover:scale-110 ring-2 ring-transparent hover:ring-indigo-300 ring-offset-1' : 'cursor-default'}`}
                      >
                        {m.initial}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between w-full xl:w-auto gap-8 pt-4 xl:pt-0 border-t border-slate-100 xl:border-none">
                  <div className="text-left xl:text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Monthly Fee</p>
                    <div className="flex items-center">
                      <span className="text-xl font-black text-slate-900 mr-1">€</span>
                      <input 
                        type="number" 
                        defaultValue={a.monthly_fee} 
                        onBlur={(e) => updateFee(a.id, e.target.value)}
                        className="text-xl font-black text-slate-900 w-16 sm:w-20 bg-transparent border-b border-dashed border-slate-300 focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                  <button onClick={() => copyLink(a.secret_token)} className="btn-primary py-2.5 px-4 text-xs whitespace-nowrap shadow-md">
                    <Share2 className="w-4 h-4" /> Copy Link
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}