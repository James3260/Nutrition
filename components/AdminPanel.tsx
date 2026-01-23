
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
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-10">
      
      {/* Admin Header Card */}
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 rounded-[1.8rem] sm:rounded-[2.5rem] p-6 sm:p-10 md:p-12 text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="space-y-4 text-center lg:text-left w-full lg:w-auto">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-none">Gestion Famille</h2>
            <p className="text-emerald-100 opacity-70 text-[10px] sm:text-xs md:text-sm max-w-sm mx-auto lg:mx-0 font-medium leading-relaxed uppercase tracking-widest">Contrôle premium et synchronisation multicanale active.</p>
            <div className="flex flex-wrap justify-center lg:justify-start gap-2.5 sm:gap-3 pt-2">
               <button onClick={handleCopyLink} className={`px-5 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg ${copyStatus ? 'bg-white text-emerald-600' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>{copyStatus ? 'Copié ! ✅' : 'Partager'}</button>
               <button onClick={() => CloudSyncService.exportToFile(allAppData)} className="px-4 sm:px-6 py-3.5 sm:py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl sm:rounded-2xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest border border-white/10 transition-colors">Export</button>
               <button onClick={handleRefreshBranding} disabled={isBranding} className="px-4 sm:px-6 py-3.5 sm:py-4 bg-white text-emerald-600 rounded-xl sm:rounded-2xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest shadow-xl hover:bg-emerald-50 transition-colors">{isBranding ? 'Génération...' : 'Logo IA'}</button>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-2xl rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-7 border border-white/20 w-full lg:w-auto text-center shadow-inner group-hover:scale-105 transition-transform duration-500">
             <div className="text-3xl sm:text-4xl mb-2">🏘️</div>
             <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-1">Vault ID Actif</p>
             <p className="text-sm sm:text-xl font-black font-mono tracking-[0.2em] truncate">{CloudSyncService.getVaultId()?.split('_')[1] || '---'}</p>
          </div>
        </div>
      </div>

      {/* Admin Stats - Grid 2x2 on small, 4x1 on large */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[
          { label: 'Membres', val: stats.userCount, icon: '👥', color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Plans IA', val: stats.planCount, icon: '🤖', color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Brûlé (kcal)', val: stats.caloriesBurned.toLocaleString(), icon: '🔥', color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Eau (L)', val: stats.hydrationLiters, icon: '💧', color: 'text-cyan-600', bg: 'bg-cyan-50' }
        ].map((s, i) => (
          <div key={i} className="bg-white p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-100 shadow-sm text-center hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 ${s.bg} rounded-xl sm:rounded-2xl flex items-center justify-center text-lg sm:text-xl mx-auto mb-3 shadow-sm`}>{s.icon}</div>
            <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 truncate px-1">{s.label}</p>
            <p className={`text-lg sm:text-2xl md:text-3xl font-black ${s.color} truncate`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Main Admin Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* User Management */}
        <div className="lg:col-span-7 space-y-6">
           <div className="bg-white rounded-[1.8rem] sm:rounded-[2.5rem] shadow-sm border border-slate-100 p-5 sm:p-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-none">Membres Actifs</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-2">Accès restreints par rôle</p>
                </div>
                <button onClick={() => setShowAddUser(!showAddUser)} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">
                  {showAddUser ? 'Annuler' : '+ Membre'}
                </button>
              </div>

              {showAddUser && (
                <form onSubmit={handleAddSubmit} className="mb-8 p-5 sm:p-6 bg-slate-50 rounded-[1.5rem] sm:rounded-[2rem] border border-emerald-100 space-y-4 animate-in slide-in-from-top-4 duration-500">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nom d'usage" className="px-5 py-3 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:border-emerald-500 bg-white" />
                    <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email / ID" className="px-5 py-3 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:border-emerald-500 bg-white" />
                  </div>
                  <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Mot de passe confidentiel" className="w-full px-5 py-3 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:border-emerald-500 bg-white" />
                  <button type="submit" className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-50 active:scale-95">Valider la création</button>
                </form>
              )}

              <div className="space-y-3">
                {users.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-3 sm:p-4 bg-slate-50/50 rounded-xl sm:rounded-2xl border border-slate-100 group hover:bg-white hover:border-emerald-100 transition-all shadow-sm hover:shadow-md">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-xl sm:rounded-2xl flex items-center justify-center font-black text-emerald-600 shadow-sm shrink-0">
                        {u.picture ? <img src={u.picture} className="w-full h-full rounded-xl sm:rounded-2xl object-cover" /> : u.name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2 truncate">
                          {u.name} 
                          {u.role === 'admin' && <span className="text-[7px] bg-slate-900 text-white px-2 py-0.5 rounded-full uppercase tracking-widest font-black">Admin</span>}
                        </p>
                        <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold truncate tracking-tight">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 sm:gap-2 shrink-0">
                      <button onClick={() => setEditingUser(u)} className="p-2 text-slate-400 hover:text-emerald-500 rounded-lg transition-colors active:scale-90">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      {u.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase() && (
                        <button onClick={() => onDeleteUser(u.id)} className="p-2 text-slate-400 hover:text-rose-500 rounded-lg transition-colors active:scale-90">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
           </div>
        </div>

        {/* Audit Log */}
        <div className="lg:col-span-5">
          <HistoryLog events={historyLogs} title="Audit Sécurité" />
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
