
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

  // Calcul du Métabolisme de Base (BMR) via Mifflin-St Jeor
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

  // Somme des calories brûlées aujourd'hui via le sport
  const caloriesBurned = useMemo(() => {
    return (user.workouts || [])
      .filter(w => w && w.date && new Date(w.date).toDateString() === todayStr)
      .reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);
  }, [user.workouts, todayStr]);

  // Somme des calories consommées aujourd'hui (repas validés)
  const caloriesEaten = useMemo(() => {
    return (user.eatenMeals || [])
      .filter(m => m && m.date && new Date(m.date).toDateString() === todayStr)
      .reduce((sum, m) => {
        const recipe = mealPlan?.recipes?.find(r => r.id === m.recipeId);
        return sum + (recipe?.calories || 0);
      }, 0);
  }, [user.eatenMeals, mealPlan, todayStr]);

  // Besoins Totaux = BMR + Activité physique
  const totalDailyNeeds = bmr + caloriesBurned;
  
  // Différence (Net) : Positif = Surplus, Négatif = Déficit
  const energyBalance = caloriesEaten - totalDailyNeeds;
  
  // Pour l'affichage des calories restantes (budget)
  const remainingBudget = totalDailyNeeds - caloriesEaten;
  const progressPercent = Math.min(100, Math.round((caloriesEaten / totalDailyNeeds) * 100));
  const isOverBudget = caloriesEaten > totalDailyNeeds;

  const hydrationToday = useMemo(() => {
    return (user.hydrationRecords || [])
      .filter(r => r && r.date && new Date(r.date).toDateString() === todayStr)
      .reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [user.hydrationRecords, todayStr]);

  const hydrationGoal = user.hydrationGoal || 2000;
  const hydrationPercentage = Math.min(100, Math.round((hydrationToday / hydrationGoal) * 100));

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
    <div className="flex-1 overflow-y-auto space-y-6 pb-10 custom-scrollbar animate-in fade-in duration-500">
      {/* Header avec Date et Résumé Profil */}
      <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 capitalize leading-tight">
            {today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
            <p className="text-emerald-500 font-bold text-[10px] uppercase tracking-widest">
              {currentDayPlan && mealPlan ? `Programme : Jour ${mealPlan.days.indexOf(currentDayPlan) + 1}` : "En attente de programme"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
           <div className="text-right">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Poids Actuel</p>
             <p className="text-xl font-black text-slate-900">{user.weightHistory?.[user.weightHistory.length - 1]?.weight || '--'} <span className="text-xs">kg</span></p>
           </div>
           <div className="w-px h-8 bg-slate-100"></div>
           <div className="text-right">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Objectif</p>
             <p className="text-xl font-black text-emerald-600">{user.weightGoal || '--'} <span className="text-xs">kg</span></p>
           </div>
        </div>
      </div>

      {/* SECTION CALCULATEUR DYNAMIQUE DES BESOINS */}
      <div className="bg-white rounded-[3rem] p-8 md:p-10 border border-slate-100 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
        
        <div className="relative z-10 space-y-8">
          {/* L'équation des besoins */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 pb-8 border-b border-slate-50">
            <div className="flex-1 space-y-4 w-full">
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Calcul de vos besoins aujourd'hui</h2>
              <div className="flex flex-wrap items-center gap-4 text-slate-800">
                 <div className="bg-indigo-50 px-5 py-4 rounded-[2rem] border border-indigo-100 min-w-[140px]">
                    <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1">Métabolisme (BMR)</p>
                    <p className="text-2xl font-black text-indigo-900">{bmr} <span className="text-xs">kcal</span></p>
                 </div>
                 <span className="text-2xl font-black text-slate-200">+</span>
                 <div className="bg-amber-50 px-5 py-4 rounded-[2rem] border border-amber-100 min-w-[140px]">
                    <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">Activités (Sport)</p>
                    <p className="text-2xl font-black text-amber-900">{caloriesBurned} <span className="text-xs">kcal</span></p>
                 </div>
                 <span className="text-2xl font-black text-slate-200">=</span>
                 <div className="bg-slate-900 px-5 py-4 rounded-[2rem] text-white min-w-[140px]">
                    <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Besoins Totaux</p>
                    <p className="text-2xl font-black">{totalDailyNeeds} <span className="text-xs">kcal</span></p>
                 </div>
              </div>
            </div>

            {/* Le Badge de Différence (Net) */}
            <div className={`shrink-0 p-8 rounded-[3rem] text-center min-w-[180px] border-2 transition-all ${energyBalance <= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Balance Nette</p>
               <p className={`text-4xl font-black ${energyBalance <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                 {energyBalance > 0 ? '+' : ''}{energyBalance}
               </p>
               <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">kcal</p>
               <div className={`mt-3 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${energyBalance <= 0 ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                 {energyBalance <= 0 ? 'Déficit Sain' : 'Surplus Actif'}
               </div>
            </div>
          </div>

          {/* Comparaison Visuelle Intake vs Needs */}
          <div className="space-y-6">
            <div className="flex justify-between items-end">
               <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Utilisation du budget calorique</h3>
                  <p className="text-slate-400 font-bold text-xs mt-1">
                    {remainingBudget >= 0 
                      ? `Il vous reste ${remainingBudget} kcal à consommer pour être à l'équilibre.` 
                      : `Vous avez dépassé vos besoins de ${Math.abs(remainingBudget)} kcal.`}
                  </p>
               </div>
               <div className="text-right">
                  <span className="text-2xl font-black text-slate-900">{progressPercent}%</span>
                  <p className="text-[9px] font-black text-slate-400 uppercase">Remplissage</p>
               </div>
            </div>

            <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
               <div 
                 className={`h-full transition-all duration-1000 ease-out ${isOverBudget ? 'bg-rose-500' : 'bg-emerald-500'}`}
                 style={{ width: `${progressPercent}%` }}
               ></div>
               {/* Ligne repère pour les besoins totaux */}
               <div className="absolute right-0 top-0 bottom-0 w-1 bg-slate-900/10"></div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Besoins (Maths)</p>
                  <p className="text-lg font-black text-slate-800">{totalDailyNeeds} kcal</p>
               </div>
               <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                  <p className="text-[9px] font-black text-emerald-600 uppercase mb-1">Ingéré (Plats)</p>
                  <p className="text-lg font-black text-emerald-700">{caloriesEaten} kcal</p>
               </div>
               <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
                  <p className="text-[9px] font-black text-blue-600 uppercase mb-1">Restant</p>
                  <p className="text-lg font-black text-blue-700">{remainingBudget > 0 ? remainingBudget : 0} kcal</p>
               </div>
               <div className="p-4 rounded-2xl bg-slate-900 text-white">
                  <p className="text-[9px] font-black text-white/40 uppercase mb-1">Statut</p>
                  <p className="text-lg font-black uppercase tracking-tighter">{isOverBudget ? 'Surplus' : 'Déficit'}</p>
               </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hydratation */}
        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col items-center justify-between min-h-[280px]">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 w-full text-center">Hydratation du jour</h3>
          <div className="relative w-36 h-36 flex items-center justify-center">
             <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-blue-50" />
                <circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="text-blue-500 transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-slate-800 leading-none">{hydrationPercentage}%</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase mt-1">{hydrationToday} / {hydrationGoal} ml</span>
              </div>
          </div>
          <div className="flex gap-3 w-full mt-4">
            <button onClick={() => addWater(250)} className="flex-1 py-4 bg-blue-50 text-blue-600 rounded-2xl font-black text-[10px] uppercase hover:bg-blue-100 transition-colors">🥛 250ml</button>
            <button onClick={() => addWater(500)} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase hover:bg-blue-700 shadow-lg shadow-blue-100">💧 500ml</button>
          </div>
        </div>

        {/* Historique Récent */}
        <div className="space-y-6 flex flex-col">
           <HistoryLog events={historyLogs} limit={5} title="Dernières Activités" showIcon={false} />
        </div>
      </div>

      {/* Menu du Jour */}
      <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-10">
           <h2 className="text-2xl font-black text-slate-800 tracking-tight">🍱 Vos repas prévus</h2>
           <div className="bg-slate-50 px-4 py-2 rounded-xl text-[9px] font-black text-slate-400 uppercase tracking-widest border border-slate-100">
             Total ingéré : {caloriesEaten} kcal
           </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {currentDayPlan ? (
            ['lunch', 'dinner'].map((type) => {
              const recipeId = (currentDayPlan as any)[type];
              const recipe = mealPlan?.recipes?.find(r => r.id === recipeId);
              const isEaten = (user.eatenMeals || []).some(m => new Date(m.date).toDateString() === todayStr && m.mealType === type);

              return (
                <div key={type} className={`p-8 rounded-[3rem] border-2 transition-all flex flex-col gap-6 relative group ${isEaten ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100 hover:border-emerald-200'}`}>
                  {isEaten && <div className="absolute top-6 right-6 text-emerald-500">✅</div>}
                  <div className="flex items-center gap-5">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-sm ${isEaten ? 'bg-emerald-500 text-white' : 'bg-slate-100 group-hover:bg-emerald-50 transition-colors'}`}>{type === 'lunch' ? '🥗' : '🌙'}</div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">{type === 'lunch' ? 'Déjeuner' : 'Dîner'}</p>
                      <h4 className="text-xl font-black text-slate-800 leading-tight">{recipe?.name || 'Recette'}</h4>
                      <p className="text-xs font-bold text-emerald-600 mt-1">{recipe?.calories} kcal</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => recipe && toggleMealEaten(recipe.id, type as any)} 
                    className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isEaten ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-slate-900 text-white hover:bg-emerald-600 shadow-xl'}`}
                  >
                    {isEaten ? 'MARQUÉ CONSOMMÉ' : 'J\'AI MANGÉ CE REPAS'}
                  </button>
                </div>
              );
            })
          ) : (
            <div className="col-span-2 text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
               <div className="text-4xl mb-4">🍽️</div>
               <p className="text-slate-400 font-bold uppercase tracking-widest text-xs leading-relaxed">
                 Aucun programme actif pour aujourd'hui.<br/>
                 Parlez à l'Assistant IA pour planifier vos repas.
               </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyDashboard;
