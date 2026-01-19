
import React, { useState, useEffect, useCallback } from 'react';
import { User, Tab, MealPlan } from './types';
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

const App: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('daily');
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [cloudStatus, setCloudStatus] = useState<'off' | 'syncing' | 'synced' | 'error'>('off');
  const [isCloudConfigured, setIsCloudConfigured] = useState(false);
  const [showBioPrompt, setShowBioPrompt] = useState(false);

  const updateCloudConfigStatus = useCallback(() => {
    setIsCloudConfigured(CloudSyncService.isConfigured());
  }, []);

  const syncWithCloud = useCallback(async (targetEmail: string) => {
    if (!CloudSyncService.isConfigured()) {
      setCloudStatus('off');
      return null;
    }
    setIsSyncing(true);
    setCloudStatus('syncing');
    try {
      const data = await CloudSyncService.pullData(targetEmail);
      if (data) {
        if (data.mealPlan) setMealPlan(data.mealPlan);
        if (data.chatMessages) setChatMessages(data.chatMessages);
        if (data.user && data.user.email.toLowerCase() === 'admin@nutritrack.com') {
          data.user.status = 'authorized';
          data.user.role = 'admin';
        }
        if (data.user && data.user.email === targetEmail) setUser(data.user);
        setCloudStatus('synced');
        return data;
      } else {
        // Si pas de données mais configuré, on considère que c'est une réussite vide
        setCloudStatus('synced');
      }
    } catch (e) {
      setCloudStatus('error');
    } finally {
      setIsSyncing(false);
    }
    return null;
  }, []);

  const triggerCloudPush = useCallback(async () => {
    if (!user || !CloudSyncService.isConfigured()) return;
    setCloudStatus('syncing');
    const backupData = { allUsers, chatMessages, mealPlan, user };
    const success = await CloudSyncService.pushData(user.email, backupData);
    
    if (user.role === 'admin') {
       await CloudSyncService.pushData('admin@nutritrack.com', { allUsers });
    }

    setCloudStatus(success ? 'synced' : 'error');
  }, [user, allUsers, chatMessages, mealPlan]);

  useEffect(() => {
    const init = async () => {
      await CloudSyncService.init();
      updateCloudConfigStatus();

      const hash = window.location.hash;
      if (hash.startsWith("#setup=")) {
        try {
          const payload = JSON.parse(atob(hash.replace("#setup=", "")));
          if (payload.cloudConfig) {
            await CloudSyncService.setConfig(payload.cloudConfig.url, payload.cloudConfig.key);
            updateCloudConfigStatus();
            alert("Configuration Cloud importée !");
          }
        } catch(e) {}
        window.location.hash = "";
      }

      const savedUsers = await StorageService.loadData('all_users');
      const savedUser = await StorageService.loadData('current_user');
      const savedPlan = await StorageService.loadData('plan');
      const savedChat = await StorageService.loadData('chat_history');
      const savedTab = await StorageService.loadData('active_tab');

      if (savedUsers) setAllUsers(savedUsers);
      else setAllUsers([{ id: 'admin-001', name: 'Admin', email: 'admin@nutritrack.com', password: 'admin', role: 'admin', status: 'authorized', isAuthenticated: false, exclusions: [], workouts: [], weightHistory: [] }]);
      
      if (savedUser) {
        if (savedUser.email.toLowerCase() === 'admin@nutritrack.com') {
          savedUser.status = 'authorized';
          savedUser.role = 'admin';
        }
        setUser(savedUser);
        if (CloudSyncService.isConfigured()) await syncWithCloud(savedUser.email);
      }
      
      if (savedPlan) setMealPlan(savedPlan);
      if (savedChat) setChatMessages(savedChat);
      if (savedTab) setActiveTab(savedTab as Tab);
      setIsReady(true);
    };
    init();
  }, [syncWithCloud, updateCloudConfigStatus]);

  useEffect(() => {
    if (isReady && user && !isSyncing && isCloudConfigured) {
      const timer = setTimeout(() => triggerCloudPush(), 3000);
      return () => clearTimeout(timer);
    }
  }, [user, mealPlan, isReady, triggerCloudPush, isSyncing, isCloudConfigured]);

  useEffect(() => { if (isReady) StorageService.saveData('all_users', allUsers); }, [allUsers, isReady]);
  useEffect(() => { if (isReady) StorageService.saveData('plan', mealPlan); }, [mealPlan, isReady]);
  useEffect(() => { if (isReady) StorageService.saveData('chat_history', chatMessages); }, [chatMessages, isReady]);
  useEffect(() => { if (isReady) StorageService.saveData('active_tab', activeTab); }, [activeTab, isReady]);
  useEffect(() => { if (isReady) StorageService.saveData('current_user', user); }, [user, isReady]);

  const handleUpdateUser = (updatedUser: User) => setUser(updatedUser);

  const handleLogin = async (u: User) => {
    const isAdminEmail = u.email.toLowerCase() === 'admin@nutritrack.com';
    setCloudStatus('syncing');
    
    let currentUsers = [...allUsers];
    if (CloudSyncService.isConfigured()) {
      const adminCloudData = await CloudSyncService.pullData('admin@nutritrack.com');
      if (adminCloudData && adminCloudData.allUsers) {
        currentUsers = adminCloudData.allUsers;
        setAllUsers(currentUsers);
      }
    }

    let existing = currentUsers.find(au => au.email.toLowerCase() === u.email.toLowerCase());
    
    if (existing) {
      if (existing.password === u.password) {
        if (isAdminEmail) { existing.status = 'authorized'; existing.role = 'admin'; }
        setUser(existing);
        if (CloudSyncService.isConfigured()) await syncWithCloud(u.email);
        if (existing.status === 'authorized' && !existing.biometricId && BiometricService.isAvailable()) {
          setTimeout(() => setShowBioPrompt(true), 1500);
        }
      } else {
        alert("Mot de passe incorrect.");
        setCloudStatus('error');
      }
    } else {
      const targetUser: User = { 
        ...u, 
        id: isAdminEmail ? 'admin-001' : u.id,
        status: isAdminEmail ? 'authorized' : 'pending', 
        role: isAdminEmail ? 'admin' : 'user', 
        exclusions: [], workouts: [], weightHistory: [] 
      };
      setAllUsers(prev => [...prev, targetUser]);
      setUser(targetUser);
      if (CloudSyncService.isConfigured()) await syncWithCloud(u.email);
    }
  };

  if (!isReady) return (
    <div className="h-screen flex flex-col items-center justify-center bg-emerald-600 text-white p-10 font-black">
      <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4"></div>
      SYNCHRONISATION...
    </div>
  );

  if (!user || user.status !== 'authorized') {
    return <Login onLogin={handleLogin} currentUser={user} onLogout={() => setUser(null)} />;
  }

  return (
    <div className="h-[100dvh] bg-slate-50 flex flex-col overflow-hidden relative">
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={() => setUser(null)} 
        user={user} 
        onExport={() => {}} 
        onImport={() => {}}
        onGenerateMagicLink={() => {}}
        cloudStatus={cloudStatus}
        isCloudConfigured={isCloudConfigured}
        onCloudRestore={async () => {
          updateCloudConfigStatus();
          await syncWithCloud(user.email);
        }}
      />
      
      <main className="flex-1 container mx-auto px-4 py-4 max-w-6xl flex flex-col min-h-0 overflow-y-auto">
        <div className="flex-1 flex flex-col min-h-0">
          {activeTab === 'daily' && <DailyDashboard user={user} mealPlan={mealPlan} onUpdateUser={handleUpdateUser} />}
          {activeTab === 'assistant' && <Assistant setMealPlan={setMealPlan} user={user} onUpdateUser={handleUpdateUser} messages={chatMessages} setMessages={setChatMessages} />}
          {activeTab === 'calendar' && <CalendarView mealPlan={mealPlan} />}
          {activeTab === 'sport' && <ActivityTracker user={user} onUpdateUser={handleUpdateUser} />}
          {activeTab === 'shopping' && <ShoppingList mealPlan={mealPlan} />}
          {activeTab === 'recipes' && <RecipeList mealPlan={mealPlan} user={user} />}
          {activeTab === 'admin' && user.role === 'admin' && (
            <AdminPanel 
              users={allUsers} 
              onUpdateUser={handleUpdateUser} 
              onCreateUser={(n,e,p) => setAllUsers(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), name: n, email: e.toLowerCase(), password: p, role: 'user', status: 'authorized', isAuthenticated: false, exclusions: [], workouts: [], weightHistory: [] }])} 
              onDeleteUser={(id) => setAllUsers(prev => prev.filter(u => u.id !== id))} 
              isCloudConfigured={isCloudConfigured}
            />
          )}
        </div>
      </main>

      <footer className="bg-white border-t py-2 px-6 flex items-center justify-between text-slate-400 text-[8px] uppercase tracking-widest font-black shrink-0">
        <span>NutriTrack AI v2.8 Connectivity Fix</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isCloudConfigured ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            {isCloudConfigured ? 'Clés OK' : 'Pas de Clés'}
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${cloudStatus === 'synced' ? 'bg-emerald-500 animate-pulse' : cloudStatus === 'error' ? 'bg-rose-500' : 'bg-slate-300'}`}></span>
            {cloudStatus === 'synced' ? 'Synchronisé' : cloudStatus === 'error' ? 'Erreur Base' : 'Hors Ligne'}
          </span>
        </span>
      </footer>
    </div>
  );
};

export default App;
