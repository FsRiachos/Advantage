'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  ShieldCheck, LogOut, Share2, AlertCircle, X, CheckCircle, 
  XCircle, ExternalLink, UserPlus, FileText, Plus, Upload, Loader2, Mail, Eye, EyeOff, Trash2, Home, Pencil, Save, Banknote, Landmark, Settings2
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminDashboard() {
  const [athletes, setAthletes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonthData, setSelectedMonthData] = useState<any>(null);
  
  const [showInactive, setShowInactive] = useState(false);
  const [sportFilter, setSportFilter] = useState<'All' | 'Ténis' | 'Padel'>('All');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState<'manual' | 'csv'>('manual');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newFee, setNewFee] = useState('30');
  const [newSport, setNewSport] = useState('Ténis');
  const [newJoinedDate, setNewSportJoinedDate] = useState('2026-01-01');
  const [isProcessing, setIsProcessing] = useState(false);

  const [editingAthlete, setEditingAthlete] = useState<any>(null);
  
  // NOVA: Variável para o formulário de exceção dentro do modal
  const [overrideInput, setOverrideInput] = useState('');

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
    // IMPORTANTE: Juntamos fee_overrides na query
    const { data } = await supabase
      .from('athletes')
      .select('*, payments(id, status, created_at, amount_detected, billing_month, image_url, reject_reason, transaction_ref), fee_overrides(id, billing_month, override_fee)')
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
      sport: newSport,
      joined_date: newJoinedDate,
      secret_token: crypto.randomUUID(),
      is_active: true
    });

    if (error) alert(error.message);
    else {
      setNewName('');
      setNewEmail('');
      setNewSport('Ténis');
      setNewSportJoinedDate('2026-01-01');
      setIsAddModalOpen(false);
      fetchAdminData();
    }
    setIsProcessing(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAthlete) return;
    setIsProcessing(true);

    const cleanFamilyId = editingAthlete.family_id?.trim() === "" ? null : editingAthlete.family_id?.trim();

    const { error } = await supabase
      .from('athletes')
      .update({
        name: editingAthlete.name,
        email: editingAthlete.email,
        monthly_fee: parseFloat(editingAthlete.monthly_fee),
        sport: editingAthlete.sport,
        family_id: cleanFamilyId,
        joined_date: editingAthlete.joined_date
      })
      .eq('id', editingAthlete.id);

    if (error) {
      alert(`Error updating profile: ${error.message}`);
    } else {
      setEditingAthlete(null);
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
        const separator = line.includes(';') ? ';' : ',';
        const [name, email, fee, sport, joinedDate] = line.split(separator);
        const cleanFee = fee ? fee.trim().replace(',', '.') : '30';
        const cleanSport = sport && sport.trim().toLowerCase() === 'padel' ? 'Padel' : 'Ténis';
        const cleanDate = joinedDate ? joinedDate.trim() : '2026-01-01';

        return {
          name: name?.trim(),
          email: email?.trim(),
          monthly_fee: parseFloat(cleanFee) || 30,
          sport: cleanSport,
          joined_date: cleanDate,
          secret_token: crypto.randomUUID(),
          is_active: true
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
    const baseUrl = window.location.origin; 
    const headers = ['Name', 'Email', 'Sport', 'Joined Date', 'Portal Link', 'Status'];
    const activeAthletes = athletes.filter(a => a.is_active);

    const rows = activeAthletes.map(a => [
      `"${(a.name || '').replaceAll('"', '""')}"`, 
      `"${a.email || ''}"`,
      `"${a.sport || 'Ténis'}"`,
      `"${a.joined_date || '2026-01-01'}"`,
      `"${baseUrl}/?token=${a.secret_token}"`,
      `"Active"`
    ]);
    
    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `links_atletas_ativos_${currentYear}.csv`);
    document.body.appendChild(link);
    
    link.click();
    document.body.removeChild(link);
  };

  const toggleAthleteStatus = async (id: string, currentStatus: boolean, name: string) => {
    const action = currentStatus ? 'deactivate/archive' : 'reactivate';
    if (!window.confirm(`Are you sure you want to ${action} ${name}?`)) return;

    const { error } = await supabase
      .from('athletes')
      .update({ is_active: !currentStatus })
      .eq('id', id);

    if (error) alert(error.message);
    else fetchAdminData();
  };

  const handleDeleteAthlete = async (id: string, name: string) => {
    if (!window.confirm(`⚠️ WARNING: Are you absolutely sure you want to PERMANENTLY delete ${name}?\n\nThis will wipe their profile AND all of their payment history.`)) {
      return;
    }

    const { error: paymentsError } = await supabase.from('payments').delete().eq('athlete_id', id);
    if (paymentsError) {
      alert(`Error clearing payments: ${paymentsError.message}`);
      return;
    }

    const { error: athleteError } = await supabase.from('athletes').delete().eq('id', id);
    if (athleteError) {
      alert(`Error removing athlete: ${athleteError.message}`);
    } else {
      fetchAdminData();
    }
  };

  const handleInjectManualPayment = async (method: 'Dinheiro' | 'Transferência Manual') => {
    if (!selectedMonthData) return;
    setIsProcessing(true);

    const { error } = await supabase.from('payments').insert({
      athlete_id: selectedMonthData.athleteId,
      billing_month: selectedMonthData.billingMonthStr,
      status: 'verified',
      amount_detected: parseFloat(selectedMonthData.athleteFee), // Usa a exceção ou a base
      transaction_ref: method === 'Dinheiro' ? 'CASH_PAYMENT' : 'MANUAL_OVERRIDE',
      reject_reason: `Validado manualmente via Admin (${method})`
    });

    if (error) {
      alert(error.message);
    } else {
      setSelectedMonthData(null);
      fetchAdminData();
    }
    setIsProcessing(false);
  };

  // NOVA: Funções para Modificar a Exceção
  const handleApplyFeeOverride = async () => {
    if (!selectedMonthData || !overrideInput) return;
    setIsProcessing(true);
    
    // Deleta se já existir, para evitar conflitos de constrangimentos únicos de SQL
    await supabase.from('fee_overrides').delete()
      .eq('athlete_id', selectedMonthData.athleteId)
      .eq('billing_month', selectedMonthData.billingMonthStr);

    const { error } = await supabase.from('fee_overrides').insert({
      athlete_id: selectedMonthData.athleteId,
      billing_month: selectedMonthData.billingMonthStr,
      override_fee: parseFloat(overrideInput)
    });

    if (error) alert(error.message);
    else {
      setSelectedMonthData(null);
      fetchAdminData();
    }
    setIsProcessing(false);
  };

  const handleRemoveFeeOverride = async () => {
    if (!selectedMonthData) return;
    setIsProcessing(true);
    await supabase.from('fee_overrides').delete()
      .eq('athlete_id', selectedMonthData.athleteId)
      .eq('billing_month', selectedMonthData.billingMonthStr);
    
    setSelectedMonthData(null);
    fetchAdminData();
    setIsProcessing(false);
  };

  const updateFee = async (id: string, newFee: string) => {
    await supabase.from('athletes').update({ monthly_fee: parseFloat(newFee) }).eq('id', id);
    fetchAdminData();
  };

  const updateSport = async (id: string, newSport: string) => {
    await supabase.from('athletes').update({ sport: newSport }).eq('id', id);
    fetchAdminData();
  };

  const updateFamilyId = async (id: string, groupRef: string) => {
    const cleanRef = groupRef.trim() === "" ? null : groupRef.trim();
    await supabase.from('athletes').update({ family_id: cleanRef }).eq('id', id);
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

  const filteredAthletes = athletes.filter(a => {
    const statusMatch = showInactive || a.is_active;
    const sportMatch = sportFilter === 'All' || a.sport === sportFilter;
    return statusMatch && sportMatch;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 relative">
      
      {/* MODAL: Edit Athlete Profile */}
      {editingAthlete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Pencil className="w-5 h-5 text-indigo-600" /> Edit Profile
              </h3>
              <button onClick={() => setEditingAthlete(null)} className="text-slate-400 hover:text-slate-600"><X /></button>
            </div>

            <div className="p-8 space-y-4">
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Full Name</label>
                  <input required type="text" value={editingAthlete.name} onChange={(e) => setEditingAthlete({...editingAthlete, name: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Email Address</label>
                  <input required type="email" value={editingAthlete.email} onChange={(e) => setEditingAthlete({...editingAthlete, email: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Monthly Fee (€)</label>
                    <input required type="number" step="0.01" value={editingAthlete.monthly_fee} onChange={(e) => setEditingAthlete({...editingAthlete, monthly_fee: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Sport</label>
                    <select value={editingAthlete.sport} onChange={(e) => setEditingAthlete({...editingAthlete, sport: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 bg-white">
                      <option value="Ténis">Ténis</option>
                      <option value="Padel">Padel</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Data de Admissão (Início de Faturação)</label>
                  <input required type="date" value={editingAthlete.joined_date || '2026-01-01'} onChange={(e) => setEditingAthlete({...editingAthlete, joined_date: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2 flex items-center gap-1"><Home className="w-3 h-3" /> Family Group ID (Optional)</label>
                  <input type="text" placeholder="e.g. SilvaFamily" value={editingAthlete.family_id || ''} onChange={(e) => setEditingAthlete({...editingAthlete, family_id: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900" />
                </div>
                <button disabled={isProcessing} className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 mt-2">
                  {isProcessing ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />} Save Changes
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Monthly Fee (€)</label>
                      <input type="number" step="0.01" value={newFee} onChange={(e) => setNewFee(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Sport</label>
                      <select value={newSport} onChange={(e) => setNewSport(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 bg-white">
                        <option value="Ténis">Ténis</option>
                        <option value="Padel">Padel</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Data de Admissão</label>
                    <input type="date" value={newJoinedDate} onChange={(e) => setNewSportJoinedDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900" />
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
                    <p className="text-[10px] text-indigo-500 font-medium">Format: Name, Email, Fee, Sport, JoinedDate(YYYY-MM-DD)<br/>(e.g. John Doe, john@email.com, 30, Padel, 2026-03-01)</p>
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

      {/* MODAL: Payment Inspection & Command Center */}
      {selectedMonthData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-xl font-black text-slate-900">{selectedMonthData.athleteName}</h3>
                <p className="text-sm font-bold text-slate-500">{selectedMonthData.monthName} {currentYear} &middot; Gestão de Pagamento</p>
              </div>
              <button onClick={() => { setSelectedMonthData(null); setOverrideInput(''); }} className="p-2 bg-slate-100 rounded-full text-slate-500"><X /></button>
            </div>
            
            <div className="overflow-y-auto p-6 flex-1 bg-white space-y-6">
              
              {/* NOVA SECÇÃO: Painel de Exceções de Valor */}
              <div className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1.5"><Settings2 className="w-4 h-4"/> Ajuste de Valor Mensal</h4>
                  <p className="text-[10px] font-bold text-indigo-400 mt-1">
                    Valor base atual: €{parseFloat(selectedMonthData.originalFee).toFixed(2)}
                    {selectedMonthData.hasOverride && <span className="ml-2 px-1.5 py-0.5 bg-indigo-200 text-indigo-800 rounded">Exceção ativa: €{selectedMonthData.athleteFee}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-indigo-600 font-black">€</span>
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder={selectedMonthData.athleteFee}
                    value={overrideInput}
                    onChange={(e) => setOverrideInput(e.target.value)}
                    className="w-20 px-2 py-1.5 rounded-lg border border-indigo-200 font-bold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button onClick={handleApplyFeeOverride} disabled={!overrideInput || isProcessing} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50">Gravar</button>
                  {selectedMonthData.hasOverride && (
                    <button onClick={handleRemoveFeeOverride} disabled={isProcessing} className="bg-white border border-rose-200 text-rose-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-50"><Trash2 className="w-3.5 h-3.5"/></button>
                  )}
                </div>
              </div>

              {/* Direct Action Panel for Cash / Manual Override Injections */}
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">Registar Pagamento Manual</h4>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button 
                    disabled={isProcessing}
                    onClick={() => handleInjectManualPayment('Dinheiro')}
                    className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl text-xs flex justify-center items-center gap-2 shadow-md hover:bg-emerald-700 transition-colors"
                  >
                    <Banknote className="w-4 h-4"/> Recebimento Dinheiro (€{selectedMonthData.athleteFee})
                  </button>
                  <button 
                    disabled={isProcessing}
                    onClick={() => handleInjectManualPayment('Transferência Manual')}
                    className="flex-1 py-3 bg-slate-800 text-white font-bold rounded-xl text-xs flex justify-center items-center gap-2 shadow-md hover:bg-slate-700 transition-colors"
                  >
                    <Landmark className="w-4 h-4"/> Validar Transferência Externa
                  </button>
                </div>
              </div>

              {selectedMonthData.payments.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-medium border-2 border-dashed border-slate-100 rounded-2xl">
                  Nenhum comprovativo enviado pelo atleta para este mês.
                </div>
              ) : (
                selectedMonthData.payments.map((payment: any, index: number) => (
                  <div key={payment.id} className="pb-8 border-b border-slate-100 last:border-0 grid grid-cols-1 md:grid-cols-2 gap-6 relative pt-4">
                    <div className="absolute top-0 left-0 bg-slate-800 text-white text-[10px] font-black px-2 py-1 rounded-lg z-10">TENTATIVA {selectedMonthData.payments.length - index}</div>
                    <div className="bg-slate-100 rounded-2xl h-64 flex items-center justify-center overflow-hidden border border-slate-200 relative group">
                      {payment.image_url ? (
                        <>
                          <img src={payment.image_url} className="object-contain w-full h-full" alt="Receipt" />
                          <a href={payment.image_url} target="_blank" rel="noreferrer" className="absolute bottom-4 right-4 bg-white/90 p-2 rounded-lg shadow opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-xs font-bold text-slate-700">
                            <ExternalLink className="w-4 h-4" /> Open
                          </a>
                        </>
                      ) : (
                        <div className="text-center p-4">
                          <Banknote className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                          <span className="text-slate-500 text-xs font-bold">{payment.reject_reason || 'Manual'}</span>
                        </div>
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
                          <p className="text-2xl font-black text-slate-900">{payment.amount_detected ? `€${payment.amount_detected.toFixed(2)}` : '—'}</p>
                        </div>
                      </div>
                      {payment.reject_reason && !payment.transaction_ref?.includes('CASH') && (
                        <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700">{payment.reject_reason}</div>
                      )}
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <div className="flex gap-2">
                          <button onClick={() => handleOverrideStatus(payment.id, 'verified')} className="flex-1 py-2 bg-emerald-50 text-emerald-700 font-bold rounded-xl text-xs flex justify-center items-center gap-1"><CheckCircle className="w-4 h-4"/> Forçar Visto</button>
                          <button onClick={() => handleOverrideStatus(payment.id, 'rejected')} className="flex-1 py-2 bg-rose-50 text-rose-700 font-bold rounded-xl text-xs flex justify-center items-center gap-1"><XCircle className="w-4 h-4"/> Rejeitar</button>
                        </div>
                        <button onClick={() => handleDeletePayment(payment.id)} className="w-full py-2 text-slate-400 hover:text-rose-600 font-bold text-xs flex justify-center items-center gap-1"><Trash2 className="w-4 h-4"/> Remover Registo</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
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
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-6">
              <div className="flex bg-slate-200/60 p-1 rounded-xl w-fit border border-slate-300/40">
                {['All', 'Ténis', 'Padel'].map(s => (
                  <button
                    key={s}
                    onClick={() => setSportFilter(s as any)}
                    className={`px-6 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-150 ${sportFilter === s ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              
              <label className="inline-flex items-center gap-2 cursor-pointer select-none bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">
                <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" />
                Show Inactive/Archived
              </label>
            </div>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={exportLinksCsv} 
              className="flex items-center gap-2 bg-white text-slate-700 px-6 py-3 rounded-xl font-bold text-sm shadow-sm border border-slate-200 hover:bg-slate-50 transition-all"
            >
              <FileText className="w-5 h-5 text-slate-500" /> Export Active Links
            </button>
            <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all">
              <UserPlus className="w-5 h-5" /> Add Athlete
            </button>
            <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="flex items-center gap-2 text-slate-400 font-bold hover:text-rose-500 transition-colors bg-white px-4 py-3 rounded-xl shadow-sm border border-slate-200">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="space-y-4">
          {filteredAthletes.map((a) => {
            let overdueCount = 0;
            const monthStatuses = monthInitials.map((initial, index) => {
              const billingMonthStr = `${currentYear}-${String(index + 1).padStart(2, '0')}`;
              const monthPayments = a.payments?.filter((p: any) => p.billing_month === billingMonthStr) || [];
              monthPayments.sort((p1: any, p2: any) => new Date(p2.created_at).getTime() - new Date(p1.created_at).getTime());

              // NOVA LÓGICA DE EXCEÇÃO
              const override = a.fee_overrides?.find((o: any) => o.billing_month === billingMonthStr);
              const effectiveFee = override ? override.override_fee : a.monthly_fee;

              const joinedDate = a.joined_date ? new Date(a.joined_date) : new Date(`${currentYear}-01-01`);
              const targetMonthFirstDay = new Date(currentYear, index, 1);
              const athleteJoinFirstDay = new Date(joinedDate.getFullYear(), joinedDate.getMonth(), 1);
              const isBeforeRegistration = targetMonthFirstDay < athleteJoinFirstDay;

              let bgColor = 'bg-slate-100 text-slate-400';
              if (monthPayments.some((p: any) => p.status === 'verified')) {
                bgColor = 'bg-emerald-500 text-white shadow-sm shadow-emerald-200';
              } else if (monthPayments.some((p: any) => p.status === 'pending' || p.status === 'processing')) {
                bgColor = 'bg-amber-400 text-white animate-pulse';
              } else if (monthPayments.some((p: any) => p.status === 'rejected')) {
                bgColor = 'bg-rose-600 text-white shadow-sm shadow-rose-200';
              } else if (isBeforeRegistration) {
                bgColor = 'bg-slate-100/40 text-slate-300 border border-slate-200/40 line-through cursor-pointer';
              } else if (index < currentMonthIndex && a.is_active) {
                bgColor = 'bg-rose-400 text-white shadow-sm shadow-rose-200';
                overdueCount++;
              }
              
              // Adiciona uma borda diferente se for uma exceção mas ainda não estiver paga
              if (override && monthPayments.length === 0 && !isBeforeRegistration) {
                bgColor += ' border-2 border-indigo-400';
              }

              return { initial, name: fullMonths[index], billingMonthStr, bgColor, paymentsArray: monthPayments, effectiveFee, hasOverride: !!override };
            });

            return (
              <div 
                key={a.id} 
                className={`flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 border-l-4 p-5 bg-white rounded-2xl shadow-sm transition-all duration-200
                  ${!a.is_active ? 'opacity-40 bg-slate-50/70 border-slate-300' : 'hover:shadow-md'}
                `}
                style={{ borderLeftColor: !a.is_active ? '#cbd5e1' : overdueCount > 0 ? '#fb7185' : '#10b981' }}
              >
                <div className="flex items-center gap-4 w-full xl:w-1/4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xl flex-shrink-0 ${!a.is_active ? 'bg-slate-200 text-slate-500' : 'bg-indigo-50 text-indigo-600'}`}>{a.name[0]}</div>
                  <div className="overflow-hidden">
                    <h3 className={`font-bold text-lg text-slate-900 truncate ${!a.is_active ? 'line-through text-slate-400' : ''}`}>{a.name}</h3>
                    <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1 truncate mb-0.5">
                      <Mail className="w-3 h-3" /> {a.email || 'No email provided'}
                    </p>
                    <p className={`text-xs font-bold flex items-center gap-1 ${!a.is_active ? 'text-slate-400' : overdueCount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {!a.is_active ? 'Archived Account' : overdueCount > 0 ? <><AlertCircle className="w-3 h-3" /> {overdueCount} em atraso</> : 'Regularizado'}
                    </p>
                  </div>
                </div>
                
                <div className="flex-1 flex gap-1.5 sm:gap-2 overflow-x-auto py-2 w-full">
                  {monthStatuses.map((m, i) => (
                    <div 
                      key={i} 
                      onClick={() => {
                        setOverrideInput(''); // Limpa o input sempre que abre o modal
                        setSelectedMonthData({ 
                          athleteId: a.id, 
                          originalFee: a.monthly_fee,
                          athleteFee: m.effectiveFee, 
                          hasOverride: m.hasOverride,
                          athleteName: a.name, 
                          monthName: m.name, 
                          billingMonthStr: m.billingMonthStr, 
                          payments: m.paymentsArray 
                        })
                      }} 
                      title={`${m.name} (${m.paymentsArray.length} carregamentos) ${m.hasOverride ? '- Exceção Ativa' : ''}`} 
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 transition-transform cursor-pointer hover:scale-110 ${m.bgColor}`}
                    >
                      {m.initial}
                    </div>
                  ))}
                </div>
                
                <div className="flex flex-wrap items-center justify-between w-full xl:w-auto gap-6 pt-4 border-t border-slate-100 xl:pt-0 xl:border-none">
                  
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Sport</p>
                    <select 
                      disabled={!a.is_active}
                      value={a.sport || 'Ténis'} 
                      onChange={(e) => updateSport(a.id, e.target.value)}
                      className="w-20 bg-transparent text-sm font-bold text-slate-700 border-b border-dashed border-slate-300 focus:border-indigo-500 outline-none disabled:text-slate-400 disabled:border-none cursor-pointer"
                    >
                      <option value="Ténis">Ténis</option>
                      <option value="Padel">Padel</option>
                    </select>
                  </div>

                  <div className="text-left">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                      <Home className="w-3 h-3" /> Family Group
                    </p>
                    <input 
                      type="text" 
                      disabled={!a.is_active}
                      defaultValue={a.family_id || ''} 
                      placeholder="None"
                      onBlur={(e) => updateFamilyId(a.id, e.target.value)}
                      className="w-24 bg-transparent text-sm font-bold text-slate-700 border-b border-dashed border-slate-300 focus:border-indigo-500 outline-none disabled:text-slate-400 disabled:border-none"
                    />
                  </div>

                  <div className="text-left">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Fee</p>
                    <div className="flex items-center text-xl font-black text-slate-900">
                      <span className="mr-0.5">€</span>
                      <input type="number" step="0.01" disabled={!a.is_active} defaultValue={a.monthly_fee} onBlur={(e) => updateFee(a.id, e.target.value)} className="w-16 bg-transparent border-b border-dashed border-slate-300 focus:border-indigo-500 outline-none disabled:border-none disabled:text-slate-400" />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {a.is_active ? (
                      <>
                        <button onClick={() => copyLink(a.secret_token)} className="bg-slate-900 hover:bg-slate-800 text-white py-2 px-4 rounded-xl font-bold text-xs shadow-md flex items-center gap-2 transition-colors">
                          <Share2 className="w-4 h-4" /> Copy Link
                        </button>
                        
                        <button 
                          onClick={() => setEditingAthlete(a)} 
                          className="bg-white hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 py-2 px-3 rounded-xl shadow-sm flex items-center transition-all"
                          title="Edit Profile"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        <button 
                          onClick={() => toggleAthleteStatus(a.id, a.is_active, a.name)} 
                          className="bg-white hover:bg-amber-50 text-slate-300 hover:text-amber-600 border border-slate-200 hover:border-amber-200 py-2 px-3 rounded-xl shadow-sm flex items-center transition-all"
                          title="Archive Athlete"
                        >
                          <EyeOff className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={() => setEditingAthlete(a)} 
                          className="bg-white hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 py-2 px-3 rounded-xl shadow-sm flex items-center transition-all"
                          title="Edit Profile"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        <button 
                          onClick={() => toggleAthleteStatus(a.id, a.is_active, a.name)} 
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 py-2 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-all"
                          title="Reactivate Athlete"
                        >
                          <Eye className="w-4 h-4" /> Reactivate
                        </button>
                      </>
                    )}

                    <button 
                      onClick={() => handleDeleteAthlete(a.id, a.name)} 
                      className="bg-white hover:bg-rose-50 text-slate-300 hover:text-rose-600 border border-slate-200 hover:border-rose-200 py-2 px-3 rounded-xl shadow-sm flex items-center transition-all"
                      title="Permanently Delete Athlete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}