
import React, { useMemo } from 'react';
import { User, MealPlan, HydrationRecord, HistoryEvent } from '../types';
import HistoryLog from './HistoryLog';

interface DailyDashboardProps {
  user: User;
  mealPlan: MealPlan | null;
  onUpdateUser: (updatedUser: User) => void;
  historyLogs: HistoryEvent[];
}

const DailyDashboard: React.FC<DailyDashboardProps> = ({ user, mealPlan, onUpdateUser, historyLogs }) => {
  const today = new Date();
  const todayStr = today.toDateString();
  
  // Calcul du jour relatif au début du programme
  const currentDayPlan = useMemo(() => {
    if (!mealPlan || !mealPlan.startDate) return null;
    const start = new Date(mealPlan.startDate);
    start.setHours(0, 0, 0, 0);
    const now = new Date(today);
    now.setHours(0, 0, 0, 0);
    
    const diffTime = now.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // On boucle si on dépasse 30 jours, ou on retourne null si on n'a pas commencé
    if (diffDays < 0) return null;
    const dayIndex = diffDays % 30;
    return mealPlan.days[dayIndex];
  }, [mealPlan, today]);

  const bmr = useMemo(() => {
    const weightHistory = user.weightHistory || [];
    const weight = weightHistory.length > 0 
      ? weightHistory[weightHistory.length - 1].weight 
      : (user.gender === 'man' ? 80 : 65);
    const height = user.height || 170;
    const age = user.age || 30;
    
    if (user.gender === 'woman') {
      return Math.round(447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age));
    }
    return Math.round(88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age));
  }, [user]);

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

  const hydrationToday = useMemo(() => {
    return (user.hydrationRecords || [])
      .filter(r => r && r.date && new Date(r.date).toDateString() === todayStr)
      .reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [user.hydrationRecords, todayStr]);

  const hydrationGoal = user.hydrationGoal || 2000;
  const hydrationPercentage = Math.min(100, Math.round((hydrationToday / hydrationGoal) * 100));
  const remainingCalories = bmr + caloriesBurned - caloriesEaten;

  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (hydrationPercentage / 100) * circumference;

  const addWater = (amount: number) => {
    const newRecord: HydrationRecord = {
      date: new Date().toISOString(),
      amount
    };
    onUpdateUser({
      ...user,
      hydrationRecords: [...(user.hydrationRecords || []), newRecord]
    });
  };

  const toggleMealEaten = (recipeId: string, mealType: 'lunch' | 'dinner') => {
    const isAlreadyEaten = (user.eatenMeals || []).some(
      m => new Date(m.date).toDateString() === todayStr && m.mealType === mealType
    );

    let newEatenMeals = [...(user.eatenMeals || [])];
    if (isAlreadyEaten) {
      newEatenMeals = newEatenMeals.filter(
        m => !(new Date(m.date).toDateString() === todayStr && m.mealType === mealType)
      );
    } else {
      newEatenMeals.push({ date: new Date().toISOString(), mealType, recipeId });
    }
    onUpdateUser({ ...user, eatenMeals: newEatenMeals });
  };

  return (
    <div className="flex-1 overflow-y-auto space-y-6 pb-10 custom-scrollbar">
      <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
        <h1 className="text-3xl font-black text-slate-900 capitalize leading-tight">
          {today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </h1>
        <div className="flex items-center gap-2 mt-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
          <p className="text-emerald-500 font-bold text-xs uppercase tracking-widest">
            {currentDayPlan ? `Programme : Jour ${mealPlan?.days.indexOf(currentDayPlan) + 1}` : "Aucun programme en cours"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[280px]">
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-6">Énergie Restante</h3>
            <div className="flex items-end gap-2">
              <span className="text-5xl font-black tracking-tighter">{remainingCalories}</span>
              <span className="text-xl font-bold text-emerald-400 mb-1">kcal</span>
            </div>
          </div>
          <div className="mt-8 space-y-2 border-t border-white/10 pt-4">
             <div className="flex justify-between text-[11px] font-bold text-white/60 uppercase">
               <span>Métabolisme</span>
               <span>{bmr}</span>
             </div>
             <div className="flex justify-between text-[11px] font-bold text-emerald-400 uppercase">
               <span>Activités</span>
               <span>+{caloriesBurned}</span>
             </div>
             <div className="flex justify-between text-[11px] font-bold text-rose-400 uppercase">
               <span>Alimentation</span>
               <span>-{caloriesEaten}</span>
             </div>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col items-center justify-between min-h-[280px]">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 w-full text-center">Hydratation</h3>
          <div className="relative w-36 h-36 flex items-center justify-center">
             <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-blue-50" />
                <circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="text-blue-500 transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-slate-800 leading-none">{hydrationPercentage}%</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase mt-1">{hydrationToday}ml</span>
              </div>
          </div>
          <div className="flex gap-3 w-full mt-4">
            <button onClick={() => addWater(250)} className="flex-1 py-3 bg-blue-50 text-blue-600 rounded-2xl font-black text-[10px] uppercase">🥛 250ml</button>
            <button onClick={() => addWater(500)} className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase">💧 500ml</button>
          </div>
        </div>

        <div className="space-y-6 flex flex-col min-h-[280px]">
           <HistoryLog events={historyLogs} limit={5} title="Activités Récentes" showIcon={false} />
        </div>
      </div>

      <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
        <h2 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-3">🍱 Vos repas du jour</h2>
        <div className="space-y-6">
          {currentDayPlan ? (
            ['lunch', 'dinner'].map((type) => {
              const recipeId = (currentDayPlan as any)[type];
              const recipe = mealPlan?.recipes?.find(r => r.id === recipeId);
              const isEaten = (user.eatenMeals || []).some(m => new Date(m.date).toDateString() === todayStr && m.mealType === type);

              return (
                <div key={type} className={`p-6 rounded-[2.5rem] border-2 transition-all flex flex-col sm:flex-row items-center justify-between gap-4 ${isEaten ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${isEaten ? 'bg-emerald-500 text-white' : 'bg-slate-100'}`}>{type === 'lunch' ? '🥗' : '🌙'}</div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{type === 'lunch' ? 'Déjeuner' : 'Dîner'}</p>
                      <h4 className="text-lg font-black text-slate-800 leading-tight">{recipe?.name || 'Recette'}</h4>
                      <p className="text-xs font-bold text-emerald-600 mt-1">{recipe?.calories} kcal</p>
                    </div>
                  </div>
                  <button onClick={() => recipe && toggleMealEaten(recipe.id, type as any)} className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest ${isEaten ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'}`}>{isEaten ? 'CONSOMMÉ ✓' : 'MARQUER MANGÉ'}</button>
                </div>
              );
            })
          ) : <p className="text-center text-slate-400 py-10 font-bold">Aucun plan repas actif aujourd'hui. Demandez à l'IA de générer votre programme !</p>}
        </div>
      </div>
    </div>
  );
};

export default DailyDashboard;
