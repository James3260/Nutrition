
import React, { useEffect, useState } from 'react';
import { User } from '../types';

interface AuthProps {
  onLogin: (user: User) => void;
}

/**
 * Identifiant Client Google OAuth configuré par l'utilisateur
 */
const GOOGLE_CLIENT_ID = "1092450986694-h69ns0ttnp6dvahoh3j4tpvrigotuls6.apps.googleusercontent.com";

const Login: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const initializeGoogleSignIn = () => {
      try {
        // @ts-ignore
        if (typeof google !== 'undefined') {
          // @ts-ignore
          google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
            auto_select: false,
          });
          // @ts-ignore
          google.accounts.id.renderButton(
            document.getElementById("googleBtn"),
            { 
              theme: "filled_black", 
              size: "large", 
              width: "320", 
              shape: "pill",
              text: "continue_with"
            }
          );
        }
      } catch (err) {
        console.warn("Google SDK non chargé");
      }
    };

    const handleCredentialResponse = (response: any) => {
      setIsLoading(true);
      try {
        const payload = JSON.parse(atob(response.credential.split('.')[1]));
        const googleUser: User = {
          id: payload.sub,
          googleId: payload.sub,
          name: payload.name,
          email: payload.email,
          picture: payload.picture,
          role: payload.email === "nene2080@icloud.com" ? 'admin' : 'user',
          status: 'authorized',
          isAuthenticated: true,
          exclusions: [],
          workouts: [],
          weightHistory: [],
          hydrationRecords: [],
          eatenMeals: []
        };
        onLogin(googleUser);
      } catch (e) {
        setError("Erreur de connexion Google. Vérifiez les origines autorisées dans la console Google Cloud.");
        setIsLoading(false);
      }
    };

    const checkGoogle = setInterval(() => {
      // @ts-ignore
      if (typeof google !== 'undefined') {
        clearInterval(checkGoogle);
        initializeGoogleSignIn();
      }
    }, 1000);

    return () => clearInterval(checkGoogle);
  }, [onLogin]);

  const handleQuickAccess = () => {
    setIsLoading(true);
    const guestUser: User = {
      id: "guest_" + Math.random().toString(36).substr(2, 9),
      name: "Utilisateur Démo",
      email: "demo@nutritrack.ai",
      role: 'user',
      status: 'authorized',
      isAuthenticated: true,
      exclusions: [],
      workouts: [],
      weightHistory: [],
      hydrationRecords: [],
      eatenMeals: []
    };
    setTimeout(() => onLogin(guestUser), 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-6">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="bg-white/90 backdrop-blur-3xl rounded-[3.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] w-full max-w-md p-10 md:p-14 relative overflow-hidden border border-white/20 animate-scale-in text-center z-10">
        <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white rounded-[2rem] flex items-center justify-center text-5xl font-black mx-auto mb-10 shadow-2xl shadow-emerald-500/30">
          N
        </div>
        
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-3">
          NutriTrack <span className="text-emerald-600">AI</span>
        </h1>
        
        <p className="text-slate-400 text-[11px] font-bold uppercase tracking-[0.25em] mb-14">
          Planificateur Intelligent
        </p>

        <div className="space-y-6">
          {error && (
            <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-rose-100">
              {error}
            </div>
          )}

          <div className="flex flex-col items-center gap-6">
            <div id="googleBtn" className="flex justify-center w-full min-h-[50px]"></div>
            
            <div className="relative py-2 w-full">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
              <div className="relative flex justify-center text-[9px] uppercase font-black text-slate-300 bg-white/0 px-4">OU ACCÈS INVITÉ</div>
            </div>

            <button 
              onClick={handleQuickAccess}
              disabled={isLoading}
              className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all hover:bg-slate-800 active:scale-95 shadow-xl"
            >
              {isLoading ? "Chargement..." : "Démarrer Sans Compte"}
            </button>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-slate-100/50">
          <p className="text-[9px] text-slate-300 font-bold uppercase tracking-[0.3em] leading-relaxed">
            Propulsé par Google Gemini 2.5<br/>
            NutriTrack AI © 2025
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
