
import React from 'react';
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

  return (
    <>
      {/* Desktop Sidebar - Ultra-Minimalist Crystal Strip */}
      <nav className="hidden lg:flex flex-col w-20 xl:w-24 h-screen shrink-0 bg-white/40 backdrop-blur-2xl border-r border-white/80 py-10 px-2 justify-between z-50 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col items-center">
          {/* Brand Logo */}
          <div className="w-12 h-12 bg-gradient-to-tr from-emerald-600 to-teal-400 rounded-2xl flex items-center justify-center text-white font-black shadow-xl shadow-emerald-100/50 mb-12 cursor-pointer hover:rotate-12 transition-all duration-500 hover:scale-110">
            N
          </div>

          {/* Navigation Icons */}
          <div className="space-y-6 w-full flex flex-col items-center">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                className={`group relative w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-500 ${
                  activeTab === tab.id 
                    ? 'bg-emerald-50 text-emerald-600 shadow-[inset_0_2px_8px_rgba(16,185,129,0.05)]' 
                    : 'text-slate-300 hover:text-slate-500 hover:bg-white/50'
                }`}
              >
                {/* Active Indicator Bar - Vertical Neon */}
                {activeTab === tab.id && (
                  <div className="absolute left-[-10px] w-1.5 h-6 bg-emerald-500 rounded-r-full shadow-[0_0_12px_rgba(16,185,129,0.8)] animate-in slide-in-from-left-4 duration-500"></div>
                )}
                
                <span className={`text-2xl transition-all duration-500 ${activeTab === tab.id ? 'scale-110 drop-shadow-[0_0_8px_rgba(16,185,129,0.2)] translate-x-0.5' : 'group-hover:scale-125 group-hover:rotate-6'}`}>
                  {tab.icon}
                </span>

                {/* Floating Tooltip Label (Crystal Style) */}
                <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900/90 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 translate-x-2 group-hover:translate-x-0 z-[60] shadow-xl">
                  {tab.label}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-col items-center gap-8">
          <div className="relative group cursor-help">
            <div className="p-1 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all duration-500 group-hover:shadow-md group-hover:-translate-y-1">
               {user.picture ? (
                 <img src={user.picture} className="w-10 h-10 rounded-xl object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500" alt="P" />
               ) : (
                 <div className="w-10 h-10 bg-emerald-50 text-emerald-600 flex items-center justify-center rounded-xl font-black text-sm">{user.name[0]}</div>
               )}
            </div>
            {/* Tooltip profile */}
            <div className="absolute left-full ml-4 bottom-0 px-3 py-2 bg-white border border-slate-100 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 z-[60] shadow-2xl min-w-[120px]">
              <p className="text-[10px] font-black text-slate-900 truncate">{user.name}</p>
              <p className="text-[8px] font-bold text-emerald-500 uppercase">Premium</p>
            </div>
          </div>

          <button 
            onClick={onLogout}
            title="Déconnexion"
            className="w-12 h-12 flex items-center justify-center rounded-2xl text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-all duration-500 hover:rotate-90"
          >
            <span className="text-2xl">🚪</span>
          </button>
        </div>
      </nav>

      {/* Mobile Top Header (Crystal) */}
      <header className="lg:hidden w-full h-16 bg-white/60 backdrop-blur-xl border-b border-white/80 px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
           <div className="w-9 h-9 bg-gradient-to-tr from-emerald-600 to-teal-400 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-lg shadow-emerald-100/50">N</div>
           <span className="font-black text-xs tracking-[0.2em] text-slate-900 uppercase">NutriTrack</span>
        </div>
        <button onClick={onLogout} className="text-slate-300 w-10 h-10 flex items-center justify-center active:scale-90 transition-transform">
            <span className="text-xl">🚪</span>
        </button>
      </header>

      {/* Mobile Bottom Navigation - Floating Pill Glassmorphism */}
      <nav className="lg:hidden fixed bottom-8 left-6 right-6 h-18 bg-white/40 backdrop-blur-3xl border border-white/60 rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.12)] flex items-center justify-around z-50 px-3 py-1.5">
        <div className="absolute inset-0 rounded-[2.5rem] shadow-[inset_0_2px_10px_rgba(255,255,255,0.5)] pointer-events-none"></div>
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex flex-col items-center justify-center w-12 h-12 transition-all duration-700 rounded-full ${
              activeTab === tab.id 
                ? 'text-emerald-600 scale-110' 
                : 'text-slate-400/60'
            }`}
          >
            <span className={`text-2xl transition-all duration-700 ${activeTab === tab.id ? 'drop-shadow-[0_0_10px_rgba(16,185,129,0.3)] -translate-y-1' : 'grayscale opacity-60'}`}>
              {tab.icon}
            </span>
            
            {/* Active Indicator Dot */}
            {activeTab === tab.id && (
              <div className="absolute -bottom-1 w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.8)] animate-in zoom-in-50 duration-700"></div>
            )}
          </button>
        ))}
      </nav>
    </>
  );
};

export default Navbar;
