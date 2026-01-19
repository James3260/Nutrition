
import React, { useState, useEffect } from 'react';
import { CloudSyncService } from '../services/CloudSyncService';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: () => void;
  onImport: (data: string) => void;
  onGenerateMagicLink: () => void;
  onCloudRestore: () => void;
}

const SyncModal: React.FC<SyncModalProps> = ({ 
  isOpen, onClose, onExport, onImport, onGenerateMagicLink, onCloudRestore 
}) => {
  const [isSuccess, setIsSuccess] = useState(false);
  const [showCloudConfig, setShowCloudConfig] = useState(false);
  const [cloudUrl, setCloudUrl] = useState('');
  const [cloudKey, setCloudKey] = useState('');

  useEffect(() => {
    const config = CloudSyncService.getConfig();
    if (config) {
      setCloudUrl(config.url);
      setCloudKey(config.key);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveCloudConfig = async () => {
    if (cloudUrl && cloudKey) {
      await CloudSyncService.setConfig(cloudUrl, cloudKey);
      setIsSuccess(true);
      setTimeout(() => { 
        setIsSuccess(false); 
        setShowCloudConfig(false); 
        onCloudRestore(); 
      }, 1500);
    }
  };

  const handleCopyAppUrl = () => {
    const url = window.location.origin + window.location.pathname;
    navigator.clipboard.writeText(url);
    alert("URL de l'application copiée !");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-emerald-100">
        <div className="bg-emerald-600 p-8 text-white relative">
          <h3 className="text-2xl font-black">Accès & Synchronisation</h3>
          <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest mt-1">Utilisez l'app partout</p>
          <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-8 space-y-6">
          {isSuccess ? (
            <div className="py-10 text-center space-y-4">
              <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center text-4xl mx-auto shadow-lg animate-bounce">✓</div>
              <p className="font-black text-slate-800 uppercase tracking-widest text-xs">Cloud Connecté & Actif</p>
            </div>
          ) : showCloudConfig ? (
            <div className="space-y-4 animate-in slide-in-from-right-10 duration-300">
               <button onClick={() => setShowCloudConfig(false)} className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1 mb-2 hover:text-emerald-500 transition-colors">
                 ← Retour
               </button>
               <h4 className="text-sm font-black text-slate-800">Clés de Synchronisation</h4>
               <div className="space-y-3 pt-2">
                 <input 
                   type="text" 
                   value={cloudUrl} 
                   onChange={e => setCloudUrl(e.target.value)} 
                   placeholder="URL Supabase (https://...)" 
                   className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-emerald-500 font-bold"
                 />
                 <input 
                   type="password" 
                   value={cloudKey} 
                   onChange={e => setCloudKey(e.target.value)} 
                   placeholder="Clé API (anon key)" 
                   className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-emerald-500 font-bold"
                 />
                 <button 
                   onClick={handleSaveCloudConfig}
                   className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100"
                 >
                   Enregistrer & Connecter
                 </button>
               </div>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                 <div className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lien de l'Application</h4>
                    <button 
                      onClick={handleCopyAppUrl}
                      className="w-full py-3.5 bg-white border-2 border-slate-200 text-slate-800 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:border-emerald-500 transition-all shadow-sm flex items-center justify-center gap-2"
                    >
                      <span>🌐</span> Copier l'URL d'accès
                    </button>
                    <p className="text-[8px] text-slate-400 text-center font-bold px-4">
                      Utilisez cette URL pour ouvrir l'app sur n'importe quel navigateur.
                    </p>
                 </div>

                 <div className="p-5 bg-emerald-50/50 rounded-[2rem] border border-emerald-100 space-y-3">
                    <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest ml-1">Synchronisation auto</h4>
                    <button 
                      onClick={onGenerateMagicLink}
                      className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center gap-3"
                    >
                      <span>✨</span> Synchroniser un appareil
                    </button>
                    <p className="text-[8px] text-emerald-600/70 text-center font-bold px-4 leading-tight">
                      Génère un lien contenant vos clés cloud pour tout connecter instantanément.
                    </p>
                 </div>
              </div>

              {!CloudSyncService.isConfigured() && (
                <button 
                  onClick={() => setShowCloudConfig(true)}
                  className="w-full py-3 text-emerald-600 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-50 rounded-xl transition-all"
                >
                  Gérer les clés Supabase
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SyncModal;
