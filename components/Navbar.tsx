
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
      {/* Universal Top Header - Visible on all devices */}
      <header className="w-full h-16 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 flex items-center justify-between fixed top-0 left-0 right-0 z-[60] shadow-sm">
        <div className="flex items-center gap-3">
           <div className="w-9 h-9 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-md shadow-emerald-200/50">N</div>
           <div className="hidden sm:block">
              <span className="font-black text-xs tracking-widest text-slate-900 uppercase block leading-none">NutriTrack</span>
              <span className="text-[9px] font-bold text-emerald-600 tracking-wider">Premium Edition</span>
           </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden md:block text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">{activeTab}</span>
          <button 
              onClick={() => setIsMenuOpen(true)} 
              className="w-10 h-10 flex items-center justify-center text-slate-700 bg-slate-50 rounded-xl active:scale-95 transition-all border border-slate-100 hover:bg-white hover:shadow-md group"
          >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
          </button>
        </div>
      </header>

      {/* Universal Menu Drawer */}
      {isMenuOpen && (
          <div className="fixed inset-0 z-[70]">
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-500" onClick={() => setIsMenuOpen(false)}></div>
              <div className="absolute top-0 right-0 bottom-0 w-full max-w-[320px] bg-white shadow-2xl animate-in slide-in-from-right duration-500 flex flex-col p-8 sm:rounded-l-[2.5rem]">
                  
                  <div className="flex items-center justify-between mb-10">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-xl font-black text-slate-900 tracking-tight">Navigation</span>
                      </div>
                      <button onClick={() => setIsMenuOpen(false)} className="w-10 h-10 flex items-center justify-center bg-slate-50 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                  </div>

                  <nav className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                      {visibleTabs.map(tab => (
                          <button
                              key={tab.id}
                              onClick={() => handleNav(tab.id)}
                              className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 ${
                                  activeTab === tab.id 
                                  ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-100 translate-x-1' 
                                  : 'text-slate-400 hover:bg-slate-50 border border-transparent hover:text-slate-600'
                              }`}
                          >
                              <span className="text-2xl filter drop-shadow-sm">{tab.icon}</span>
                              <span className="font-black text-xs uppercase tracking-widest">{tab.label}</span>
                              {activeTab === tab.id && <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full"></div>}
                          </button>
                      ))}
                  </nav>

                  <div className="mt-8 pt-8 border-t border-slate-50 space-y-4">
                      <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-[1.5rem] border border-slate-100">
                          {user.picture ? (
                              <img src={user.picture} className="w-10 h-10 rounded-xl object-cover shadow-sm border border-white" alt="" />
                          ) : (
                              <div className="w-10 h-10 bg-white text-emerald-600 rounded-xl flex items-center justify-center font-black border border-emerald-50 shadow-sm">{user.name[0]}</div>
                          )}
                          <div className="min-w-0">
                              <p className="font-black text-xs text-slate-900 truncate">{user.name}</p>
                              <p className="text-[10px] text-slate-400 truncate font-bold uppercase tracking-tight">{user.role}</p>
                          </div>
                      </div>
                      <button onClick={onLogout} className="w-full py-4 bg-rose-50 text-rose-600 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors">
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
