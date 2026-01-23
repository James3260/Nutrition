
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
    { id: 'daily', label: 'Tableau de bord', icon: '🏠' },
    { id: 'assistant', label: 'Coach IA', icon: '🤖' },
    { id: 'calendar', label: 'Calendrier', icon: '📅' },
    { id: 'sport', label: 'Activité Sportive', icon: '🏃' },
    { id: 'shopping', label: 'Liste de courses', icon: '🛒' },
    { id: 'recipes', label: 'Recettes IA', icon: '🍳' },
    { id: 'admin', label: 'Gestion Famille', icon: '🛡️', adminOnly: true },
  ];

  const visibleTabs = tabs.filter(t => !t.adminOnly || user.role === 'admin');

  return (
    <>
      {/* Desktop Sidebar - Sleek Icon Strip */}
      <nav className="hidden md:flex flex-col w-20 lg:w-24 h-screen shrink-0 bg-white border-r border-slate-100 py-10 px-2 justify-between z-50">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 bg-gradient-to-tr from-emerald-600 to-teal-400 rounded-2xl flex items-center justify-center text-white font-black shadow-lg shadow-emerald-100 mb-12 cursor-pointer hover:rotate-12 transition-transform">
            N
          </div>

          <div className="space-y-4 w-full flex flex-col items-center">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                className={`group relative w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-500 ${
                  activeTab === tab.id 
                    ? 'bg-emerald-50 text-emerald-600 shadow-[inset_0_2px_10px_rgba(16,185,129,0.1)]' 
                    : 'text-slate-300 hover:text-slate-500 hover:bg-slate-50'
                }`}
              >
                {/* Active Indicator Bar */}
                {activeTab === tab.id && (
                  <div className="absolute left-[-12px] w-1 h-6 bg-emerald-500 rounded-r-full animate-in slide-in-from-left-2"></div>
                )}
                
                <span className={`text-2xl transition-transform duration-300 ${activeTab === tab.id ? 'scale-110 drop-shadow-sm' : 'group-hover:scale-110'}`}>
                  {tab.icon}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-6">
          <div className="p-1 bg-slate-50 rounded-2xl border border-slate-100 cursor-help" title={`${user.name} - Membre Premium`}>
             {user.picture ? (
               <img src={user.picture} className="w-10 h-10 rounded-xl object-cover grayscale hover:grayscale-0 transition-all" alt="P" />
             ) : (
               <div className="w-10 h-10 bg-emerald-100 text-emerald-600 flex items-center justify-center rounded-xl font-bold">{user.name[0]}</div>
             )}
          </div>
          <button 
            onClick={onLogout}
            title="Se déconnecter"
            className="w-12 h-12 flex items-center justify-center rounded-2xl text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-all"
          >
            <span className="text-2xl">🚪</span>
          </button>
        </div>
      </nav>

      {/* Mobile Top Header (Fixed Brand) */}
      <header className="md:hidden w-full h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
           <div className="w-8 h-8 bg-gradient-to-tr from-emerald-600 to-teal-400 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-lg">N</div>
           <span className="font-black text-sm tracking-tight text-slate-900 uppercase">NutriTrack</span>
        </div>
        <button onClick={onLogout} className="text-slate-300 w-10 h-10 flex items-center justify-center">
            <span className="text-xl">🚪</span>
        </button>
      </header>

      {/* Mobile Bottom Tab Bar - Floating Glassmorphism */}
      <nav className="md:hidden fixed bottom-6 left-6 right-6 h-16 bg-white/70 backdrop-blur-2xl border border-white/50 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex items-center justify-around z-50 px-2">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex flex-col items-center justify-center w-12 h-12 transition-all duration-500 rounded-full ${
              activeTab === tab.id 
                ? 'text-emerald-600' 
                : 'text-slate-300'
            }`}
          >
            <span className={`text-2xl transition-all duration-500 ${activeTab === tab.id ? 'scale-125 -translate-y-1' : ''}`}>
              {tab.icon}
            </span>
            
            {/* Mobile Active Dot */}
            {activeTab === tab.id && (
              <div className="absolute -bottom-1 w-1 h-1 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-in zoom-in-50"></div>
            )}
          </button>
        ))}
      </nav>
    </>
  );
};

export default Navbar;
