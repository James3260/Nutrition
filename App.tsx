
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
import { BiometricService } from './services/BiometricService';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  proposedPlan?: MealPlan;
  proposedShortList?: string[];
}

const ADMIN_EMAIL = "nene2080@icloud.com";
const DEFAULT_ADMIN_PASS = "admin14";

const App: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('daily');
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
        if (data.allUsers) setAllUsers(data.allUsers);
        if (data.historyLogs) setHistoryLogs(data.historyLogs);
        lastSyncRef.current = data._last_sync;
        setCloudStatus('synced');
      } else {
        setCloudStatus('synced');
      }
    } catch (e) {
      setCloudStatus('error');
    }
  }, []);

  const pushToCloud = useCallback(async () => {
    if (!CloudSyncService.isConfigured() || isSyncing) return;
    
    setIsSyncing(true);
    setCloudStatus('syncing');
    try {
      const payload = { allUsers, chatMessages, mealPlan, historyLogs };
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
  }, [allUsers, chatMessages, mealPlan, historyLogs, isSyncing]);

  useEffect(() => {
    const init = async () => {
      await CloudSyncService.init();
      
      const [savedUser, savedUsersList, savedPlan, savedChat, savedLogs] = await Promise.all([
        StorageService.loadData('current_user'),
        StorageService.loadData('all_users'),
        StorageService.loadData('plan'),
        StorageService.loadData('chat_history'),
        StorageService.loadData('history_logs')
      ]);

      if (savedUser) setUser(savedUser);
      
      if (savedUsersList && savedUsersList.length > 0) {
        setAllUsers(savedUsersList);
      } else {
        // Init avec admin par défaut ET son mot de passe
        setAllUsers([{
          id: btoa(ADMIN_EMAIL),
          name: 'Admin',
          email: ADMIN_EMAIL,
          password: DEFAULT_ADMIN_PASS,
          role: 'admin',
          status: 'authorized',
          isAuthenticated: false,
          exclusions: [],
          workouts: [],
          weightHistory: [],
          hydrationRecords: [],
          eatenMeals: []
        }]);
      }
      
      if (savedPlan) setMealPlan(savedPlan);
      if (savedChat) setChatMessages(savedChat);
      if (savedLogs) setHistoryLogs(savedLogs);

      if (CloudSyncService.isConfigured()) {
        await syncWithCloud(true);
      }
      setIsReady(true);
    };
    init();
  }, [syncWithCloud]);

  useEffect(() => {
    if (isReady) {
      if (user) StorageService.saveData('current_user', user);
      StorageService.saveData('all_users', allUsers);
      StorageService.saveData('plan', mealPlan);
      StorageService.saveData('chat_history', chatMessages);
      StorageService.saveData('history_logs', historyLogs);
      
      if (CloudSyncService.isConfigured()) {
        const timer = setTimeout(() => pushToCloud(), 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [allUsers, mealPlan, chatMessages, historyLogs, isReady, pushToCloud, user]);

  const handleLogin = async (u: User) => {
    setUser(u);
    setAllUsers(prev => {
      if (!prev.find(au => au.email === u.email)) return [...prev, u];
      return prev.map(au => au.email === u.email ? u : au);
    });
    
    addHistoryEvent("Authentification", `Connecté en tant que ${u.name}`, "system");
    
    if (!u.biometricId && BiometricService.isAvailable()) {
       const confirmBio = window.confirm("Activer FaceID / TouchID ?");
       if (confirmBio) {
          const bioId = await BiometricService.registerBiometrics(u.email);
          if (bioId) {
            const updatedUser = { ...u, biometricId: bioId };
            setUser(updatedUser);
            addHistoryEvent("Sécurité", "Biométrie activée", "system");
          }
       }
    }

    const vaultId = CloudSyncService.deriveVaultIdFromEmail(u.email);
    CloudSyncService.setVaultId(vaultId);
    await syncWithCloud(true);
  };

  const handleCreateUser = (name: string, email: string, password?: string) => {
    const newUser: User = {
      id: btoa(email),
      name,
      email,
      password: password || "1234", // Défaut si non précisé
      role: email.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? 'admin' : 'user',
      status: 'authorized',
      isAuthenticated: false,
      exclusions: [],
      workouts: [],
      weightHistory: [],
      hydrationRecords: [],
      eatenMeals: []
    };
    setAllUsers(prev => [...prev, newUser]);
    addHistoryEvent("Admin", `Nouveau membre : ${name}`, "admin");
  };

  const handleDeleteUser = (userId: string) => {
    const u = allUsers.find(x => x.id === userId);
    setAllUsers(prev => prev.filter(au => au.id !== userId));
    addHistoryEvent("Admin", `Membre supprimé : ${u?.name}`, "admin");
  };

  const handleUpdateUser = (updatedUser: User) => {
    setAllUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    if (user?.id === updatedUser.id) setUser(updatedUser);
  };

  if (!isReady) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#0f172a] text-white">
      <div className="w-10 h-10 border-4 border-white border-t-emerald-500 rounded-full animate-spin mb-4"></div>
      <p className="tracking-widest text-[10px] font-black uppercase opacity-40">Initialisation...</p>
    </div>
  );

  if (!user || !user.isAuthenticated) {
    return <Login onLogin={handleLogin} allUsers={allUsers} />;
  }

  return (
    <div className="h-[100dvh] bg-slate-50 flex flex-col overflow-hidden relative font-sans">
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={() => { CloudSyncService.disconnect(); setUser(null); }} 
        user={user} 
        cloudStatus={cloudStatus}
        isCloudConfigured={CloudSyncService.isConfigured()}
        onCloudRestore={() => syncWithCloud(true)}
      />
      
      <main className="flex-1 container mx-auto px-4 py-4 max-w-6xl flex flex-col min-h-0 overflow-y-auto">
        <div className="flex-1 flex flex-col min-h-0">
          {activeTab === 'daily' && <DailyDashboard user={user} mealPlan={mealPlan} onUpdateUser={handleUpdateUser} historyLogs={historyLogs} />}
          {activeTab === 'assistant' && <Assistant setMealPlan={(p) => { setMealPlan(p); addHistoryEvent("Nutrition", "Plan mis à jour", "meal"); }} user={user} onUpdateUser={handleUpdateUser} messages={chatMessages} setMessages={setChatMessages} />}
          {activeTab === 'calendar' && <CalendarView mealPlan={mealPlan} />}
          {activeTab === 'sport' && <ActivityTracker user={user} onUpdateUser={handleUpdateUser} />}
          {activeTab === 'shopping' && <ShoppingList mealPlan={mealPlan} />}
          {activeTab === 'recipes' && <RecipeList mealPlan={mealPlan} user={user} />}
          {activeTab === 'admin' && user.role === 'admin' && (
            <AdminPanel 
              users={allUsers} 
              onUpdateUser={handleUpdateUser}
              onCreateUser={handleCreateUser} 
              onDeleteUser={handleDeleteUser} 
              isCloudConfigured={CloudSyncService.isConfigured()}
              historyLogs={historyLogs}
              onManualImport={() => {}}
              allAppData={{ allUsers, mealPlan, chatMessages, historyLogs }}
            />
          )}
        </div>
      </main>

      <footer className="bg-white border-t py-2 px-6 flex items-center justify-between text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 shrink-0">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${CloudSyncService.isConfigured() ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${CloudSyncService.isConfigured() ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
            <span>{CloudSyncService.isConfigured() ? 'CLOUD SYNCHRONISÉ' : 'MODE LOCAL'}</span>
          </div>
          <span className="opacity-40">{user.email}</span>
        </div>
        <div>NUTRITRACK CORE 8.6 • ENFORCED AUTH</div>
      </footer>
    </div>
  );
};

export default App;
