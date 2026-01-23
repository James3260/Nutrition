
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
    { id: 'daily', label: 'Aujourd\'hui', icon: '📊' },
    { id: 'assistant', label: 'IA', icon: '🤖' },
    { id: 'calendar', label: 'Agenda', icon: '📅' },
    { id: 'sport', label: 'Sport', icon: '🏃‍♂️' },
    { id: 'shopping', label: 'Courses', icon: '🛒' },
    { id: 'recipes', label: 'Recettes', icon: '📖' },
    { id: 'admin', label: 'Famille', icon: '🛡️', adminOnly: true },
  ];

  const visibleTabs = tabs.filter(t => !t.adminOnly || user.role === 'admin');

  return (
    <>
      {/* Desktop/Tablet Header (Top) */}
      <nav className="hidden md:block w-full shrink-0 relative z-50 pt-6 px-6">
        <div className="container mx-auto max-w-6xl h-20 bg-slate-900/60 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 px-8 flex items-center justify-between shadow-2xl">
          
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-11 h-11 bg-emerald-500 rounded-2xl flex items-center justify-center text-white font-black shadow-lg shadow-emerald-500/20 transform -rotate-6">N</div>
            <span className="hidden lg:block font-black text-sm tracking-tighter uppercase">NutriTrack</span>
          </div>

          <div className="flex-1 flex justify-center items-center overflow-x-auto no-scrollbar mx-4">
            <div className="flex items-center gap-1.5 p-1 bg-black/20 rounded-2xl border border-white/5">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-500 ${
                    activeTab === tab.id 
                      ? 'bg-emerald-500 text-white shadow-[0_8px_20px_-5px_rgba(16,185,129,0.5)] scale-105' 
                      : 'text-slate-500 hover:text-emerald-400 hover:bg-white/5'
                  }`}
                  title={tab.label}
                >
                  <span className="text-xl">{tab.icon}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-3 mr-4">
               <div className="text-right">
                  <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">{user.name.split(' ')[0]}</p>
                  <p className="text-[8px] font-black uppercase text-emerald-500 tracking-widest">Premium Gold</p>
               </div>
               {user.picture && (
                 <img src={user.picture} className="w-9 h-9 rounded-xl border border-white/10" alt="Profile" />
               )}
            </div>
            
            <button 
              onClick={onLogout} 
              className="w-11 h-11 flex items-center justify-center text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Header (Brand Only) */}
      <div className="md:hidden w-full pt-4 pb-2 px-6 flex items-center justify-between z-50">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-lg transform -rotate-6">N</div>
           <span className="font-black text-xs tracking-widest uppercase text-emerald-500">NutriTrack</span>
        </div>
        <button onClick={onLogout} className="text-slate-500 p-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7" /></svg>
        </button>
      </div>

      {/* Mobile Navigation (Bottom) */}
      <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] z-[60] bg-slate-900/80 backdrop-blur-3xl rounded-3xl border border-white/10 p-2 shadow-2xl flex items-center justify-around">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 ${
              activeTab === tab.id 
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-110' 
                : 'text-slate-500'
            }`}
          >
            <span className="text-xl">{tab.icon}</span>
          </button>
        ))}
      </nav>
    </>
  );
};

export default Navbar;
