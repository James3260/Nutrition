
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Tab, MealPlan, HistoryEvent } from './types';
import Login from './components/Auth';
import Navbar from './components/Navbar';
import Assistant from './components/Assistant';
import CalendarView from './components/CalendarView';
import ShoppingList from './components/ShoppingList';
import RecipeList from './components/RecipeList';
import ActivityTracker from './components/ActivityTracker';
import AdminPanel from './components/AdminPanel';
import DailyDashboard from './components/DailyDashboard';
import { StorageService } from './services/StorageService';
import { CloudSyncService } from './services/CloudSyncService';
import { IconService } from './services/IconService';
import { NotificationService } from './services/NotificationService';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  image?: string; // Ajout du support image
  concept?: {
    title: string;
    description: string;
    startDate?: string; // Ajout de la date de début
    weeklyPreview?: { 
      day: number, 
      breakfast?: string, breakfastWeight?: string,
      lunch: string, lunchWeight: string, 
      snack?: string, snackWeight?: string,
      dinner: string, dinnerWeight: string 
    }[]; // Ajout du semainier avec poids
  };
  timestamp?: Date;
}

const App: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('assistant');
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [historyLogs, setHistoryLogs] = useState<HistoryEvent[]>([]);
  const [cloudStatus, setCloudStatus] = useState<'off' | 'syncing' | 'synced' | 'error'>('off');
  
  const lastSyncRef = useRef<number>(0);

  const addHistoryEvent = useCallback((action: string, details: string, type: HistoryEvent['type']) => {
    const eventUser = user || { id: 'sys', name: 'Système' };
    const newEvent: HistoryEvent = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      userId: eventUser.id,
      userName: eventUser.name,
      action,
      details,
      type
    };
    setHistoryLogs(prev => [newEvent, ...prev].slice(0, 50));
  }, [user]);

  const refreshAppBranding = useCallback(async () => {
    try {
      const icon = await IconService.generateAppIcon();
      IconService.applyIcon(icon);
      await StorageService.saveData('app_custom_icon', icon);
      addHistoryEvent("Système", "Branding Premium mis à jour", "system");
    } catch (e) {
      console.warn("Échec du branding automatique");
    }
  }, [addHistoryEvent]);

  const syncWithCloud = useCallback(async (force = false) => {
    if (!CloudSyncService.isConfigured()) return;
    setCloudStatus('syncing');
    try {
      const data = await CloudSyncService.pullData();
      
      // Logique de fusion intelligente : On prend le cloud si force=true (nouvelle connexion) 
      // ou si la date de modif du cloud est plus récente
      if (data && (force || (data._last_sync && data._last_sync > lastSyncRef.current))) {
        console.log("📥 Restauration des données depuis le Cloud Google...");
        
        if (data.mealPlan) setMealPlan(data.mealPlan);
        
        if (data.chatMessages) {
          const hydratedMessages = data.chatMessages.map((m: any) => ({
             ...m,
             timestamp: m.timestamp ? new Date(m.timestamp) : undefined
          }));
          setChatMessages(hydratedMessages);
        }
        
        if (data.historyLogs) setHistoryLogs(data.historyLogs);
        
        // Fusion des données utilisateur (ne pas écraser l'auth Google actuelle)
        if (data.userData && user) {
           setUser(prev => ({ 
             ...prev!, 
             ...data.userData, 
             isAuthenticated: true, // Sécurité
             googleId: prev?.googleId // On garde l'ID Google de la session active
           }));
        }
        
        lastSyncRef.current = data._last_sync || Date.now();
        setCloudStatus('synced');
      } else {
        // Cloud à jour ou vide
        setCloudStatus('synced');
      }
    } catch (e) {
      console.error("Erreur Sync:", e);
      setCloudStatus('error');
    }
  }, [user]);

  const pushToCloud = useCallback(async () => {
    if (!CloudSyncService.isConfigured() || isSyncing) return;
    
    // Ne pas pousser si on n'a pas encore de données significatives pour éviter d'écraser le cloud avec du vide au démarrage
    if (!user) return;

    setIsSyncing(true);
    setCloudStatus('syncing');
    try {
      const payload = { chatMessages, mealPlan, historyLogs, userData: user };
      const success = await CloudSyncService.pushData(payload);
      if (success) {
        lastSyncRef.current = Date.now();
        setCloudStatus('synced');
      } else {
        setCloudStatus('error');
      }
    } catch (e) {
      setCloudStatus('error');
    } finally {
      setIsSyncing(false);
    }
  }, [chatMessages, mealPlan, historyLogs, isSyncing, user]);

  // INITIALISATION OPTIMISÉE
  useEffect(() => {
    let isMounted = true;
    
    const init = async () => {
      const safetyTimeout = setTimeout(() => {
        if (isMounted) {
            console.warn("Délai d'initialisation dépassé, affichage forcé.");
            setIsReady(true);
        }
      }, 3000);

      try {
        CloudSyncService.init();
        
        const [savedUser, savedPlan, savedChat, savedIcon] = await Promise.all([
            StorageService.loadData('current_user'),
            StorageService.loadData('plan'),
            StorageService.loadData('chat_history'),
            StorageService.loadData('app_custom_icon')
        ]);

        if (!isMounted) return;

        if (savedIcon) IconService.applyIcon(savedIcon);
        
        if (savedUser) {
          setUser(savedUser);
          // Si l'utilisateur est déjà connecté localement, on re-bind son ID Cloud
          if (savedUser.googleId) {
             CloudSyncService.setUserId(savedUser.googleId);
          }
          
          if (savedPlan) setMealPlan(savedPlan);
          
          if (savedChat) {
             const hydratedChat = savedChat.map((m: any) => ({
               ...m,
               timestamp: m.timestamp ? new Date(m.timestamp) : undefined
             }));
             setChatMessages(hydratedChat);
          }
        }

        clearTimeout(safetyTimeout);
        setIsReady(true);

        // Sync silencieuse en arrière-plan si déjà connecté
        if (savedUser && savedUser.googleId) {
           syncWithCloud(false).catch(err => console.warn("Background sync error:", err));
        }

      } catch (error) {
        console.error("Erreur critique init:", error);
        if (isMounted) setIsReady(true);
      }
    };

    init();
    return () => { isMounted = false; };
  }, []); 

  // Sauvegarde automatique Locale + Cloud
  useEffect(() => {
    if (isReady && user) {
      StorageService.saveData('current_user', user);
      if (mealPlan) StorageService.saveData('plan', mealPlan);
      StorageService.saveData('chat_history', chatMessages);
      
      const timer = setTimeout(() => pushToCloud(), 3000);
      return () => clearTimeout(timer);
    }
  }, [mealPlan, chatMessages, historyLogs, isReady, pushToCloud, user]);

  const handleLogin = async (u: User) => {
    // 1. Définir l'ID Google comme clé unique de base de données
    const userId = u.googleId || u.id;
    CloudSyncService.setUserId(userId);
    
    setUser(u);
    addHistoryEvent("Authentification", `Connecté via Google (${u.name})`, "system");
    
    // 2. FORCER une récupération des données du Cloud AVANT toute autre action
    // Cela garantit que si l'utilisateur change de téléphone, il récupère ses données
    setIsSyncing(true);
    await syncWithCloud(true); 
    setIsSyncing(false);

    if (u.role === 'admin') refreshAppBranding();
  };

  if (!isReady) return (
    <div className="h-screen flex items-center justify-center bg-white text-emerald-500 font-bold animate-pulse">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin"></div>
        <span>NutriTrack AI...</span>
      </div>
    </div>
  );

  if (!user || !user.isAuthenticated) return <Login onLogin={handleLogin} />;

  const isAssistant = activeTab === 'assistant';

  return (
    <div className="flex flex-col h-[100dvh] bg-[#f8fafc] text-slate-900 overflow-hidden">
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={() => { CloudSyncService.disconnect(); setUser(null); }} 
        user={user} 
        cloudStatus={cloudStatus}
        isCloudConfigured={!!user.googleId}
        onCloudRestore={() => syncWithCloud(true)}
      />
      
      <main className="flex-1 mt-16 flex flex-col min-h-0 overflow-hidden relative">
        <div className={`flex-1 w-full min-h-0 ${isAssistant ? 'overflow-hidden flex flex-col' : 'overflow-y-auto p-4 sm:p-8 lg:p-12 max-w-7xl mx-auto'}`}>
          {isAssistant && (
            <Assistant 
              setMealPlan={setMealPlan} 
              user={user} 
              onUpdateUser={setUser} 
              messages={chatMessages} 
              setMessages={setChatMessages}
              cloudStatus={cloudStatus}
            />
          )}
          {activeTab === 'daily' && <DailyDashboard user={user} mealPlan={mealPlan} onUpdateUser={setUser} historyLogs={historyLogs} />}
          {activeTab === 'calendar' && <CalendarView mealPlan={mealPlan} />}
          {activeTab === 'sport' && <ActivityTracker user={user} onUpdateUser={setUser} />}
          {activeTab === 'shopping' && <ShoppingList mealPlan={mealPlan} />}
          {activeTab === 'recipes' && <RecipeList mealPlan={mealPlan} user={user} />}
          {activeTab === 'admin' && user.role === 'admin' && <AdminPanel users={[user]} onUpdateUser={setUser} onCreateUser={() => {}} onDeleteUser={() => {}} isCloudConfigured={true} historyLogs={historyLogs} onManualImport={() => {}} allAppData={{}} onRefreshBranding={refreshAppBranding} />}
        </div>
      </main>
    </div>
  );
};

export default App;
