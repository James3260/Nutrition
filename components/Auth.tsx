
import React, { useEffect, useState } from 'react';
import { User } from '../types';

interface AuthProps {
  onLogin: (user: User) => void;
}

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
              width: window.innerWidth < 480 ? window.innerWidth - 80 : 340, 
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
        setError("Erreur de connexion. Veuillez réessayer.");
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

    return () => {
      clearInterval(checkGoogle);
    };
  }, [onLogin]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#020617] overflow-hidden p-4 md:p-6">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[80%] h-[80%] bg-emerald-600/10 rounded-full blur-[120px] md:blur-[160px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[80%] h-[80%] bg-blue-600/10 rounded-full blur-[120px] md:blur-[160px]"></div>
      </div>

      <div className="w-full max-w-md relative z-10 animate-scale-in">
        <div className="bg-slate-900/40 backdrop-blur-3xl rounded-[3rem] md:rounded-[4rem] border border-white/10 p-8 md:p-16 text-center shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)]">
          
          <div className="w-16 h-16 md:w-24 md:h-24 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-[1.5rem] md:rounded-[2.5rem] flex items-center justify-center text-3xl md:text-5xl font-black mx-auto mb-6 md:mb-10 shadow-[0_15px_40px_-10px_rgba(16,185,129,0.5)] float">
            <span className="text-white">N</span>
          </div>
          
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter mb-2 md:mb-4">
            NutriTrack <span className="text-emerald-500">AI</span>
          </h1>
          
          <p className="text-slate-500 text-[10px] md:text-[12px] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] mb-10 md:mb-16 px-4">
            L'excellence Nutritionnelle
          </p>

          <div className="space-y-6 md:space-y-8">
            {error && (
              <div className="p-3 md:p-4 bg-rose-500/10 text-rose-400 rounded-2xl text-[10px] md:text-[11px] font-black uppercase tracking-widest border border-rose-500/20">
                {error}
              </div>
            )}

            <div className="flex flex-col items-center justify-center min-h-[50px] md:min-h-[60px] transform hover:scale-[1.02] transition-transform duration-300">
              <div id="googleBtn" className="scale-90 md:scale-100"></div>
            </div>

            <p className="text-[9px] md:text-[10px] text-slate-600 font-bold uppercase tracking-[0.15em] md:tracking-[0.2em] leading-relaxed max-w-[280px] mx-auto opacity-60">
              Accédez à votre assistant santé personnalisé avec votre compte Google.
            </p>
          </div>

          <div className="mt-12 md:mt-20 pt-6 md:pt-10 border-t border-white/5">
            <div className="flex justify-center gap-4 md:gap-6 opacity-30">
              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">Confidentialité</span>
              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">Sécurité</span>
            </div>
            <p className="text-[8px] md:text-[9px] text-slate-700 font-black uppercase tracking-[0.4em] md:tracking-[0.5em] mt-6 md:mt-8">
              STUDIO EDITION 2025
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
