
import React, { useState, useMemo } from 'react';
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
  onRefreshBranding?: () => void;
}

const ADMIN_EMAIL = "nene2080@icloud.com";

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  users, onUpdateUser, onCreateUser, onDeleteUser, historyLogs, allAppData, onRefreshBranding 
}) => {
  const [copyStatus, setCopyStatus] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isBranding, setIsBranding] = useState(false);
  
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPass, setNewPass] = useState('');
  const [editPass, setEditPass] = useState('');

  const stats = useMemo(() => {
    const totalWorkouts = users.reduce((acc, u) => acc + (u.workouts?.length || 0), 0);
    const totalCaloriesBurned = users.reduce((acc, u) => 
      acc + (u.workouts?.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0) || 0), 0
    );
    const totalMealsEaten = users.reduce((acc, u) => acc + (u.eatenMeals?.length || 0), 0);
    const totalPlansGenerated = historyLogs.filter(h => h.action.includes("plan généré")).length;
    const totalHydration = users.reduce((acc, u) => 
      acc + (u.hydrationRecords?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0), 0
    );

    return {
      userCount: users.length,
      workoutCount: totalWorkouts,
      caloriesBurned: totalCaloriesBurned,
      mealCount: totalMealsEaten,
      planCount: totalPlansGenerated,
      hydrationLiters: Math.round(totalHydration / 1000)
    };
  }, [users, historyLogs]);

  const handleCopyLink = () => {
    const link = CloudSyncService.generateMasterLink();
    navigator.clipboard.writeText(link);
    setCopyStatus(true);
    setTimeout(() => setCopyStatus(false), 3000);
  };

  const handleRefreshBranding = async () => {
    if (!onRefreshBranding) return;
    setIsBranding(true);
    await onRefreshBranding();
    setIsBranding(false);
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
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-24 md:pb-12 px-2 md:px-0">
      
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-12 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
        <div className="relative z-10 flex flex-col xl:flex-row items-center justify-between gap-6 md:gap-8">
          <div className="space-y-3 md:space-y-4 text-center xl:text-left">
            <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">Gestion Famille</h2>
            <p className="text-emerald-50 opacity-80 text-xs md:text-sm max-w-sm mx-auto xl:mx-0">Synchronisez et gérez les comptes de vos proches.</p>
            <div className="flex flex-wrap justify-center xl:justify-start gap-2 md:gap-3 pt-2 md:pt-4">
               <button onClick={handleCopyLink} className={`px-4 md:px-8 py-3 md:py-5 rounded-xl md:rounded-2xl font-black text-[9px] md:text-[11px] uppercase tracking-widest transition-all ${copyStatus ? 'bg-white text-emerald-600' : 'bg-slate-900 text-white'}`}>{copyStatus ? 'Copié !' : 'Partager'}</button>
               <button onClick={() => CloudSyncService.exportToFile(allAppData)} className="px-4 md:px-6 py-3 md:py-5 bg-white/20 text-white rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] uppercase">Export</button>
               <button onClick={handleRefreshBranding} disabled={isBranding} className="px-4 md:px-6 py-3 md:py-5 bg-white text-emerald-600 rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] uppercase">{isBranding ? '...' : 'Logo IA'}</button>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl md:rounded-[2rem] p-4 md:p-6 border border-white/20 w-full xl:w-auto text-center">
             <div className="text-2xl md:text-4xl mb-1 md:mb-2">🏘️</div>
             <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest opacity-60">ID CLOUD ACTIF</p>
             <p className="text-base md:text-xl font-black font-mono tracking-widest truncate">{CloudSyncService.getVaultId()?.split('_')[1] || '---'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[
          { label: 'Membres', val: stats.userCount, icon: '👥', color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Plans IA', val: stats.planCount, icon: '🤖', color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Sport (kcal)', val: stats.caloriesBurned.toLocaleString(), icon: '🔥', color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Eau (L)', val: stats.hydrationLiters, icon: '💧', color: 'text-cyan-600', bg: 'bg-cyan-50' }
        ].map((s, i) => (
          <div key={i} className="bg-white p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-slate-100 shadow-sm text-center">
            <div className={`w-10 h-10 md:w-12 md:h-12 ${s.bg} rounded-xl md:rounded-2xl flex items-center justify-center text-lg md:text-xl mx-auto mb-3`}>{s.icon}</div>
            <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
            <p className={`text-xl md:text-3xl font-black ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        <div className="lg:col-span-7 space-y-6">
           <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] shadow-sm border border-slate-100 p-6 md:p-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div><h3 className="text-base md:text-lg font-black text-slate-900">Membres</h3><p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Accès sécurisés</p></div>
                <button onClick={() => setShowAddUser(!showAddUser)} className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest">{showAddUser ? 'Fermer' : '+ Ajouter'}</button>
              </div>

              {showAddUser && (
                <form onSubmit={handleAddSubmit} className="mb-6 p-4 md:p-6 bg-slate-50 rounded-2xl md:rounded-3xl border border-emerald-100 space-y-3 md:space-y-4 animate-in slide-in-from-top-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Prénom" className="px-4 py-2 md:py-3 rounded-xl border border-slate-200 text-xs md:text-sm outline-none" /><input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email" className="px-4 py-2 md:py-3 rounded-xl border border-slate-200 text-xs md:text-sm outline-none" /></div>
                  <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Mot de passe" className="w-full px-4 py-2 md:py-3 rounded-xl border border-slate-200 text-xs md:text-sm outline-none" /><button type="submit" className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase">Confirmer</button>
                </form>
              )}

              <div className="space-y-2 md:space-y-3">
                {users.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-3 md:p-4 bg-slate-50 rounded-xl md:rounded-2xl border border-slate-100 group">
                    <div className="flex items-center gap-3 md:gap-4"><div className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-lg md:rounded-xl flex items-center justify-center font-black text-emerald-600 shadow-sm">{u.picture ? <img src={u.picture} className="w-full h-full rounded-lg md:rounded-xl object-cover" /> : u.name[0]}</div><div className="min-w-0"><p className="text-xs md:text-sm font-black text-slate-800 flex items-center gap-2 truncate">{u.name} {u.role === 'admin' && <span className="text-[7px] bg-slate-900 text-white px-1.5 py-0.5 rounded-full uppercase tracking-widest">Admin</span>}</p><p className="text-[9px] md:text-[10px] text-slate-400 font-bold truncate">{u.email}</p></div></div>
                    <div className="flex gap-1 md:gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"><button onClick={() => setEditingUser(u)} className="p-1.5 md:p-2 text-slate-400 hover:text-emerald-500 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                    {u.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase() && (<button onClick={() => onDeleteUser(u.id)} className="p-1.5 md:p-2 text-slate-400 hover:text-rose-500 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>)}</div>
                  </div>
                ))}
              </div>
           </div>
        </div>
        <div className="lg:col-span-5"><HistoryLog events={historyLogs} title="Audit Admin" /></div>
      </div>
    </div>
  );
};

export default AdminPanel;
