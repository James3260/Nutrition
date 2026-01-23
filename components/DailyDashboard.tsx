
import React, { useMemo } from 'react';
import { User, MealPlan, HydrationRecord, HistoryEvent } from '../types';

interface DailyDashboardProps {
  user: User;
  mealPlan: MealPlan | null;
  onUpdateUser: (updatedUser: User) => void;
  historyLogs: HistoryEvent[];
}

const DailyDashboard: React.FC<DailyDashboardProps> = ({ user, mealPlan, onUpdateUser }) => {
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

  const caloriesBurned = useMemo(() => {
    return (user.workouts || [])
      .filter(w => w && w.date && new Date(w.date).toDateString() === todayStr)
      .reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);
  }, [user.workouts, todayStr]);

  const caloriesEaten = useMemo(() => {
    return (user.eatenMeals || [])
      .filter(m => m && m.date && new Date(m.date).toDateString() === todayStr)
      .reduce((sum, m) => {
        const recipe = mealPlan?.recipes?.find(r => r.id === m.recipeId);
        return sum + (recipe?.calories || 0);
      }, 0);
  }, [user.eatenMeals, mealPlan, todayStr]);

  const totalDailyNeeds = bmr + caloriesBurned;
  const progressPercent = Math.min(100, Math.round((caloriesEaten / totalDailyNeeds) * 100));

  const hydrationToday = useMemo(() => {
    return (user.hydrationRecords || [])
      .filter(r => r && r.date && new Date(r.date).toDateString() === todayStr)
      .reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [user.hydrationRecords, todayStr]);

  const hydrationGoal = user.hydrationGoal || 2000;
  const hydrationPercentage = Math.min(100, Math.round((hydrationToday / hydrationGoal) * 100));

  const addWater = (amount: number) => {
    const newRecord: HydrationRecord = { date: new Date().toISOString(), amount };
    onUpdateUser({ ...user, hydrationRecords: [...(user.hydrationRecords || []), newRecord] });
  };

  const toggleMealEaten = (recipeId: string, mealType: 'lunch' | 'dinner') => {
    const isAlreadyEaten = (user.eatenMeals || []).some(m => new Date(m.date).toDateString() === todayStr && m.mealType === mealType);
    let newEatenMeals = [...(user.eatenMeals || [])];
    if (isAlreadyEaten) {
      newEatenMeals = newEatenMeals.filter(m => !(new Date(m.date).toDateString() === todayStr && m.mealType === mealType));
    } else {
      newEatenMeals.push({ date: new Date().toISOString(), mealType, recipeId });
    }
    onUpdateUser({ ...user, eatenMeals: newEatenMeals });
  };

  return (
    <div className="flex-1 overflow-y-auto space-y-6 md:space-y-8 py-4 md:py-8 no-scrollbar pb-32 md:pb-12">
      
      {/* Premium Hero Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-black rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-10 border border-white/5 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-48 h-48 md:w-64 md:h-64 bg-emerald-500/10 rounded-full blur-[80px] md:blur-[100px] -mr-16 -mt-16"></div>
          <div className="relative z-10">
            <h1 className="text-2xl md:text-4xl font-black text-white tracking-tighter capitalize mb-6 md:mb-10">
              {today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })}
            </h1>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {[
                { label: 'Ingéré', val: caloriesEaten, unit: 'kcal', color: 'text-white' },
                { label: 'Brûlé', val: caloriesBurned, unit: 'kcal', color: 'text-emerald-500' },
                { label: 'Objectif', val: totalDailyNeeds, unit: 'kcal', color: 'text-slate-500' },
                { label: 'Libre', val: Math.max(0, totalDailyNeeds - caloriesEaten), unit: 'kcal', color: 'text-emerald-400' }
              ].map((stat, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-slate-500">{stat.label}</p>
                  <p className={`text-xl md:text-2xl font-black ${stat.color}`}>{stat.val}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 md:mt-12 space-y-3">
              <div className="flex justify-between items-end">
                <p className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] text-emerald-500">Consommation Énergétique</p>
                <p className="text-lg md:text-xl font-black text-white">{progressPercent}%</p>
              </div>
              <div className="h-2.5 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(16,185,129,0.5)]" 
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Weight Quick Glance */}
        <div className="bg-slate-900/50 backdrop-blur-xl rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-10 border border-white/5 shadow-2xl flex flex-col justify-between gap-6">
          <div className="space-y-1">
            <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Poids Actuel</p>
            <p className="text-4xl md:text-5xl font-black text-white">{weight}<span className="text-base md:text-lg font-medium text-slate-700 ml-2">kg</span></p>
          </div>
          <div className="bg-emerald-500/10 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] border border-emerald-500/10">
            <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-emerald-500 mb-1">Objectif</p>
            <p className="text-xl md:text-2xl font-black text-white">{user.weightGoal || '--'} kg</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Meals & Hydration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        
        {/* Daily Menu */}
        <div className="bg-slate-900/40 backdrop-blur-md rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-10 border border-white/5 shadow-xl">
          <div className="flex justify-between items-center mb-6 md:mb-10">
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Menu du jour</h2>
            <div className="px-3 py-1.5 bg-white/5 rounded-lg border border-white/5 text-[8px] md:text-[9px] font-black uppercase tracking-widest text-slate-500">Premium Plan</div>
          </div>

          <div className="space-y-4 md:space-y-6">
            {currentDayPlan ? (
              ['lunch', 'dinner'].map((type) => {
                const recipeId = (currentDayPlan as any)[type];
                const recipe = mealPlan?.recipes?.find(r => r.id === recipeId);
                const isEaten = (user.eatenMeals || []).some(m => new Date(m.date).toDateString() === todayStr && m.mealType === type);

                return (
                  <div key={type} className={`p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border-2 transition-all flex flex-col gap-4 md:gap-6 relative group ${isEaten ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-black/20 border-white/5 hover:border-emerald-500/20'}`}>
                    <div className="flex items-center gap-4 md:gap-6">
                      <div className={`w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center text-2xl md:text-3xl shadow-2xl ${isEaten ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 group-hover:bg-emerald-500/20 group-hover:text-emerald-500 transition-all'}`}>
                        {type === 'lunch' ? '🥗' : '🌙'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] md:tracking-[0.2em] mb-1">{type === 'lunch' ? 'Déjeuner' : 'Dîner'}</p>
                        <h4 className="text-base md:text-lg font-black text-white leading-tight truncate">{recipe?.name || 'Recette'}</h4>
                        <p className="text-[10px] md:text-xs font-bold text-emerald-500 mt-1">{recipe?.calories} kcal</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => recipe && toggleMealEaten(recipe.id, type as any)} 
                      className={`w-full py-4 md:py-5 rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.3em] transition-all ${isEaten ? 'bg-emerald-500 text-white shadow-lg' : 'bg-white text-black hover:bg-emerald-500 hover:text-white'}`}
                    >
                      {isEaten ? 'CONSOMMÉ ✓' : 'VALIDER LE REPAS'}
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 md:py-16 bg-white/5 rounded-[2.5rem] border border-dashed border-white/10">
                <p className="text-slate-500 font-black uppercase tracking-widest text-[9px]">Aucun plan pour aujourd'hui</p>
              </div>
            )}
          </div>
        </div>

        {/* Hydration chic */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-10 text-white relative overflow-hidden shadow-2xl flex flex-col justify-between gap-8">
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-[60px] -ml-16 -mb-16"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-center">
               <h3 className="text-xl md:text-2xl font-black tracking-tight">Hydratation</h3>
               <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1.5 rounded-full">Objectif {hydrationGoal}ml</span>
            </div>

            <div className="py-10 md:py-12 flex flex-col items-center">
              <p className="text-6xl md:text-7xl font-black leading-none mb-2">{hydrationPercentage}%</p>
              <p className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.3em] opacity-60">{hydrationToday} ml bus</p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4">
               <button onClick={() => addWater(250)} className="py-4 md:py-5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-[1.5rem] md:rounded-[2rem] font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all">🥛 +250ml</button>
               <button onClick={() => addWater(500)} className="py-4 md:py-5 bg-white text-blue-600 rounded-[1.5rem] md:rounded-[2rem] font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all shadow-xl">💧 +500ml</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyDashboard;
