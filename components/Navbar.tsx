
import React, { useState } from 'react';
import { Tab, User } from '../types';
import NotificationToggle from './NotificationToggle';
import SyncModal from './SyncModal';

interface NavbarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  onLogout: () => void;
  user: User;
  onExport: () => void;
  onImport: (data: string) => void;
  onGenerateMagicLink: () => void;
  cloudStatus: 'off' | 'syncing' | 'synced' | 'error';
  isCloudConfigured: boolean;
  onCloudRestore: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ 
  activeTab, setActiveTab, onLogout, user, onExport, onImport, onGenerateMagicLink, cloudStatus, isCloudConfigured, onCloudRestore 
}) => {
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  const tabs: { id: Tab; label: string; icon: string; adminOnly?: boolean }[] = [
    { id: 'daily', label: 'Aujourd\'hui', icon: '📊' },
    { id: 'assistant', label: 'Assistant IA', icon: '🤖' },
    { id: 'calendar', label: 'Agenda', icon: '📅' },
    { id: 'sport', label: 'Sport', icon: '🏃‍♂️' },
    { id: 'shopping', label: 'Courses', icon: '🛒' },
    { id: 'recipes', label: 'Recettes', icon: '📖' },
    { id: 'admin', label: 'Admin', icon: '🛡️', adminOnly: true },
  ];

  const visibleTabs = tabs.filter(t => !t.adminOnly || user.role === 'admin');

  return (
    <nav className="bg-white shadow-md border-b border-slate-200 w-full shrink-0 relative z-50">
      <div className="container mx-auto h-20 sm:h-16 px-4 flex items-center justify-between gap-2">
        
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-emerald-200">N</div>
          <span className="hidden lg:block text-lg font-black text-slate-800 tracking-tighter">NutriTrack</span>
        </div>

        <div className="flex-1 flex justify-center items-center overflow-x-auto no-scrollbar mx-2 py-2">
          <div className="flex items-center gap-1.5 whitespace-nowrap px-2">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 px-3 py-2 rounded-2xl transition-all duration-300 ${
                  activeTab === tab.id 
                    ? 'bg-slate-900 text-white shadow-xl scale-105' 
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <span className="text-xl sm:text-lg leading-none">{tab.icon}</span> 
                <span className={`text-[10px] sm:text-xs font-black uppercase tracking-widest ${activeTab === tab.id ? 'block' : 'hidden md:block'}`}>
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          <button 
            onClick={() => setIsSyncModalOpen(true)}
            className={`p-2.5 rounded-xl transition-all active:scale-90 relative ${
              cloudStatus === 'synced' ? 'text-emerald-600 bg-emerald-50' : 
              cloudStatus === 'error' ? 'text-rose-500 bg-rose-50' : 'text-slate-400 bg-slate-50'
            }`}
          >
            {isCloudConfigured && (
              <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${cloudStatus === 'synced' ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`}></span>
            )}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          </button>
          
          <div className="hidden sm:block">
            <NotificationToggle />
          </div>
          
          <button 
            onClick={onLogout} 
            className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
            title="Se déconnecter"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
      
      <SyncModal 
        isOpen={isSyncModalOpen} 
        onClose={() => setIsSyncModalOpen(false)}
        onExport={onExport}
        onImport={onImport}
        onGenerateMagicLink={onGenerateMagicLink}
        onCloudRestore={onCloudRestore}
      />

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </nav>
  );
};

export default Navbar;
