
import React, { useState } from 'react';
import { CloudSyncService } from '../services/CloudSyncService';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCloudRestore: () => void;
}

const SyncModal: React.FC<SyncModalProps> = ({ isOpen, onClose, onCloudRestore }) => {
  const [manualId, setManualId] = useState('');
  const [error, setError] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  if (!isOpen) return null;

  const currentId = CloudSyncService.getUserId();
  const isGoogleLinked = currentId && !currentId.startsWith('nutri_'); // Si l'ID ne commence pas par "nutri_", c'est un ID Google

  const handleCopyLink = () => {
    const link = CloudSyncService.generateMasterLink();
    navigator.clipboard.writeText(link);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 3000);
  };

  const handleManualConnect = () => {
    if (manualId.length < 5) {
      setError("Code invalide.");
      return;
    }
    CloudSyncService.setUserId(manualId);
    onCloudRestore();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100">
        
        {/* Header Style */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-8 text-white relative">
          <h3 className="text-2xl font-black flex items-center gap-3">
            <span className="text-3xl">☁️</span> Google Cloud
          </h3>
          <p className="text-blue-100 text-[10px] font-black uppercase tracking-widest mt-1">Synchronisation Active</p>
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

          {isGoogleLinked ? (
            <div className="space-y-6 animate-in zoom-in-95 duration-300">
              <div className="p-6 bg-blue-50 rounded-[2.5rem] border-2 border-blue-100 text-center">
                 <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm text-3xl">✅</div>
                 <h4 className="font-black text-slate-800 text-lg">Compte Synchronisé</h4>
                 <p className="text-xs text-blue-600 font-medium mt-2 leading-relaxed">
                   Vos données sont sauvegardées automatiquement sur votre compte Google. Connectez-vous simplement sur un autre appareil pour tout retrouver.
                 </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                 <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Votre Identifiant Unique</p>
                 <p className="font-mono text-xs text-slate-600 break-all">{currentId}</p>
              </div>

              <button 
                onClick={onCloudRestore}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
              >
                Forcer la synchronisation maintenant
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                 <p className="text-slate-500 text-sm">Vous utilisez un compte invité. Pour une synchronisation parfaite, connectez-vous avec Google.</p>
              </div>
              
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-slate-100"></div>
                <span className="flex-shrink mx-4 text-[9px] font-black text-slate-300 uppercase tracking-widest">OU MANUEL</span>
                <div className="flex-grow border-t border-slate-100"></div>
              </div>

              <input 
                  type="text" 
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  placeholder="Code de récupération..." 
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 focus:border-blue-500 rounded-2xl text-center font-black text-slate-700 outline-none transition-all"
                />
                <button 
                  onClick={handleManualConnect}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg"
                >
                  Restaurer manuellement
                </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SyncModal;
