
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { BiometricService } from '../services/BiometricService';

interface LoginProps {
  onLogin: (user: User) => void;
  currentUser: User | null;
  onLogout: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, currentUser, onLogout }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isBioAvailable, setIsBioAvailable] = useState(false);

  useEffect(() => {
    setIsBioAvailable(BiometricService.isAvailable());
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) return;
    
    const isMainAdmin = email.toLowerCase() === 'admin@nutritrack.com';
    
    const loginPayload: User = {
      id: isMainAdmin ? 'admin-001' : Math.random().toString(36).substr(2, 9),
      name: isMainAdmin ? 'Administrateur' : name,
      email: email.toLowerCase(),
      password: password,
      role: isMainAdmin ? 'admin' : 'user',
      status: isMainAdmin ? 'authorized' : 'pending',
      isAuthenticated: true
    };

    onLogin(loginPayload);
  };

  const handleBiometricLogin = async () => {
    const success = await BiometricService.authenticate();
    if (success && currentUser) {
      onLogin({ ...currentUser, isAuthenticated: true });
    } else {
      alert("Échec de l'authentification biométrique.");
    }
  };

  if (currentUser && currentUser.status === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-emerald-50 p-4 text-center">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-md border-t-8 border-amber-400">
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 mx-auto mb-6 text-3xl">⏳</div>
          <h2 className="text-2xl font-black text-slate-800">Compte en attente</h2>
          <p className="text-slate-500 mt-4 text-sm font-medium">Validation administrative requise pour <strong>{currentUser.name}</strong>.</p>
          <div className="mt-8 space-y-4">
             <button onClick={onLogout} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all">Retour au login</button>
             {currentUser.email.toLowerCase() === 'admin@nutritrack.com' && (
               <p className="text-[10px] text-rose-500 font-bold">Erreur de détection Admin. Veuillez réessayer de vous connecter.</p>
             )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-700 p-4">
      <div className="bg-white p-8 sm:p-10 rounded-[3rem] shadow-2xl w-full max-w-md border border-white/20">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 font-black text-2xl mx-auto mb-6 shadow-inner">N</div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tighter">NutriTrack AI</h1>
          <p className="text-slate-400 mt-2 font-bold uppercase text-[9px] tracking-[0.2em]">Authentification Sécurisée</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Nom complet</label>
            <input required type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Prénom & Nom" className="w-full px-5 py-4 rounded-2xl border-2 border-slate-50 focus:border-emerald-500 outline-none transition-all bg-slate-50/50 text-slate-900 font-bold text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Email</label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" className="w-full px-5 py-4 rounded-2xl border-2 border-slate-50 focus:border-emerald-500 outline-none transition-all bg-slate-50/50 text-slate-900 font-bold text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Mot de passe</label>
            <div className="relative">
              <input required type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full px-5 py-4 rounded-2xl border-2 border-slate-50 focus:border-emerald-500 outline-none transition-all bg-slate-50/50 text-slate-900 font-bold text-sm" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xs hover:text-emerald-500 transition-colors">{showPassword ? "HIDE" : "SHOW"}</button>
            </div>
          </div>

          <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-100 mt-4">S'identifier</button>

          {isBioAvailable && currentUser?.biometricId && (
            <div className="flex flex-col items-center gap-3 mt-6 pt-6 border-t border-slate-100">
               <button type="button" onClick={handleBiometricLogin} className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center hover:bg-emerald-100 transition-all active:scale-90 shadow-md">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
               </button>
               <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em]">Se connecter avec Face ID</p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default Login;
