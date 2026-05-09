'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { error } = await supabase.auth.signInWithPassword({ 
      email, 
      password 
    });

    if (error) {
      alert('Invalid email or password.');
    } else {
      router.push('/admin');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
      <div className="glass-panel p-10 rounded-3xl w-full max-w-md shadow-2xl border border-indigo-100">
        <h1 className="text-3xl font-black mb-8 text-center text-slate-900">
          ADVANTAGE<span className="text-indigo-600">.</span> ADMIN
        </h1>
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Email Address</label>
            <input 
              type="email" 
              placeholder="you@example.com" 
              className="modern-input" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Password</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              className="modern-input" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
            />
          </div>
          <button type="submit" className="btn-primary w-full mt-2">
            Access Control Panel
          </button>
        </form>
      </div>
    </div>
  );
}