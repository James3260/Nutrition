
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { BiometricService } from '../services/BiometricService';
import { StorageService } from '../services/StorageService';

interface AuthProps {
  onLogin: (user: User) => void;
  allUsers: User[];
}

const Login: React.FC<AuthProps> = ({ onLogin, allUsers }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bioAvailable, setBioAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setBioAvailable(BiometricService.isAvailable());
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!email || !password) {
      setError("Veuillez remplir tous les champs.");
      setIsLoading(false);
      return;
    }

    try {
      // Recherche stricte dans la liste des utilisateurs autorisés
      const targetUser = allUsers.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
      
      if (!targetUser) {
        setError("Compte non autorisé ou inconnu.");
        setIsLoading(false);
        return;
      }

      // Vérification stricte du mot de passe
      if (targetUser.password !== password) {
        setError("Mot de passe incorrect.");
        setIsLoading(false);
        return;
      }

      // Connexion réussie
      onLogin({ ...targetUser, isAuthenticated: true });
      
    } catch (err) {
      setError("Une erreur est survenue lors de la connexion.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricAuth = async () => {
    setIsLoading(true);
    const success = await BiometricService.authenticate();
    if (success) {
      const savedUser = await StorageService.loadData('current_user');
      // Pour la biométrie, on vérifie aussi que l'utilisateur est toujours dans allUsers
      if (savedUser && allUsers.some(u => u.id === savedUser.id)) {
        onLogin({ ...savedUser, isAuthenticated: true });
      } else {
        setError("Aucun profil biométrique valide sur cet appareil.");
      }
    } else {
      setError("Authentification biométrique annulée ou échouée.");
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-6 selection:bg-emerald-500/30">
      <div className="bg-white rounded-[3.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] w-full max-w-md p-10 md:p-14 relative overflow-hidden border border-white/10 animate-scale-in">
        
        {/* Background Accents */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -ml-20 -mb-20"></div>

        <div className="relative z-10 text-center">
          <div className="w-20 h-20 bg-emerald-600 text-white rounded-[1.8rem] flex items-center justify-center text-4xl font-black mx-auto mb-8 shadow-2xl shadow-emerald-500/20">
            N
          </div>
          
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-2">
            NutriTrack AI
          </h1>
          
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-10">
            Accès Privé
          </p>

          <form onSubmit={handleAuth} className="space-y-4">
            {error && (
              <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-rose-100 animate-pulse">
                {error}
              </div>
            )}

            <div className="space-y-1 text-left">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Identifiant</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nene2080@icloud.com"
                className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-emerald-500/20 rounded-2xl text-slate-900 font-medium outline-none transition-all placeholder:text-slate-300"
              />
            </div>

            <div className="space-y-1 text-left">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Mot de passe</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-emerald-500/20 rounded-2xl text-slate-900 font-medium outline-none transition-all placeholder:text-slate-300"
              />
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : "S'identifier"}
            </button>
          </form>

          {bioAvailable && (
            <div className="mt-8 flex flex-col items-center">
              <div className="w-full h-px bg-slate-100 mb-8 flex items-center justify-center">
                <span className="bg-white px-4 text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">Ou</span>
              </div>
              
              <button 
                onClick={handleBiometricAuth}
                className="flex flex-col items-center gap-3 text-slate-400 hover:text-emerald-500 transition-colors group"
              >
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center border-2 border-transparent group-hover:border-emerald-100 group-hover:bg-emerald-50 transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0112 3c1.22 0 2.383.218 3.46.616m.835 1.908c.367.494.665 1.05.888 1.637a9.996 9.996 0 01.714 3.59c0 5.42-3.355 9.994-8.143 11.857M15 11h.01" />
                  </svg>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">Biométrie</span>
              </button>
            </div>
          )}
        </div>

        <div className="mt-12 pt-8 border-t border-slate-100 text-center relative z-10">
          <p className="text-[8px] text-slate-300 font-bold uppercase tracking-[0.2em]">
            Protection Intégrale AES-256
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
