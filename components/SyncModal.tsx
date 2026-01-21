
import React, { useState, useEffect } from 'react';
import { CloudSyncService } from '../services/CloudSyncService';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCloudRestore: () => void;
}

const SyncModal: React.FC<SyncModalProps> = ({ isOpen, onClose, onCloudRestore }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [manualId, setManualId] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleCreateCloud = async () => {
    setIsCreating(true);
    // Updated: using ensureVaultExists instead of createNewVault
    const id = await CloudSyncService.ensureVaultExists();
    if (id) {
      onCloudRestore();
    } else {
      setError("Impossible de créer le Cloud. Vérifiez votre connexion.");
    }
    setIsCreating(false);
  };

  const handleConnectManual = () => {
    if (manualId.length < 5) {
      setError("Code invalide.");
      return;
    }
    CloudSyncService.setVaultId(manualId);
    onCloudRestore();
    onClose();
  };

  const handleCopyLink = () => {
    const link = CloudSyncService.generateMasterLink();
    navigator.clipboard.writeText(link);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 3000);
  };

  const isConnected = CloudSyncService.isConfigured();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100">
        
        {/* Header Style App Store */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-8 text-white relative">
          <h3 className="text-2xl font-black flex items-center gap-3">
            <span className="text-3xl">☁️</span> NutriCloud
          </h3>
          <p className="text-emerald-100 text-[10px] font-black uppercase tracking-widest mt-1">Synchronisation Familiale</p>
          <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-8 space-y-6">
          {error && (
            <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl text-[10px] font-black uppercase text-center border border-rose-100 animate-pulse">
              ⚠️ {error}
            </div>
          )}

          {!isConnected ? (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <p className="text-slate-500 text-sm font-medium">Activez le Cloud pour partager vos menus avec votre famille sur d'autres téléphones.</p>
              </div>
              
              <button 
                onClick={handleCreateCloud}
                disabled={isCreating}
                className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all flex items-center justify-center gap-3"
              >
                {isCreating ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : "Activer mon Cloud Gratuit"}
              </button>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-slate-100"></div>
                <span className="flex-shrink mx-4 text-[9px] font-black text-slate-300 uppercase tracking-widest">OU REJOINDRE</span>
                <div className="flex-grow border-t border-slate-100"></div>
              </div>

              <div className="space-y-3">
                <input 
                  type="text" 
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  placeholder="Coller le Code Cloud ici..." 
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 focus:border-emerald-500 rounded-2xl text-center font-black text-slate-700 outline-none transition-all uppercase"
                />
                <button 
                  onClick={handleConnectManual}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all"
                >
                  Se connecter au Cloud existant
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in zoom-in-95 duration-300">
              <div className="p-6 bg-emerald-50 rounded-[2.5rem] border-2 border-emerald-100 text-center">
                 <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm text-2xl">✅</div>
                 <h4 className="font-black text-slate-800 text-lg">Cloud Activé</h4>
                 <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mt-1">Synchronisation en temps réel</p>
                 
                 <div className="mt-6 p-4 bg-white rounded-2xl border border-emerald-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Votre Code Cloud Unique</p>
                    <p className="text-xl font-black text-slate-900 tracking-wider select-all">{CloudSyncService.getVaultId()}</p>
                 </div>
              </div>

              <button 
                onClick={handleCopyLink}
                className={`w-full py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 ${
                  copySuccess ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'
                }`}
              >
                {copySuccess ? 'Lien copié ! ✅' : 'Copier le Lien Magique'}
              </button>

              <button 
                onClick={() => { CloudSyncService.disconnect(); onCloudRestore(); }}
                className="w-full py-3 text-slate-400 font-black text-[9px] uppercase hover:text-rose-500 transition-colors"
              >
                Déconnecter ce téléphone du Cloud
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SyncModal;
