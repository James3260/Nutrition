
import React, { useState } from 'react';
import { User } from '../types';
import { IconService } from '../services/IconService';
import { CloudSyncService } from '../services/CloudSyncService';

interface AdminPanelProps {
  users: User[];
  onUpdateUser: (updatedUser: User) => void;
  onCreateUser: (name: string, email: string, password: string) => void;
  onDeleteUser: (userId: string) => void;
  isCloudConfigured: boolean;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ users, onUpdateUser, onCreateUser, onDeleteUser, isCloudConfigured }) => {
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isGeneratingIcon, setIsGeneratingIcon] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName && newEmail && newPassword) {
      onCreateUser(newName, newEmail, newPassword);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
    }
  };

  const handleGenerateIcon = async () => {
    setIsGeneratingIcon(true);
    try {
      const icon = await IconService.generateAppIcon();
      IconService.applyIcon(icon);
      alert("Nouvelle icône générée et appliquée !");
    } catch (e) {
      alert("Erreur Gemini.");
    } finally {
      setIsGeneratingIcon(false);
    }
  };

  const handleCopySetupLink = () => {
    const link = CloudSyncService.generateSetupLink();
    if (link) {
      navigator.clipboard.writeText(link);
      alert("Lien de synchronisation copié ! Ouvrez-le sur votre autre appareil pour connecter automatiquement vos clés Cloud.");
    } else {
      alert("Configurez d'abord Supabase.");
    }
  };

  const handleCopyAppUrl = () => {
    const url = window.location.origin + window.location.pathname;
    navigator.clipboard.writeText(url);
    alert("URL de l'application copiée !");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-emerald-500 transition-all">
           <div>
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Branding</h3>
             <p className="text-sm font-black text-slate-800 mt-1">Icône App par IA</p>
           </div>
           <button onClick={handleGenerateIcon} disabled={isGeneratingIcon} className="mt-4 px-6 py-3 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-100 transition-all disabled:opacity-50">
             {isGeneratingIcon ? 'Génération...' : 'Régénérer ✨'}
           </button>
        </div>
        
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-emerald-500 transition-all">
           <div>
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Multi-Appareils</h3>
             <p className="text-sm font-black text-slate-800 mt-1">Transférer mes Clés</p>
           </div>
           <button onClick={handleCopySetupLink} className="mt-4 px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-slate-800 transition-all shadow-lg shadow-slate-100">
             Lien de Sync 🔗
           </button>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-emerald-500 transition-all">
           <div>
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Partage Rapide</h3>
             <p className="text-sm font-black text-slate-800 mt-1">URL de l'Application</p>
           </div>
           <button onClick={handleCopyAppUrl} className="mt-4 px-6 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">
             Copier l'URL 🌐
           </button>
        </div>
      </div>

      {/* Deployment & PWA Info */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row gap-10">
          <div className="flex-1 space-y-4">
             <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
               <span className="text-2xl">📱</span> Installer NutriTrack
             </h2>
             <p className="text-sm text-slate-300 font-medium leading-relaxed">
               Votre application est prête à être installée sur votre téléphone. Pour une expérience optimale (sans barre de navigation de navigateur), suivez ces étapes :
             </p>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
               <div className="bg-white/5 p-5 rounded-2xl border border-white/10">
                 <p className="text-[10px] font-black text-emerald-400 uppercase mb-3">Sur iPhone (Safari)</p>
                 <ol className="text-[11px] space-y-2 font-bold list-decimal pl-4">
                   <li>Appuyez sur le bouton <span className="text-emerald-400">Partager</span> (carré avec flèche)</li>
                   <li>Faites défiler et choisissez <span className="text-emerald-400">Sur l'écran d'accueil</span></li>
                   <li>Cliquez sur <span className="text-emerald-400">Ajouter</span></li>
                 </ol>
               </div>
               <div className="bg-white/5 p-5 rounded-2xl border border-white/10">
                 <p className="text-[10px] font-black text-emerald-400 uppercase mb-3">Sur Android (Chrome)</p>
                 <ol className="text-[11px] space-y-2 font-bold list-decimal pl-4">
                   <li>Appuyez sur les <span className="text-emerald-400">3 points</span> verticaux</li>
                   <li>Choisissez <span className="text-emerald-400">Installer l'application</span></li>
                   <li>Confirmez l'installation</li>
                 </ol>
               </div>
             </div>
          </div>
          <div className="hidden lg:flex w-40 flex-col items-center justify-center gap-4 bg-white/5 rounded-3xl p-6 border border-white/10">
             <div className="w-20 h-20 bg-emerald-500 rounded-2xl flex items-center justify-center text-4xl shadow-inner">📲</div>
             <p className="text-[8px] font-black uppercase text-center opacity-40">Version PWA v2.8 Ready</p>
          </div>
        </div>
        <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {!isCloudConfigured && (
        <div className="bg-amber-50 border-2 border-amber-200 p-8 rounded-[2rem] space-y-4 shadow-sm animate-in zoom-in-95">
          <h3 className="font-black text-amber-800 uppercase text-xs tracking-widest flex items-center gap-2">
            <span>⚠️</span> Configuration Supabase Indispensable
          </h3>
          <p className="text-xs text-amber-700 leading-relaxed font-bold">
            Sans base de données configurée, vos données restent bloquées sur cet appareil uniquement. Créez la table <code className="bg-amber-200 px-1.5 py-0.5 rounded">backups</code> sur Supabase :
          </p>
          <ul className="text-[11px] text-amber-800 space-y-2 font-mono bg-white/50 p-4 rounded-xl">
            <li>• email (text, PK)</li>
            <li>• payload (jsonb)</li>
            <li>• updated_at (timestamptz)</li>
          </ul>
        </div>
      )}

      {/* User Management */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 px-8 py-6 text-white flex justify-between items-center">
          <h2 className="text-lg font-black uppercase tracking-tight">Gestion des Membres</h2>
          <span className="bg-emerald-500 text-[10px] font-black px-3 py-1 rounded-full">{users.length} COMPTES</span>
        </div>
        
        <form onSubmit={handleCreate} className="p-8 grid grid-cols-1 md:grid-cols-4 gap-6 items-end bg-slate-50/30 border-b border-slate-100">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Nom</label>
            <input required type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-100 outline-none focus:border-emerald-500 bg-white font-bold" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Email</label>
            <input required type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-100 outline-none focus:border-emerald-500 bg-white font-bold" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Pass</label>
            <input required type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-100 outline-none focus:border-emerald-500 bg-white font-bold" />
          </div>
          <button className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase hover:bg-emerald-700 shadow-lg shadow-emerald-50">Ajouter</button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase">Profil</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase">Statut</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-black">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                         <p className="font-black text-slate-800 text-sm">{user.name}</p>
                         <p className="text-[10px] text-slate-400 font-bold">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-full ${user.status === 'authorized' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {user.status === 'authorized' ? 'Autorisé' : 'En attente'}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    {user.email !== 'admin@nutritrack.com' && (
                      <button onClick={() => onDeleteUser(user.id)} className="text-slate-300 hover:text-red-500 font-black text-[10px] uppercase transition-colors">Retirer</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
