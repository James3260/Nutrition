
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
      if (data && (force || data._last_sync > lastSyncRef.current)) {
        if (data.mealPlan) setMealPlan(data.mealPlan);
        if (data.chatMessages) setChatMessages(data.chatMessages);
        if (data.historyLogs) setHistoryLogs(data.historyLogs);
        if (data.userData && user) setUser(prev => ({ ...prev!, ...data.userData }));
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

  useEffect(() => {
    const init = async () => {
      CloudSyncService.init();
      const savedUser = await StorageService.loadData('current_user');
      const savedPlan = await StorageService.loadData('plan');
      const savedChat = await StorageService.loadData('chat_history');
      const savedIcon = await StorageService.loadData('app_custom_icon');
      if (savedIcon) IconService.applyIcon(savedIcon);
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
    await syncWithCloud(true);
    if (u.role === 'admin') refreshAppBranding();
  };

  if (!isReady) return (
    <div className="h-screen flex items-center justify-center bg-white text-emerald-500 font-bold">
      NutriTrack AI...
    </div>
  );

  if (!user || !user.isAuthenticated) return <Login onLogin={handleLogin} />;

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-[#f8fafc] text-slate-900 overflow-hidden">
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={() => { CloudSyncService.disconnect(); setUser(null); }} 
        user={user} 
        cloudStatus={cloudStatus}
        isCloudConfigured={CloudSyncService.isConfigured()}
        onCloudRestore={() => syncWithCloud(true)}
      />
      
      {/* 
         Structure de scroll revue : 
         - paddingTop (pt-16) pour compenser le header fixe sur mobile.
         - Si Assistant : overflow-hidden sur main pour laisser Assistant gérer le scroll interne.
         - Sinon : overflow-y-auto sur main pour le scroll global.
      */}
      <main className={`flex-1 min-w-0 relative pt-16 lg:pt-0 ${activeTab === 'assistant' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto no-scrollbar'}`}>
        <div className={`mx-auto w-full ${activeTab === 'assistant' ? 'h-full p-4 sm:p-6 lg:p-12 max-w-7xl' : 'p-4 sm:p-6 lg:p-12 max-w-7xl'}`}>
          {activeTab === 'assistant' && (
            <div className="h-full">
              <Assistant 
                setMealPlan={setMealPlan} 
                user={user} 
                onUpdateUser={setUser} 
                messages={chatMessages} 
                setMessages={setChatMessages} 
              />
            </div>
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
