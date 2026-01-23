
import React, { useState } from 'react';
import { Tab, User } from '../types';

interface NavbarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  onLogout: () => void;
  user: User;
  cloudStatus: string;
  isCloudConfigured: boolean;
  onCloudRestore: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ 
  activeTab, setActiveTab, onLogout, user
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const tabs: { id: Tab; label: string; icon: string; adminOnly?: boolean }[] = [
    { id: 'daily', label: 'Dashboard', icon: '🏠' },
    { id: 'assistant', label: 'Assistant IA', icon: '🤖' },
    { id: 'calendar', label: 'Agenda', icon: '📅' },
    { id: 'sport', label: 'Activité', icon: '🏃' },
    { id: 'shopping', label: 'Courses', icon: '🛒' },
    { id: 'recipes', label: 'Cuisine', icon: '🍳' },
    { id: 'admin', label: 'Gestion', icon: '🛡️', adminOnly: true },
  ];

  const visibleTabs = tabs.filter(t => !t.adminOnly || user.role === 'admin');

  const handleNav = (tabId: Tab) => {
    setActiveTab(tabId);
    setIsMenuOpen(false);
  };

  return (
    <>
      {/* Desktop Sidebar - Ultra-Minimalist Crystal Strip (Inchangé) */}
      <nav className="hidden lg:flex flex-col w-20 xl:w-24 h-screen shrink-0 bg-white/40 backdrop-blur-2xl border-r border-white/80 py-8 px-2 justify-between z-50 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 bg-gradient-to-tr from-emerald-600 to-teal-400 rounded-2xl flex items-center justify-center text-white font-black shadow-xl shadow-emerald-100/50 mb-10 cursor-pointer transition-all hover:scale-110">
            N
          </div>

          <div className="space-y-6 w-full flex flex-col items-center">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                className={`group relative w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300 ${
                  activeTab === tab.id 
                    ? 'bg-emerald-50 text-emerald-600 shadow-sm' 
                    : 'text-slate-300 hover:text-slate-500 hover:bg-white/50'
                }`}
              >
                {activeTab === tab.id && (
                  <div className="absolute left-0 w-1 h-6 bg-emerald-500 rounded-r-full shadow-lg"></div>
                )}
                <span className={`text-2xl transition-all duration-300 ${activeTab === tab.id ? 'scale-110' : 'group-hover:scale-125'}`}>
                  {tab.icon}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-6">
          <div className="p-1 bg-white rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
             {user.picture ? (
               <img src={user.picture} className="w-10 h-10 rounded-xl object-cover grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all" alt="P" />
             ) : (
               <div className="w-10 h-10 bg-emerald-50 text-emerald-600 flex items-center justify-center rounded-xl font-black text-xs">{user.name[0]}</div>
             )}
          </div>
          <button onClick={onLogout} title="Déconnexion" className="w-12 h-12 flex items-center justify-center rounded-2xl text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-all">
            <span className="text-2xl">🚪</span>
          </button>
        </div>
      </nav>

      {/* Mobile Top Header avec Menu Hamburger */}
      <header className="lg:hidden w-full h-16 bg-white/90 backdrop-blur-xl border-b border-white/80 px-4 flex items-center justify-between fixed top-0 left-0 right-0 z-[60] shadow-sm transition-all">
        <div className="flex items-center gap-3">
           <div className="w-9 h-9 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-md shadow-emerald-200">N</div>
           <div>
              <span className="font-black text-xs tracking-widest text-slate-900 uppercase block leading-none">NutriTrack</span>
              <span className="text-[9px] font-bold text-emerald-600 tracking-wider">Premium</span>
           </div>
        </div>
        <button 
            onClick={() => setIsMenuOpen(true)} 
            className="w-10 h-10 flex items-center justify-center text-slate-700 bg-slate-50 rounded-xl active:scale-90 transition-all border border-slate-100 hover:bg-slate-100"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
        </button>
      </header>

      {/* Mobile Menu Drawer (Tiroir Latéral) */}
      {isMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-[70]">
              <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsMenuOpen(false)}></div>
              <div className="absolute top-0 right-0 bottom-0 w-[85%] max-w-[320px] bg-white shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col p-6 rounded-l-[2rem]">
                  
                  <div className="flex items-center justify-between mb-8">
                      <span className="text-xl font-black text-slate-900 tracking-tight">Menu</span>
                      <button onClick={() => setIsMenuOpen(false)} className="w-9 h-9 flex items-center justify-center bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                      {visibleTabs.map(tab => (
                          <button
                              key={tab.id}
                              onClick={() => handleNav(tab.id)}
                              className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${
                                  activeTab === tab.id 
                                  ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100' 
                                  : 'text-slate-500 hover:bg-slate-50 border border-transparent'
                              }`}
                          >
                              <span className="text-2xl filter drop-shadow-sm">{tab.icon}</span>
                              <span className="font-bold text-sm">{tab.label}</span>
                              {activeTab === tab.id && <div className="ml-auto w-2 h-2 bg-emerald-500 rounded-full shadow-lg shadow-emerald-200"></div>}
                          </button>
                      ))}
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                          {user.picture ? (
                              <img src={user.picture} className="w-10 h-10 rounded-xl object-cover shadow-sm" alt="" />
                          ) : (
                              <div className="w-10 h-10 bg-white text-emerald-600 rounded-xl flex items-center justify-center font-black border border-emerald-50">{user.name[0]}</div>
                          )}
                          <div className="min-w-0">
                              <p className="font-bold text-xs text-slate-900 truncate">{user.name}</p>
                              <p className="text-[10px] text-slate-400 truncate font-medium">{user.email}</p>
                          </div>
                      </div>
                      <button onClick={onLogout} className="w-full py-3.5 bg-rose-50 text-rose-600 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors">
                          <span>🚪</span> Déconnexion
                      </button>
                  </div>
              </div>
          </div>
      )}
    </>
  );
};

export default Navbar;
