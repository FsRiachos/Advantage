'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ShieldCheck, LogOut, Share2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminDashboard() {
  const [athletes, setAthletes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const currentYear = new Date().getFullYear();
  const currentMonthIndex = new Date().getMonth();
  const monthInitials = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const fullMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
    } else {
      fetchAdminData();
    }
  };

  const fetchAdminData = async () => {
    // IMPORTANT: Added billing_month to the select query
    const { data } = await supabase
      .from('athletes')
      .select('*, payments(id, status, created_at, amount_detected, billing_month)')
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

  useEffect(() => { 
    checkUser(); 
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] text-slate-400 font-bold animate-pulse">
        Authenticating Admin...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20">
      <div className="max-w-7xl mx-auto px-6 pt-12">
        <header className="flex flex-col md:flex-row justify-between md:items-end mb-12 gap-6">
          <div>
            <h1 className="text-4xl font-black text-slate-900 flex items-center gap-3">
              <ShieldCheck className="text-indigo-600 w-10 h-10" /> Admin Control
            </h1>
            <p className="text-slate-500 font-medium mt-2">Financial overview for {currentYear}</p>
          </div>
          <button 
            onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} 
            className="flex items-center gap-2 text-slate-400 font-bold hover:text-rose-500 transition-colors"
          >
            <LogOut className="w-5 h-5" /> Logout
          </button>
        </header>

        <div className="space-y-4">
          {athletes.map((a) => {
            // Calculate missing past months
            let overdueCount = 0;
            const monthStatuses = monthInitials.map((initial, index) => {
              const billingMonthStr = `${currentYear}-${String(index + 1).padStart(2, '0')}`;
              
              // Find payment for this specific month
              const pay = a.payments?.find((p: any) => {
                if (p.billing_month) return p.billing_month === billingMonthStr;
                return new Date(p.created_at).getMonth() === index && new Date(p.created_at).getFullYear() === currentYear;
              });

              let status = 'future';
              let bgColor = 'bg-slate-100 text-slate-400';
              let ring = '';

              if (pay?.status === 'verified') {
                status = 'paid';
                bgColor = 'bg-emerald-500 text-white';
              } else if (pay?.status === 'pending' || pay?.status === 'processing') {
                status = 'pending';
                bgColor = 'bg-amber-400 text-white animate-pulse';
              } else if (index < currentMonthIndex) {
                status = 'missing';
                bgColor = 'bg-rose-500 text-white shadow-sm shadow-rose-200';
                overdueCount++;
              } else if (index === currentMonthIndex) {
                status = 'current';
                bgColor = 'bg-slate-200 text-slate-500';
                ring = 'ring-2 ring-indigo-400 ring-offset-2';
              }

              return { initial, name: fullMonths[index], status, bgColor, ring };
            });

            return (
              <div key={a.id} className="payment-card flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 border-l-4 hover:border-l-indigo-500 transition-colors" style={{ borderLeftColor: overdueCount > 0 ? '#f43f5e' : '#10b981' }}>
                
                {/* 1. Athlete Identity */}
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

                {/* 2. Mini Calendar Grid */}
                <div className="flex-1 flex flex-col items-start xl:items-center justify-center w-full overflow-x-auto py-2">
                  <div className="flex gap-1.5 sm:gap-2">
                    {monthStatuses.map((m, i) => (
                      <div 
                        key={i} 
                        title={`${m.name}: ${m.status.toUpperCase()}`}
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold cursor-help transition-transform hover:scale-110 ${m.bgColor} ${m.ring}`}
                      >
                        {m.initial}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Controls (Fee & Link) */}
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