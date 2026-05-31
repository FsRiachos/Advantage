'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  ShieldCheck, LogOut, Share2, AlertCircle, X, CheckCircle, 
  XCircle, Trash2, ExternalLink, UserPlus, FileText, Plus, Upload, Loader2, Mail 
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Analytics } from "@vercel/analytics/next"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminDashboard() {
  const [athletes, setAthletes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonthData, setSelectedMonthData] = useState<any>(null);
  
  // State for Add Athlete Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState<'manual' | 'csv'>('manual');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newFee, setNewFee] = useState('30');
  const [isProcessing, setIsProcessing] = useState(false);

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
    const { data } = await supabase
      .from('athletes')
      .select('*, payments(id, status, created_at, amount_detected, billing_month, image_url, reject_reason, transaction_ref)')
      .order('name');
    setAthletes(data || []);
    setLoading(false);
  };

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) return;
    setIsProcessing(true);

    const { error } = await supabase.from('athletes').insert({
      name: newName,
      email: newEmail,
      monthly_fee: parseFloat(newFee),
      secret_token: crypto.randomUUID()
    });

    if (error) alert(error.message);
    else {
      setNewName('');
      setNewEmail('');
      setIsAddModalOpen(false);
      fetchAdminData();
    }
    setIsProcessing(false);
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim() !== '');
      
      const newAthletes = lines.map(line => {
        const [name, email, fee] = line.split(',');
        return {
          name: name?.trim(),
          email: email?.trim(),
          monthly_fee: parseFloat(fee) || 30,
          secret_token: crypto.randomUUID()
        };
      });

      const { error } = await supabase.from('athletes').insert(newAthletes);
      if (error) alert(error.message);
      else {
        setIsAddModalOpen(false);
        fetchAdminData();
      }
      setIsProcessing(false);
    };
    reader.readAsText(file);
  };

  const copyLink = (token: string) => {
    const link = `${window.location.origin}/?token=${token}`;
    navigator.clipboard.writeText(link);
    alert('Private link copied to clipboard!');
  };

  const exportLinksCsv = () => {
    // Uses your live production domain automatically
    const baseUrl = window.location.origin; 
    
    // Define columns
    const headers = ['Name', 'Email', 'Portal Link'];
    
    // Map athletes to matching rows
    const rows = athletes.map(a => [
      `"${a.name.replace(/"/g, '""')}"`, // Escape quotes just in case
      `"${a.email || ''}"`,
      `"${baseUrl}/?token=${a.secret_token}"`
    ]);
    
    // Combine headers and rows with a proper UTF-8 BOM so Portuguese accents display perfectly in Excel
    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    // Create a hidden download link and click it automatically
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `links_atletas_${currentYear}.csv`);
    document.body.appendChild(link);
    
    link.click();
    document.body.removeChild(link);
  };

  const updateFee = async (id: string, newFee: string) => {
    await supabase.from('athletes').update({ monthly_fee: parseFloat(newFee) }).eq('id', id);
    fetchAdminData();
  };

  const handleOverrideStatus = async (paymentId: string, newStatus: string) => {
    await supabase.from('payments').update({ status: newStatus }).eq('id', paymentId);
    setSelectedMonthData(null);
    fetchAdminData();
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!window.confirm("Delete this record?")) return;
    await supabase.from('payments').delete().eq('id', paymentId);
    setSelectedMonthData(null);
    fetchAdminData();
  };

  useEffect(() => { checkUser(); }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] text-slate-400 font-bold animate-pulse">Authenticating Admin...</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 relative">
      
      {/* MODAL: Add Athlete */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-600" /> Add Athlete
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X /></button>
            </div>

            <div className="flex gap-4">
            <button 
              onClick={exportLinksCsv} 
              className="flex items-center gap-2 bg-white text-slate-700 px-6 py-3 rounded-xl font-bold text-sm shadow-sm border border-slate-200 hover:bg-slate-50 transition-all"
            >
              <FileText className="w-5 h-5 text-slate-500" /> Export All Links
            </button>

            <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all">
              <UserPlus className="w-5 h-5" /> Add Athlete
            </button>
            </div>
          </div>

            <div className="flex border-b border-slate-100">
              <button onClick={() => setAddMode('manual')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-colors ${addMode === 'manual' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-400'}`}>1 By 1</button>
              <button onClick={() => setAddMode('csv')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-colors ${addMode === 'csv' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-400'}`}>CSV Upload</button>
            </div>

            <div className="p-8">
              {addMode === 'manual' ? (
                <form onSubmit={handleAddManual} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Full Name</label>
                    <input autoFocus type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Frederico Riachos" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Email Address</label>
                    <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="athlete@email.com" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Monthly Fee (€)</label>
                    <input type="number" value={newFee} onChange={(e) => setNewFee(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900" />
                  </div>
                  <button disabled={isProcessing} className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 mt-2">
                    {isProcessing ? <Loader2 className="animate-spin w-5 h-5" /> : <Plus className="w-5 h-5" />} Add to Roster
                  </button>
                </form>
              ) : (
                <div className="text-center space-y-6">
                  <div className="p-6 bg-indigo-50 rounded-2xl border-2 border-dashed border-indigo-200">
                    <FileText className="w-10 h-10 text-indigo-400 mx-auto mb-4" />
                    <p className="text-sm font-bold text-indigo-900 mb-1">Upload CSV File</p>
                    <p className="text-[10px] text-indigo-500 font-medium">Format: Name, Email, Fee<br/>(e.g. John Doe, john@email.com, 30)</p>
                  </div>
                  <label className="cursor-pointer block w-full bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all">
                    <span className="flex items-center justify-center gap-2">
                      {isProcessing ? <Loader2 className="animate-spin w-5 h-5" /> : <Upload className="w-5 h-5" />} Select File
                    </span>
                    <input type="file" accept=".csv" onChange={handleCsvUpload} disabled={isProcessing} className="hidden" />
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Payment Inspection */}
      {selectedMonthData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-xl font-black text-slate-900">{selectedMonthData.athleteName}</h3>
                <p className="text-sm font-bold text-slate-500">{selectedMonthData.monthName} {currentYear} &middot; {selectedMonthData.payments.length} Attempt(s)</p>
              </div>
              <button onClick={() => setSelectedMonthData(null)} className="p-2 bg-slate-100 rounded-full text-slate-500"><X /></button>
            </div>
            <div className="overflow-y-auto p-6 flex-1 bg-white">
              {selectedMonthData.payments.map((payment: any, index: number) => (
                <div key={payment.id} className="mb-8 last:mb-0 pb-8 last:pb-0 border-b border-slate-100 last:border-0 grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                  <div className="absolute -top-3 -left-3 bg-slate-800 text-white text-[10px] font-black px-2 py-1 rounded-lg z-10">ATTEMPT {selectedMonthData.payments.length - index}</div>
                  <div className="bg-slate-100 rounded-2xl h-64 flex items-center justify-center overflow-hidden border border-slate-200 relative group">
                    {payment.image_url ? (
                      <>
                        <img src={payment.image_url} className="object-contain w-full h-full" alt="Receipt" />
                        <a href={payment.image_url} target="_blank" rel="noreferrer" className="absolute bottom-4 right-4 bg-white/90 p-2 rounded-lg shadow opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-xs font-bold text-slate-700">
                          <ExternalLink className="w-4 h-4" /> Open
                        </a>
                      </>
                    ) : (
                      <span className="text-slate-400 font-bold">No Image</span>
                    )}
                  </div>
                  <div className="flex flex-col justify-center space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${payment.status === 'verified' ? 'bg-emerald-100 text-emerald-700' : payment.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{payment.status}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Detected</p>
                        <p className="text-2xl font-black text-slate-900">{payment.amount_detected ? `€${payment.amount_detected}` : '—'}</p>
                      </div>
                    </div>
                    {payment.reject_reason && <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700">{payment.reject_reason}</div>}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex gap-2">
                        <button onClick={() => handleOverrideStatus(payment.id, 'verified')} className="flex-1 py-2 bg-emerald-50 text-emerald-700 font-bold rounded-xl text-xs flex justify-center items-center gap-1"><CheckCircle className="w-4 h-4"/> Verify</button>
                        <button onClick={() => handleOverrideStatus(payment.id, 'rejected')} className="flex-1 py-2 bg-rose-50 text-rose-700 font-bold rounded-xl text-xs flex justify-center items-center gap-1"><XCircle className="w-4 h-4"/> Reject</button>
                      </div>
                      <button onClick={() => handleDeletePayment(payment.id)} className="w-full py-2 text-slate-400 hover:text-rose-600 font-bold text-xs flex justify-center items-center gap-1"><Trash2 className="w-4 h-4"/> Delete Record</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Dashboard */}
      <div className="max-w-7xl mx-auto px-6 pt-12">
        <header className="flex flex-col md:flex-row justify-between md:items-end mb-12 gap-6">
          <div>
            <h1 className="text-4xl font-black text-slate-900 flex items-center gap-3">
              <ShieldCheck className="text-indigo-600 w-10 h-10" /> Admin Control
            </h1>
            <p className="text-slate-500 font-medium mt-2">Financial overview for {currentYear}</p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all">
              <UserPlus className="w-5 h-5" /> Add Athlete
            </button>
            <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="flex items-center gap-2 text-slate-400 font-bold hover:text-rose-500 transition-colors bg-white px-4 py-3 rounded-xl shadow-sm border border-slate-200">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="space-y-4">
          {athletes.map((a) => {
            let overdueCount = 0;
            const monthStatuses = monthInitials.map((initial, index) => {
              const billingMonthStr = `${currentYear}-${String(index + 1).padStart(2, '0')}`;
              const monthPayments = a.payments?.filter((p: any) => p.billing_month === billingMonthStr) || [];
              monthPayments.sort((p1: any, p2: any) => new Date(p2.created_at).getTime() - new Date(p1.created_at).getTime());

              let status = 'future';
              let bgColor = 'bg-slate-100 text-slate-400';
              if (monthPayments.some((p: any) => p.status === 'verified')) {
                bgColor = 'bg-emerald-500 text-white shadow-sm shadow-emerald-200';
              } else if (monthPayments.some((p: any) => p.status === 'pending' || p.status === 'processing')) {
                bgColor = 'bg-amber-400 text-white animate-pulse';
              } else if (monthPayments.some((p: any) => p.status === 'rejected')) {
                bgColor = 'bg-rose-600 text-white shadow-sm shadow-rose-200';
              } else if (index < currentMonthIndex) {
                bgColor = 'bg-rose-400 text-white shadow-sm shadow-rose-200';
                overdueCount++;
              }
              return { initial, name: fullMonths[index], bgColor, paymentsArray: monthPayments };
            });

            return (
              <div key={a.id} className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 border-l-4 p-5 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow" style={{ borderLeftColor: overdueCount > 0 ? '#fb7185' : '#10b981' }}>
                <div className="flex items-center gap-4 w-full xl:w-1/4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center font-black text-indigo-600 text-xl flex-shrink-0">{a.name[0]}</div>
                  <div className="overflow-hidden">
                    <h3 className="font-bold text-lg text-slate-900 truncate">{a.name}</h3>
                    <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1 truncate mb-0.5">
                      <Mail className="w-3 h-3" /> {a.email || 'No email provided'}
                    </p>
                    <p className={`text-xs font-bold flex items-center gap-1 ${overdueCount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {overdueCount > 0 ? <><AlertCircle className="w-3 h-3" /> {overdueCount} overdue</> : 'Up to date'}
                    </p>
                  </div>
                </div>
                
                <div className="flex-1 flex gap-1.5 sm:gap-2 overflow-x-auto py-2 w-full">
                  {monthStatuses.map((m, i) => (
                    <div key={i} onClick={() => m.paymentsArray.length > 0 && setSelectedMonthData({ athleteName: a.name, monthName: m.name, payments: m.paymentsArray })} title={`${m.name} (${m.paymentsArray.length} uploads)`} className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 transition-transform ${m.bgColor} ${m.paymentsArray.length > 0 ? 'cursor-pointer hover:scale-110' : ''}`}>{m.initial}</div>
                  ))}
                </div>
                
                <div className="flex items-center justify-between w-full xl:w-auto gap-6 pt-4 border-t border-slate-100 xl:pt-0 xl:border-none">
                  <div className="text-left xl:text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Fee</p>
                    <div className="flex items-center text-xl font-black text-slate-900">
                      <span className="mr-0.5">€</span>
                      <input type="number" defaultValue={a.monthly_fee} onBlur={(e) => updateFee(a.id, e.target.value)} className="w-16 bg-transparent border-b border-dashed border-slate-300 focus:border-indigo-500 outline-none" />
                    </div>
                  </div>
                  <button onClick={() => copyLink(a.secret_token)} className="bg-slate-900 hover:bg-slate-800 text-white py-2 px-4 rounded-xl font-bold text-xs shadow-md flex items-center gap-2 transition-colors">
                    <Share2 className="w-4 h-4" /> Copy Link
                  </button>
                </div>
                <Analytics />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}