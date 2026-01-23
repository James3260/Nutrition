
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

      {/* Mobile Top Header */}
      <header className="lg:hidden w-full h-16 bg-white/60 backdrop-blur-xl border-b border-white/80 px-6 flex items-center justify-between sticky top-0 z-50 shrink-0">
        <div className="flex items-center gap-3">
           <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-black text-xs">N</div>
           <span className="font-black text-[10px] tracking-widest text-slate-900 uppercase">NutriTrack</span>
        </div>
        <button onClick={onLogout} className="text-slate-300 w-10 h-10 flex items-center justify-center">
            <span className="text-xl">🚪</span>
        </button>
      </header>

      {/* Mobile Bottom Navigation - Floating Pill avec support Safe Area */}
      <nav className="lg:hidden fixed bottom-6 left-6 right-6 h-16 bg-white/80 backdrop-blur-2xl border border-white/60 rounded-full shadow-[0_12px_40px_-12px_rgba(0,0,0,0.15)] flex items-center justify-around z-50 px-4 mb-[env(safe-area-inset-bottom)]">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center justify-center w-12 h-12 transition-all duration-300 ${activeTab === tab.id ? 'text-emerald-600' : 'text-slate-300 opacity-60'}`}
          >
            <span className={`text-2xl transition-all duration-300 ${activeTab === tab.id ? 'scale-125 -translate-y-1' : ''}`}>{tab.icon}</span>
            {activeTab === tab.id && <div className="absolute bottom-2 w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>}
          </button>
        ))}
      </nav>
    </>
  );
};

export default Navbar;
