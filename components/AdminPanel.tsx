
import React, { useState } from 'react';
import { User, HistoryEvent } from '../types';
import { CloudSyncService } from '../services/CloudSyncService';
import HistoryLog from './HistoryLog';

interface AdminPanelProps {
  users: User[];
  onUpdateUser: (updatedUser: User) => void;
  onCreateUser: (name: string, email: string, password: string) => void;
  onDeleteUser: (userId: string) => void;
  isCloudConfigured: boolean;
  historyLogs: HistoryEvent[];
  onManualImport: (data: any) => void;
  allAppData: any;
}

const ADMIN_EMAIL = "nene2080@icloud.com";

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  users, onUpdateUser, onCreateUser, onDeleteUser, historyLogs, allAppData 
}) => {
  const [copyStatus, setCopyStatus] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Form states
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPass, setNewPass] = useState('');
  const [editPass, setEditPass] = useState('');

  const handleCopyLink = () => {
    const link = CloudSyncService.generateMasterLink();
    navigator.clipboard.writeText(link);
    setCopyStatus(true);
    setTimeout(() => setCopyStatus(false), 3000);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail || !newPass) return;
    onCreateUser(newName, newEmail, newPass);
    setNewName(''); setNewEmail(''); setNewPass('');
    setShowAddUser(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser && editPass) {
      onUpdateUser({ ...editingUser, password: editPass });
      setEditingUser(null);
      setEditPass('');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* SECTION CLOUD ID */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-[2.5rem] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-4 text-center md:text-left">
            <h2 className="text-3xl font-black uppercase tracking-tighter">Gestion Famille</h2>
            <p className="text-emerald-50 opacity-80 text-sm max-w-sm">
              Synchronisez les données et gérez les comptes de vos proches.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
               <button 
                  onClick={handleCopyLink}
                  className={`px-8 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-2xl flex items-center justify-center gap-3 ${
                    copyStatus ? 'bg-white text-emerald-600' : 'bg-slate-900 text-white hover:scale-105'
                  }`}
                >
                  {copyStatus ? 'Lien copié !' : 'Lien de Partage'}
                </button>
                <button onClick={() => CloudSyncService.exportToFile(allAppData)} className="px-6 py-5 bg-white/20 hover:bg-white/30 text-white rounded-2xl font-black text-[10px] uppercase transition-all backdrop-blur-md">
                  Backup (.json)
                </button>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-xl rounded-[2rem] p-6 border border-white/20 w-full md:w-auto text-center">
             <div className="text-4xl mb-2">🏘️</div>
             <p className="text-[10px] font-black uppercase tracking-widest opacity-60">ID CLOUD</p>
             <p className="text-xl font-black">{CloudSyncService.getVaultId()?.split('_')[1] || '---'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
           <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black text-slate-900">Membres autorisés</h3>
                <button 
                  onClick={() => setShowAddUser(!showAddUser)}
                  className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all"
                >
                  {showAddUser ? 'Fermer' : '+ Ajouter'}
                </button>
              </div>

              {showAddUser && (
                <form onSubmit={handleAddSubmit} className="mb-8 p-6 bg-slate-50 rounded-3xl border border-emerald-100 space-y-4 animate-in slide-in-from-top-4">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Nouveau Membre</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Prénom" className="px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-500" />
                    <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email" className="px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-500" />
                  </div>
                  <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Mot de passe" className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-500" />
                  <button type="submit" className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-100">Confirmer la création</button>
                </form>
              )}

              <div className="space-y-3">
                {users.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-emerald-600 shadow-sm">{u.name[0]}</div>
                      <div>
                        <p className="text-sm font-black text-slate-800 flex items-center gap-2">
                          {u.name} 
                          {u.role === 'admin' && <span className="text-[8px] bg-slate-900 text-white px-1.5 py-0.5 rounded-full uppercase tracking-widest">Admin</span>}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditingUser(u)} className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      {u.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase() && (
                        <button onClick={() => onDeleteUser(u.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
           </div>

           {editingUser && (
             <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                <form onSubmit={handleEditSubmit} className="bg-white w-full max-w-sm p-10 rounded-[3rem] shadow-2xl animate-in zoom-in-95">
                  <h4 className="text-xl font-black text-slate-900 mb-2">Modifier l'accès</h4>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-8">Pour : {editingUser.name}</p>
                  
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nouveau mot de passe</label>
                      <input type="password" value={editPass} onChange={e => setEditPass(e.target.value)} placeholder="••••••••" className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-emerald-500/20 rounded-2xl text-slate-900 font-medium outline-none transition-all" />
                    </div>
                    <div className="flex gap-3">
                      <button type="submit" className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Enregistrer</button>
                      <button type="button" onClick={() => setEditingUser(null)} className="px-6 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest">Annuler</button>
                    </div>
                  </div>
                </form>
             </div>
           )}
        </div>
        
        <div className="lg:col-span-5">
           <HistoryLog events={historyLogs} title="Journal Admin" />
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
