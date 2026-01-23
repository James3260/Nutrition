
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
              theme: "filled_blue", 
              size: "large", 
              width: window.innerWidth < 480 ? window.innerWidth - 64 : 340, 
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
        setError("Échec de l'authentification. Veuillez réessayer.");
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
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#FDFDFF] overflow-hidden p-6 relative">
      {/* Mesh Gradient Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[100%] h-[100%] bg-emerald-50/60 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[80%] h-[80%] bg-blue-50/50 rounded-full blur-[100px] animate-pulse [animation-delay:2s]"></div>
        <div className="absolute top-[30%] left-[20%] w-[40%] h-[40%] bg-teal-50/30 rounded-full blur-[80px] animate-pulse [animation-delay:4s]"></div>
      </div>

      <div className="w-full max-w-lg relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="bg-white/60 backdrop-blur-2xl rounded-[3.5rem] border border-white/80 p-10 md:p-20 text-center shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)]">
          
          {/* Nouveau Logo Minimaliste Crystal */}
          <div className="relative w-24 h-24 mx-auto mb-10 group">
            <div className="absolute inset-0 bg-emerald-400/20 blur-2xl rounded-full scale-150 animate-pulse"></div>
            <div className="relative w-full h-full bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-200/50 float transition-transform group-hover:scale-110">
              <svg viewBox="0 0 24 24" fill="none" className="w-12 h-12 text-white drop-shadow-md" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" fill="currentColor" fillOpacity="0.2"/>
                <path d="M12 2L19.5 20.29L12 18V2Z" fill="white" fillOpacity="0.9"/>
                <path d="M12 2L4.5 20.29L12 18V2Z" fill="white" fillOpacity="0.5"/>
              </svg>
            </div>
          </div>
          
          <div className="space-y-2 mb-12">
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">
              NutriTrack<span className="text-emerald-500">.</span>
            </h1>
            <p className="text-slate-400 text-[10px] md:text-xs font-black uppercase tracking-[0.4em]">
              Elite Personalized Nutrition
            </p>
          </div>

          <div className="space-y-8">
            {error && (
              <div className="p-4 bg-rose-50 text-rose-500 rounded-2xl text-[10px] font-bold uppercase tracking-widest border border-rose-100 animate-in zoom-in-95">
                {error}
              </div>
            )}

            <div className="flex flex-col items-center justify-center min-h-[64px] relative">
              {isLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-2 border-emerald-100 border-t-emerald-500 rounded-full animate-spin"></div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Initialisation...</span>
                </div>
              ) : (
                <div id="googleBtn" className="transition-all hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] hover:-translate-y-1 rounded-full"></div>
              )}
            </div>

            <div className="space-y-4 max-w-[280px] mx-auto">
              <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                Rejoignez l'expérience exclusive NutriTrack avec votre accès Google.
              </p>
            </div>
          </div>

          <div className="mt-20 pt-8 border-t border-slate-50">
            <div className="flex items-center justify-center gap-4">
              <span className="w-1 h-1 bg-emerald-500 rounded-full animate-ping"></span>
              <p className="text-[9px] text-slate-300 font-black uppercase tracking-[0.5em]">
                Edition Crystal • 2025
              </p>
              <span className="w-1 h-1 bg-emerald-500 rounded-full animate-ping [animation-delay:1s]"></span>
            </div>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute -top-10 -right-10 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl"></div>
        <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-blue-500/5 rounded-full blur-xl"></div>
      </div>
    </div>
  );
};

export default Login;
