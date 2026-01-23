
import React, { useMemo, useState } from 'react';
import { User, MealPlan, HydrationRecord, HistoryEvent } from '../types';

interface DailyDashboardProps {
  user: User;
  mealPlan: MealPlan | null;
  onUpdateUser: (updatedUser: User) => void;
  historyLogs: HistoryEvent[];
}

const DailyDashboard: React.FC<DailyDashboardProps> = ({ user, mealPlan, onUpdateUser }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [lunchTime, setLunchTime] = useState(user.lunchTime || "12:00");
  const [dinnerTime, setDinnerTime] = useState(user.dinnerTime || "19:00");

  const today = new Date();
  const todayStr = today.toDateString();
  
  const currentDayPlan = useMemo(() => {
    if (!mealPlan || !mealPlan.startDate) return null;
    const start = new Date(mealPlan.startDate);
    start.setHours(0, 0, 0, 0);
    const now = new Date(today);
    now.setHours(0, 0, 0, 0);
    const diffTime = now.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return null;
    const dayIndex = diffDays % 30;
    return mealPlan.days[dayIndex];
  }, [mealPlan, today]);

  const weight = user.weightHistory?.[user.weightHistory.length - 1]?.weight || 70;
  const bmr = useMemo(() => {
    const height = user.height || 170;
    const age = user.age || 30;
    if (user.gender === 'woman') return Math.round(447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age));
    return Math.round(88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age));
  }, [user, weight]);

  const caloriesBurned = (user.workouts || [])
    .filter(w => w && w.date && new Date(w.date).toDateString() === todayStr)
    .reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);

  const caloriesEaten = (user.eatenMeals || [])
    .filter(m => m && m.date && new Date(m.date).toDateString() === todayStr)
    .reduce((sum, m) => {
      const recipe = mealPlan?.recipes?.find(r => r.id === m.recipeId);
      return sum + (recipe?.calories || 0);
    }, 0);

  const totalDailyNeeds = bmr + caloriesBurned;

  const hydrationToday = (user.hydrationRecords || [])
    .filter(r => r && r.date && new Date(r.date).toDateString() === todayStr)
    .reduce((sum, r) => sum + (r.amount || 0), 0);

  const hydrationGoal = user.hydrationGoal || 2000;
  const hydrationPercentage = Math.min(100, Math.round((hydrationToday / hydrationGoal) * 100));

  const addWater = (amount: number) => {
    const newRecord: HydrationRecord = { date: new Date().toISOString(), amount };
    onUpdateUser({ ...user, hydrationRecords: [...(user.hydrationRecords || []), newRecord] });
  };

  const handleSaveSettings = () => {
    onUpdateUser({ ...user, lunchTime, dinnerTime });
    setShowSettings(false);
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight">Bonjour, {user.name.split(' ')[0]} 👋</h1>
          <p className="text-slate-400 font-bold text-xs md:text-sm mt-1 uppercase tracking-widest">Objectif : {user.weightGoal}kg</p>
        </div>
        <div className="flex items-center gap-2 md:gap-3 self-end sm:self-center">
          <button onClick={() => setShowSettings(!showSettings)} className={`p-3 md:p-4 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm transition-all ${showSettings ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 hover:text-slate-900'}`}>⚙️</button>
          <div className="bg-white px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2 md:gap-3">
             <span className="text-xl md:text-2xl">🏆</span>
             <div className="text-right"><p className="text-[8px] md:text-[10px] font-black text-slate-300 uppercase">Progrès</p><p className="text-xs md:text-sm font-black text-emerald-500">Or</p></div>
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-5 sm:p-8 md:p-10 border-2 border-emerald-100 shadow-premium animate-in slide-in-from-top-4 duration-500">
           <h3 className="text-lg md:text-xl font-black text-slate-900 mb-6">Préférences Repas</h3>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8 mb-6">
              <div className="space-y-2"><label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Déjeuner</label><input type="time" value={lunchTime} onChange={(e) => setLunchTime(e.target.value)} className="w-full px-4 md:px-6 py-3 md:py-4 bg-slate-50 rounded-xl md:rounded-2xl text-slate-900 font-black text-base md:text-lg outline-none" /></div>
              <div className="space-y-2"><label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Dîner</label><input type="time" value={dinnerTime} onChange={(e) => setDinnerTime(e.target.value)} className="w-full px-4 md:px-6 py-3 md:py-4 bg-slate-50 rounded-xl md:rounded-2xl text-slate-900 font-black text-base md:text-lg outline-none" /></div>
           </div>
           <div className="flex flex-col sm:flex-row gap-3"><button onClick={handleSaveSettings} className="flex-1 py-4 md:py-5 bg-emerald-600 text-white rounded-xl md:rounded-2xl font-black text-[10px] uppercase shadow-xl shadow-emerald-100">Enregistrer</button><button onClick={() => setShowSettings(false)} className="px-6 md:px-8 py-3 md:py-5 bg-slate-100 text-slate-400 rounded-xl md:rounded-2xl font-black text-[10px] uppercase">Annuler</button></div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[
          { label: 'Ingéré', val: caloriesEaten, unit: 'kcal', icon: '🍽️', color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { label: 'Brûlé', val: caloriesBurned, unit: 'kcal', icon: '🔥', color: 'text-orange-500', bg: 'bg-orange-50' },
          { label: 'Cible', val: totalDailyNeeds, unit: 'kcal', icon: '🎯', color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'EauToday', val: hydrationToday, unit: 'ml', icon: '💧', color: 'text-cyan-500', bg: 'bg-cyan-50' }
        ].map((card, i) => (
          <div key={i} className="bg-white p-4 sm:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 ${card.bg} rounded-xl md:rounded-2xl flex items-center justify-center text-lg md:text-xl mb-3 md:mb-4`}>{card.icon}</div>
            <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">{card.label}</p>
            <p className={`text-base sm:text-lg md:text-2xl font-black ${card.color} truncate`}>{card.val}<span className="text-[8px] sm:text-xs font-bold text-slate-300 ml-1">{card.unit}</span></p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-5 sm:p-8 md:p-10 border border-slate-100 shadow-premium relative overflow-hidden">
             <div className="flex justify-between items-center mb-6 md:mb-10"><h2 className="text-lg md:text-xl font-black text-slate-900">Aujourd'hui</h2><span className="text-[9px] font-black text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-widest">Actif</span></div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
               {['lunch', 'dinner'].map((type) => {
                 const recipeId = currentDayPlan ? (currentDayPlan as any)[type] : null;
                 const recipe = mealPlan?.recipes?.find(r => r.id === recipeId);
                 return (
                   <div key={type} className="p-4 sm:p-6 rounded-2xl md:rounded-3xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition-all flex flex-col justify-between">
                      <div className="flex items-center gap-3 sm:gap-4 mb-4"><div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-xl md:rounded-2xl flex items-center justify-center text-xl md:text-2xl shadow-sm shrink-0">{type === 'lunch' ? '🍱' : '🌙'}</div><div className="min-w-0"><p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase">{type === 'lunch' ? 'Midi' : 'Soir'}</p><h4 className="text-xs sm:text-sm font-black text-slate-800 truncate">{recipe?.name || '---'}</h4></div></div>
                      <button className="w-full py-2.5 sm:py-3 bg-white hover:bg-emerald-500 hover:text-white text-slate-900 rounded-lg md:rounded-xl font-black text-[9px] sm:text-[10px] uppercase transition-all shadow-sm border border-slate-100">Découvrir</button>
                   </div>
                 );
               })}
             </div>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[1.5rem] md:rounded-[2.5rem] p-6 sm:p-8 md:p-10 text-white shadow-xl shadow-blue-100">
             <div className="flex justify-between items-center mb-6 md:mb-8"><h3 className="text-lg md:text-xl font-black">Objectif Eau</h3><span className="text-[10px] font-bold opacity-70 tracking-widest">{hydrationPercentage}%</span></div>
             <div className="h-3 md:h-4 bg-white/20 rounded-full overflow-hidden mb-6 md:mb-8"><div className="h-full bg-white transition-all duration-1000" style={{ width: `${hydrationPercentage}%` }}></div></div>
             <div className="grid grid-cols-2 gap-3 md:gap-4"><button onClick={() => addWater(250)} className="py-3 sm:py-4 bg-white/10 hover:bg-white/20 rounded-xl md:rounded-2xl font-black text-[9px] uppercase tracking-widest border border-white/10">Verre</button><button onClick={() => addWater(500)} className="py-3 sm:py-4 bg-white text-blue-600 rounded-xl md:rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-lg">Bouteille</button></div>
          </div>
        </div>
        <div className="space-y-6 md:space-y-8">
           <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-6 sm:p-8 border border-slate-100 shadow-premium">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Poids Actuel</h3>
              <div className="text-center py-4 md:py-6"><p className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 leading-none">{weight}<span className="text-base sm:text-lg text-slate-300 ml-1 md:ml-2">kg</span></p><div className="mt-4 inline-flex items-center px-4 py-2 bg-rose-50 text-rose-500 rounded-full font-bold text-[8px] sm:text-[10px] uppercase tracking-wider">🎯 Objectif : {user.weightGoal}kg</div></div>
           </div>
           <div className="bg-emerald-500 rounded-[1.5rem] md:rounded-[2.5rem] p-6 sm:p-8 text-white shadow-xl shadow-emerald-100 relative overflow-hidden group">
              <div className="relative z-10"><h4 className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-3 md:mb-4">Coach IA</h4><p className="text-sm sm:text-base md:text-lg font-bold leading-tight italic">"N'oubliez pas vos protéines ce soir pour favoriser la récupération musculaire."</p></div>
              <div className="absolute -right-6 -bottom-6 text-5xl sm:text-6xl opacity-20 transform -rotate-12 group-hover:rotate-0 transition-transform duration-500">🤖</div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default DailyDashboard;
