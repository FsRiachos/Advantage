'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Upload, CheckCircle2, XCircle, Loader2, Hourglass, CalendarDays, AlertCircle, AlertTriangle, CheckSquare, Square, Users } from 'lucide-react';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from "@vercel/speed-insights/next";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Função auxiliar para obter o primeiro e último nome de forma limpa
const formatShortName = (fullName: string) => {
  const tokens = fullName.trim().split(/\s+/);
  if (tokens.length <= 1) return fullName;
  return `${tokens[0]} ${tokens[tokens.length - 1]}`;
};

function PortalContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  // Suporte para múltiplos atletas (agrupamento familiar)
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [activeMemberIdx, setActiveMemberIdx] = useState<number>(0);
  
  const [payments, setPayments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  
  const currentYear = new Date().getFullYear();
  const currentMonthIndex = new Date().getMonth();
  
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(null);
  
  // Chaves compostas guardadas como: "athlete_id:billing_month"
  const [selectedMonthsForPayment, setSelectedMonthsForPayment] = useState<string[]>([]);

  // Meses traduzidos para PT-PT
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  const loadPrivateData = async () => {
    if (!token) {
      setError('Acesso Inválido: Por favor, utilize o link privado enviado pelo clube.');
      return;
    }

    const { data: initialAthlete, error: aError } = await supabase
      .from('athletes')
      .select('*')
      .eq('secret_token', token)
      .single();

    if (aError || !initialAthlete) {
      setError('Acesso Negado: Este link já não é válido ou o perfil foi removido.');
      return;
    }

    // Resolver estrutura do agregado familiar
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

    // Procurar registos financeiros de todos os membros do agregado familiar
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
        alert(`Erro no processamento: ${functionError.message || 'Não foi possível analisar o comprovativo.'}`);
      }

      setTimeout(() => loadPrivateData(), 3000);
    } catch (err) {
      alert('Falha no upload. Verifique a sua ligação à internet.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  useEffect(() => { loadPrivateData(); }, [token]);

  if (error) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-400 p-6 text-center">{error}</div>;
  if (!currentAthlete) return <div className="min-h-screen flex items-center justify-center animate-pulse text-slate-500 font-bold">A carregar o seu portal seguro...</div>;

  const selectedBillingMonthStr = selectedMonthIndex !== null ? `${currentYear}-${String(selectedMonthIndex + 1).padStart(2, '0')}` : null;
  const selectedPaymentInfo = selectedMonthIndex !== null ? payments.find(p => p.athlete_id === currentAthlete.id && p.billing_month === selectedBillingMonthStr) : null;

  // Estrutura de dados otimizada com Primeiro + Último Nome, divisão por propriedades e controlo de data de admissão
  const availableMonthsForChecklist: any[] = [];
  familyMembers.forEach(member => {
    months.forEach((name, index) => {
      const monthStr = `${currentYear}-${String(index + 1).padStart(2, '0')}`;
      const status = getPaymentStatusForMonthStr(member.id, monthStr);
      
      // Lógica de Admissão: verificar se este bloco é anterior à data de entrada do membro
      const joinedDate = member.joined_date ? new Date(member.joined_date) : new Date(`${currentYear}-01-01`);
      const targetMonthFirstDay = new Date(currentYear, index, 1);
      const athleteJoinFirstDay = new Date(joinedDate.getFullYear(), joinedDate.getMonth(), 1);
      const isBeforeRegistration = targetMonthFirstDay < athleteJoinFirstDay;
      
      // Apenas adiciona ao checklist se o mês for devido e NÃO for um mês isento (antes da entrada)
      if ((status === 'unpaid' || status === 'rejected') && index <= currentMonthIndex && !isBeforeRegistration) {
        availableMonthsForChecklist.push({
          compositeKey: `${member.id}:${monthStr}`,
          athleteName: formatShortName(member.name),
          monthName: name,
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
        
        {/* Abas do Agregado Familiar */}
        {familyMembers.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-6 bg-slate-200/60 p-1.5 rounded-2xl w-fit border border-slate-300/40 backdrop-blur-sm shadow-sm">
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
              OLÁ, {currentAthlete.name.split(' ')[0].toUpperCase()}<span className="text-indigo-600">.</span>
            </h1>
            <p className="text-slate-500 font-medium mt-1">A sua mensalidade base: <span className="text-indigo-600 font-bold">€{currentAthlete.monthly_fee.toFixed(2).replace('.', ',')}</span></p>
          </div>

          <div className="flex items-center gap-4 bg-white/40 px-4 py-2.5 rounded-2xl border border-slate-200/60 shadow-sm backdrop-blur-sm">
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Portal Oficial</p>
              <p className="text-base md:text-xl font-black text-slate-900 tracking-tight leading-none">Clube Ténis da Golegã</p>
            </div>
            <img src="/ctg.jpeg" alt="Clube Ténis da Golegã" className="w-12 h-12 md:w-16 md:h-16 object-cover rounded-xl shadow-sm border border-slate-200" />
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-6">
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 mb-6">
              <CalendarDays className="w-6 h-6 text-indigo-600" /> Estado das Mensalidades {currentYear}
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
                
                // Lógica de Admissão: verificar se este bloco é anterior à data de entrada
                const joinedDate = currentAthlete.joined_date ? new Date(currentAthlete.joined_date) : new Date(`${currentYear}-01-01`);
                const targetMonthFirstDay = new Date(currentYear, index, 1);
                const athleteJoinFirstDay = new Date(joinedDate.getFullYear(), joinedDate.getMonth(), 1);
                const isBeforeRegistration = targetMonthFirstDay < athleteJoinFirstDay;

                const canSelect = !isFuture && !isBeforeRegistration && !isPaid && !isPending;

                return (
                  <div 
                    key={monthName} 
                    onClick={() => canSelect && handleMonthClick(index)}
                    className={`relative p-5 rounded-2xl border transition-all duration-200 
                      ${isFuture ? 'bg-slate-50/50 border-slate-100 opacity-60' : 'bg-white shadow-sm'}
                      ${isBeforeRegistration ? 'bg-slate-50/40 border-slate-200/40 opacity-40 line-through cursor-default' : ''}
                      ${canSelect ? 'cursor-pointer hover:border-indigo-300 hover:shadow-md' : 'cursor-default'}
                      ${isSelected ? 'ring-2 ring-indigo-600 border-indigo-600 scale-[1.02]' : 'border-slate-200/60'}
                    `}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <p className={`text-sm font-bold ${isSelected ? 'text-indigo-600' : 'text-slate-500'}`}>{monthName}</p>
                      {isPending && <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded">Pendente</span>}
                      {isRejected && <span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest bg-rose-50 px-2 py-0.5 rounded">Rejeitado</span>}
                      {isBeforeRegistration && <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">Isento</span>}
                    </div>
                    
                    <div className="flex items-center justify-center h-12">
                      {isPaid && <CheckCircle2 className="w-10 h-10 text-emerald-500" />}
                      {isPending && <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />}
                      {isBeforeRegistration && <Hourglass className="w-6 h-6 text-slate-200" />}
                      {(!isPaid && !isPending && !isFuture && !isBeforeRegistration) && <XCircle className={`w-8 h-8 mx-auto ${isSelected ? 'text-indigo-400' : 'text-rose-400'}`} />}
                      {isFuture && (
                        <div className="flex flex-col items-center">
                          <Hourglass className="w-6 h-6 text-slate-300 mb-1" />
                          <span className="text-[10px] font-bold text-slate-400">€{currentAthlete.monthly_fee.toFixed(2).replace('.', ',')}</span>
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
                  <h3 className="font-bold text-slate-900 mb-2">Selecione um Mês</h3>
                  <p className="text-sm text-slate-500">Clique num dos meses ativos no calendário para visualizar o estado ou enviar um comprovativo.</p>
                </div>
              ) : selectedPaymentInfo?.status === 'verified' ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="w-8 h-8" /></div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Pagamento Validado</h3>
                  <p className="text-sm font-medium text-slate-500">A sua mensalidade de <strong className="text-slate-900">{months[selectedMonthIndex]} {currentYear}</strong> encontra-se totalmente paga. Obrigado!</p>
                </div>
              ) : selectedPaymentInfo?.status === 'pending' || selectedPaymentInfo?.status === 'processing' ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4"><Loader2 className="w-8 h-8 animate-spin" /></div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">A verificar...</h3>
                  <p className="text-sm font-medium text-slate-500 mb-6">A nossa Inteligência Artificial está a ler os dados do seu documento. Demora cerca de 10 segundos.</p>
                  <button onClick={loadPrivateData} className="text-xs font-bold text-indigo-600 hover:underline">Atualizar Estado da Página</button>
                </div>
              ) : (
                <>
                  {selectedPaymentInfo?.status === 'rejected' && (
                    <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-bold text-rose-800">Comprovativo Rejeitado</h4>
                          <p className="text-xs text-rose-600 mt-1">{selectedPaymentInfo.reject_reason}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <h2 className="text-xl font-bold mb-4 flex items-center gap-3 text-slate-900">
                    <Upload className="w-5 h-5 text-indigo-600" /> Enviar Comprovativo
                  </h2>
                  
                  {/* DESIGN REMODELADO: Lista de seleção familiar em formato de Cards */}
                  {availableMonthsForChecklist.length > 0 && (
                    <div className="mb-6 bg-indigo-50/40 p-5 rounded-2xl border border-indigo-100/80 shadow-inner">
                      <p className="text-xs font-black text-indigo-900 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-indigo-500" /> Incluir mais mensalidades neste pagamento:
                      </p>
                      
                      <div className="space-y-2.5 mb-4 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                        {availableMonthsForChecklist.map(m => {
                          const isChecked = selectedMonthsForPayment.includes(m.compositeKey);
                          return (
                            <div 
                              key={m.compositeKey} 
                              onClick={() => toggleMonthSelection(m.compositeKey)}
                              className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-150 cursor-pointer select-none
                                ${isChecked 
                                  ? 'bg-white border-indigo-300 shadow-sm' 
                                  : 'bg-white/60 border-slate-200/60 hover:bg-white hover:border-slate-300'}
                              `}
                            >
                              <div className="flex items-center gap-3">
                                {isChecked 
                                  ? <CheckSquare className="w-5 h-5 text-indigo-600 shrink-0" /> 
                                  : <Square className="w-5 h-5 text-slate-300 group-hover:text-indigo-400 shrink-0" />
                                }
                                <div className="leading-tight">
                                  <p className={`text-sm font-black ${isChecked ? 'text-slate-900' : 'text-slate-700'}`}>
                                    {m.athleteName}
                                  </p>
                                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                                    Mês: <span className="text-indigo-600">{m.monthName}</span>
                                  </p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className={`text-sm font-black ${isChecked ? 'text-indigo-600' : 'text-slate-500'}`}>
                                  €{m.fee.toFixed(2).replace('.', ',')}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className="pt-3 border-t border-indigo-100/60 flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-500">Total a Comprovar:</span>
                        <span className="text-xl font-black text-indigo-600">
                          €{calculatedTotal.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <label className="group flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-indigo-200 bg-indigo-50/30 rounded-2xl cursor-pointer hover:bg-indigo-50 transition-all">
                    <div className="text-center px-4">
                      <Upload className="w-6 h-6 text-indigo-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                      <p className="text-xs font-bold text-indigo-600">Selecionar imagem ou PDF</p>
                      <p className="text-[10px] text-indigo-400 mt-1 font-medium">O documento deve ter o valor exato de €{calculatedTotal.toFixed(2).replace('.', ',')}</p>
                    </div>
                    <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} disabled={uploading || selectedMonthsForPayment.length === 0} />
                  </label>

                  {uploading && (
                    <div className="mt-4 bg-indigo-600 text-white rounded-xl p-4 flex items-center justify-center gap-3 shadow-lg shadow-indigo-200">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm font-bold">A Inteligência Artificial está a analisar...</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <Analytics />
      <SpeedInsights />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-bold text-slate-400 animate-pulse">A carregar o seu portal seguro...</div>}>
      <PortalContent />
    </Suspense>
  );
}