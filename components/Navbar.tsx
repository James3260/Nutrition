
import React from 'react';
import { Tab, User } from '../types';
import NotificationToggle from './NotificationToggle';

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
  activeTab, setActiveTab, onLogout, user, cloudStatus, isCloudConfigured, onCloudRestore 
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
    <nav className="bg-white shadow-sm border-b border-slate-100 w-full shrink-0 relative z-50">
      <div className="container mx-auto h-16 px-4 flex items-center justify-between gap-4">
        
        {/* Logo Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-emerald-100">N</div>
        </div>

        {/* Tab Icons Only */}
        <div className="flex-1 flex justify-center items-center overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 p-1.5 bg-slate-50 rounded-2xl">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-300 ${
                  activeTab === tab.id 
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-200 scale-105' 
                    : 'text-slate-400 hover:text-slate-600 hover:bg-white'
                }`}
              >
                <span className="text-xl">{tab.icon}</span>
              </button>
            ))}
          </div>
        </div>

        {/* System Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button 
            onClick={onCloudRestore}
            title="Synchronisation Cloud"
            className={`p-2.5 rounded-xl transition-all ${cloudStatus === 'synced' ? 'text-emerald-500 bg-emerald-50' : 'text-slate-300 hover:bg-slate-50'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          </button>
          
          <NotificationToggle />
          
          <button 
            onClick={onLogout} 
            title="Déconnexion"
            className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    </nav>
  );
};

export default Navbar;
