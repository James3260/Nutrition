
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

interface Message {
  role: 'user' | 'assistant';
  content: string;
  proposedPlan?: MealPlan;
  proposedShortList?: string[];
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

  const syncWithCloud = useCallback(async (force = false) => {
    if (!CloudSyncService.isConfigured()) return;
    
    setCloudStatus('syncing');
    try {
      const data = await CloudSyncService.pullData();
      if (data && (force || data._last_sync > lastSyncRef.current)) {
        if (data.mealPlan) setMealPlan(data.mealPlan);
        if (data.chatMessages) setChatMessages(data.chatMessages);
        if (data.historyLogs) setHistoryLogs(data.historyLogs);
        
        if (data.userData && user) {
           setUser(prev => ({ ...prev!, ...data.userData }));
        }

        lastSyncRef.current = data._last_sync || Date.now();
        setCloudStatus('synced');
      } else {
        setCloudStatus('synced');
      }
    } catch (e) {
      setCloudStatus('error');
    }
  }, [user]);

  const pushToCloud = useCallback(async () => {
    if (!CloudSyncService.isConfigured() || isSyncing) return;
    
    setIsSyncing(true);
    setCloudStatus('syncing');
    try {
      const payload = { 
        chatMessages, 
        mealPlan, 
        historyLogs,
        userData: user ? {
          exclusions: user.exclusions,
          workouts: user.workouts,
          weightHistory: user.weightHistory,
          weightGoal: user.weightGoal,
          hydrationGoal: user.hydrationGoal,
          hydrationRecords: user.hydrationRecords,
          eatenMeals: user.eatenMeals,
          height: user.height,
          age: user.age,
          gender: user.gender,
          baseActivityLevel: user.baseActivityLevel
        } : null
      };
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

  useEffect(() => {
    const init = async () => {
      CloudSyncService.init();
      
      // Tentative de génération de l'icône premium en arrière-plan
      try {
        const savedIcon = await StorageService.loadData('app_icon_base64');
        if (savedIcon) {
          IconService.applyIcon(savedIcon);
        } else {
          // On ne le fait que si l'utilisateur est déjà loggé ou au premier besoin pour ne pas bloquer
          // mais ici on peut tenter de le faire si la clé est déjà là
          if (await window.aistudio.hasSelectedApiKey()) {
            const newIcon = await IconService.generateAppIcon();
            IconService.applyIcon(newIcon);
            await StorageService.saveData('app_icon_base64', newIcon);
          }
        }
      } catch (e) {
        console.warn("Icon generation deferred");
      }

      const savedUser = await StorageService.loadData('current_user');
      const savedPlan = await StorageService.loadData('plan');
      const savedChat = await StorageService.loadData('chat_history');
      
      if (savedUser) {
        setUser(savedUser);
        CloudSyncService.setUserId(savedUser.googleId || savedUser.id);
        if (savedPlan) setMealPlan(savedPlan);
        if (savedChat) setChatMessages(savedChat);
        await syncWithCloud(true);
      }
      setIsReady(true);
    };
    init();
  }, [syncWithCloud]);

  useEffect(() => {
    if (isReady && user) {
      StorageService.saveData('current_user', user);
      if (mealPlan) StorageService.saveData('plan', mealPlan);
      if (chatMessages.length > 0) StorageService.saveData('chat_history', chatMessages);
      
      const timer = setTimeout(() => pushToCloud(), 3000);
      return () => clearTimeout(timer);
    }
  }, [mealPlan, chatMessages, historyLogs, isReady, pushToCloud, user]);

  const handleLogin = async (u: User) => {
    CloudSyncService.setUserId(u.googleId || u.id);
    setUser(u);
    addHistoryEvent("Authentification", `Connecté (${u.name})`, "system");
    
    // Une fois loggé, on génère l'icône si elle n'existe pas
    const savedIcon = await StorageService.loadData('app_icon_base64');
    if (!savedIcon) {
       try {
         const newIcon = await IconService.generateAppIcon();
         IconService.applyIcon(newIcon);
         await StorageService.saveData('app_icon_base64', newIcon);
       } catch(e) {}
    }
    
    await syncWithCloud(true);
  };

  if (!isReady) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#020617] text-white">
      <div className="w-12 h-12 border-4 border-white/5 border-t-emerald-500 rounded-full animate-spin mb-6"></div>
      <p className="tracking-[0.4em] text-[10px] font-black uppercase opacity-40">NutriTrack Premium</p>
    </div>
  );

  if (!user || !user.isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="h-[100dvh] bg-[#020617] flex flex-col overflow-hidden relative font-sans text-slate-200">
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={() => { CloudSyncService.disconnect(); setUser(null); }} 
        user={user} 
        cloudStatus={cloudStatus}
        isCloudConfigured={CloudSyncService.isConfigured()}
        onCloudRestore={() => syncWithCloud(true)}
      />
      
      <main className="flex-1 container mx-auto px-4 py-4 max-w-6xl flex flex-col min-h-0">
        <div className="flex-1 flex flex-col min-h-0">
          {activeTab === 'assistant' && <Assistant setMealPlan={(p) => { setMealPlan(p); addHistoryEvent("IA", "Nouveau plan généré", "meal"); }} user={user} onUpdateUser={(u) => setUser(u)} messages={chatMessages} setMessages={setChatMessages} />}
          {activeTab === 'daily' && <DailyDashboard user={user} mealPlan={mealPlan} onUpdateUser={(u) => setUser(u)} historyLogs={historyLogs} />}
          {activeTab === 'calendar' && <CalendarView mealPlan={mealPlan} />}
          {activeTab === 'sport' && <ActivityTracker user={user} onUpdateUser={(u) => setUser(u)} />}
          {activeTab === 'shopping' && <ShoppingList mealPlan={mealPlan} />}
          {activeTab === 'recipes' && <RecipeList mealPlan={mealPlan} user={user} />}
          {activeTab === 'admin' && user.role === 'admin' && (
            <AdminPanel users={[user]} onUpdateUser={(u) => setUser(u)} onCreateUser={() => {}} onDeleteUser={() => {}} isCloudConfigured={true} historyLogs={historyLogs} onManualImport={() => {}} allAppData={{}} />
          )}
        </div>
      </main>

      <footer className="bg-black/40 backdrop-blur-md border-t border-white/5 py-3 px-8 flex items-center justify-between text-[8px] font-black uppercase tracking-[0.3em] text-slate-600 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/5 text-emerald-500 rounded-full border border-emerald-500/10">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
            <span>SECURE CLOUD : {CloudSyncService.getUserId()?.substr(0, 8)}</span>
          </div>
          <span className="opacity-40">{user.name}</span>
        </div>
        <div className="hidden md:block">NUTRITRACK STUDIO EDITION • 2025</div>
      </footer>
    </div>
  );
};

export default App;
