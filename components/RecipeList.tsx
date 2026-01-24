
import React, { useState, useMemo } from 'react';
import { MealPlan, User } from '../types';

interface RecipeListProps {
  mealPlan: MealPlan | null;
  user: User;
}

const RecipeList: React.FC<RecipeListProps> = ({ mealPlan, user }) => {
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [isCookingMode, setIsCookingMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    setCheckedIngredients(new Set());
  }, [selectedRecipeId]);

  // Calcul de la fréquence d'apparition de chaque recette dans le mois
  const recipeFrequencies = useMemo(() => {
    const freqs: Record<string, number> = {};
    if (mealPlan) {
      mealPlan.days.forEach(day => {
        ['breakfast', 'lunch', 'snack', 'dinner'].forEach(type => {
          const rid = (day as any)[type];
          if (rid) freqs[rid] = (freqs[rid] || 0) + 1;
        });
      });
    }
    return freqs;
  }, [mealPlan]);

  if (!mealPlan) {
    return (
      <div className="flex flex-col items-center justify-center py-24 sm:py-32 bg-white rounded-[2rem] md:rounded-[3rem] border-2 border-dashed border-slate-200 px-6 text-center animate-in fade-in zoom-in-95 duration-700">
        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 shadow-inner text-5xl">👨‍🍳</div>
        <h2 className="text-slate-900 font-black text-xl sm:text-2xl mb-2">Le Livre de Recettes est vide</h2>
        <p className="text-slate-400 text-xs sm:text-sm max-w-xs mx-auto leading-relaxed">
          Générez votre programme avec l'assistant pour débloquer vos fiches cuisine gastronomiques.
        </p>
      </div>
    );
  }

  const recipes = mealPlan.recipes;
  const selectedRecipe = recipes.find(r => r.id === selectedRecipeId);
  const estimatedTime = selectedRecipe ? 10 + (selectedRecipe.steps.length * 5) : 0;

  const startCooking = () => {
    setIsCookingMode(true);
    setCurrentStep(0);
  };

  const nextStep = () => {
    if (selectedRecipe && currentStep < selectedRecipe.steps.length - 1) {
      setCurrentStep(c => c + 1);
    } else {
      setIsCookingMode(false);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) setCurrentStep(c => c - 1);
  };

  const toggleIngredient = (idx: number) => {
    const key = `${selectedRecipeId}-${idx}`;
    const newSet = new Set(checkedIngredients);
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    setCheckedIngredients(newSet);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 animate-in fade-in duration-500 h-[calc(100vh-80px)] sm:h-[calc(100vh-100px)] pb-safe">
      
      {/* --- MODE CUISINE IMMERSIF (PLEIN ÉCRAN) --- */}
      {isCookingMode && selectedRecipe && (
        <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col animate-in zoom-in-95 duration-300">
          <div className="w-full h-2 bg-slate-800">
            <div 
              className="h-full bg-emerald-500 transition-all duration-500 ease-out shadow-[0_0_15px_rgba(16,185,129,0.5)]" 
              style={{ width: `${((currentStep + 1) / selectedRecipe.steps.length) * 100}%` }}
            ></div>
          </div>

          <div className="px-6 py-6 flex justify-between items-center text-white shrink-0 bg-slate-900/50 backdrop-blur-md border-b border-white/5">
            <div>
              <h2 className="text-lg font-black tracking-tight text-emerald-400">{selectedRecipe.name}</h2>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">
                Étape {currentStep + 1} <span className="text-slate-600 mx-1">/</span> {selectedRecipe.steps.length}
              </p>
            </div>
            <button onClick={() => setIsCookingMode(false)} className="w-10 h-10 rounded-full bg-white/10 hover:bg-rose-500/20 hover:text-rose-400 flex items-center justify-center transition-all">✕</button>
          </div>

          <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 max-w-4xl mx-auto w-full overflow-y-auto">
            <div className="space-y-8 py-10">
               <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-black uppercase tracking-widest mb-4">
                 <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                 Action en cours
               </div>
               
               <p className="text-2xl sm:text-4xl md:text-5xl font-medium text-white leading-tight">
                 {selectedRecipe.steps[currentStep]}
               </p>
               
               <div className="bg-white/5 rounded-3xl p-6 border border-white/10">
                 <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-4 font-bold flex items-center gap-2">
                    <span>💡</span> Ingrédients Utiles
                 </p>
                 <div className="flex flex-wrap gap-2">
                   {selectedRecipe.ingredients.map((ing, i) => {
                     const isRelevant = selectedRecipe.steps[currentStep].toLowerCase().includes(ing.item.toLowerCase().split(' ')[0]);
                     return (
                       <span key={i} className={`text-xs px-3 py-2 rounded-xl border transition-all ${isRelevant ? 'bg-emerald-500 text-white border-emerald-500 font-bold shadow-lg shadow-emerald-900/20' : 'bg-transparent text-slate-500 border-slate-700 opacity-50'}`}>
                         {ing.amount} {ing.item}
                       </span>
                     );
                   })}
                 </div>
               </div>
            </div>
          </div>

          <div className="p-6 sm:p-10 bg-slate-800/80 backdrop-blur-xl border-t border-white/5 flex gap-4 shrink-0 pb-safe">
            <button onClick={prevStep} disabled={currentStep === 0} className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center disabled:opacity-20 transition-all active:scale-95">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={nextStep} className="flex-1 h-16 sm:h-20 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm sm:text-lg uppercase tracking-widest shadow-xl shadow-emerald-900/30 transition-all active:scale-95 flex items-center justify-center gap-3">
              {currentStep === selectedRecipe.steps.length - 1 ? 'Terminer ! 🎉' : 'Étape Suivante →'}
            </button>
          </div>
        </div>
      )}

      {/* --- SIDEBAR LISTE DES RECETTES --- */}
      <div className="w-full lg:w-80 xl:w-96 flex flex-col bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden shrink-0 h-full">
        <div className="p-6 sm:p-8 bg-slate-50 border-b border-slate-100 shrink-0">
           <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
             <span className="text-2xl">🔪</span> Mes Recettes
           </h2>
           <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-2">
             {recipes.length} plats uniques
           </p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {recipes.map((recipe) => (
            <button
              key={recipe.id}
              onClick={() => setSelectedRecipeId(recipe.id)}
              className={`w-full text-left p-4 rounded-2xl transition-all duration-300 flex items-center gap-4 border-2 group relative overflow-hidden ${
                selectedRecipeId === recipe.id 
                  ? 'bg-slate-900 border-slate-900 text-white shadow-xl scale-[1.02]' 
                  : 'bg-white border-slate-50 text-slate-600 hover:border-emerald-100 hover:bg-emerald-50/30'
              }`}
            >
              {selectedRecipeId === recipe.id && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500"></div>}

              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 transition-all ${
                selectedRecipeId === recipe.id ? 'bg-white/10 text-emerald-400' : 'bg-slate-100 group-hover:bg-white group-hover:shadow-sm'
              }`}>
                🥗
              </div>
              <div className="flex-1 min-w-0 z-10">
                <p className={`font-black text-sm leading-tight truncate ${selectedRecipeId === recipe.id ? 'text-white' : 'text-slate-800'}`}>
                  {recipe.name}
                </p>
                <div className="flex items-center justify-between mt-1.5 opacity-80">
                  <span className="text-[10px] font-bold">🔥 {recipe.calories}</span>
                  {/* Indicateur de fréquence */}
                  {recipeFrequencies[recipe.id] > 1 && (
                     <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                        selectedRecipeId === recipe.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'
                     }`}>
                       x{recipeFrequencies[recipe.id]}
                     </span>
                  )}
                </div>
              </div>
            </button>
          ))}
          {/* Spacer pour le scroll */}
          <div className="h-10"></div>
        </div>
      </div>

      {/* --- VUE DÉTAILLÉE --- */}
      <div className="flex-1 flex flex-col min-h-0 bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden h-full">
        {selectedRecipe ? (
          <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-500 relative">
            
            {/* Header Artistique */}
            <div className="relative h-64 sm:h-72 bg-slate-900 shrink-0 overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-900"></div>
               <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px] -mr-32 -mt-32 animate-pulse"></div>
               <div className="absolute inset-0 p-8 sm:p-10 flex flex-col justify-end z-10">
                  <div className="flex flex-wrap gap-2 mb-4">
                     <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white text-[10px] font-black uppercase tracking-widest shadow-sm">
                       ⏱️ ~{estimatedTime} min
                     </span>
                     <span className="px-3 py-1 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase tracking-widest shadow-sm">
                       🔥 {selectedRecipe.calories} kcal
                     </span>
                  </div>
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight drop-shadow-lg max-w-3xl line-clamp-2">
                    {selectedRecipe.name}
                  </h1>
               </div>

               <button 
                 onClick={startCooking}
                 className="absolute bottom-8 right-8 bg-emerald-500 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-emerald-500/40 hover:bg-emerald-400 hover:scale-105 transition-all flex items-center gap-2 group z-20"
               >
                 <span>🔥</span> Mode Chef
               </button>
            </div>
            
            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-10 custom-scrollbar">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
                
                {/* Colonne Ingrédients */}
                <div className="xl:col-span-5 space-y-6">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-2">
                    <span className="text-lg">🛒</span> Ingrédients
                  </h3>
                  <div className="space-y-3">
                    {selectedRecipe.ingredients.map((ing, i) => {
                      const isChecked = checkedIngredients.has(`${selectedRecipe.id}-${i}`);
                      return (
                        <div 
                          key={i} 
                          onClick={() => toggleIngredient(i)}
                          className={`flex items-center gap-4 p-3 rounded-xl border-2 transition-all cursor-pointer group ${
                            isChecked 
                              ? 'bg-slate-50 border-slate-100 opacity-50' 
                              : 'bg-white border-slate-50 hover:border-emerald-200 hover:bg-emerald-50/20'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                            isChecked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 bg-white'
                          }`}>
                            {isChecked && <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-sm font-bold truncate ${isChecked ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{ing.item}</p>
                            <p className="text-[10px] font-black text-emerald-600">{ing.amount}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Colonne Préparation */}
                <div className="xl:col-span-7 space-y-6">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-2">
                    <span className="text-lg">👨‍🍳</span> Préparation
                  </h3>
                  <div className="relative pl-4 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                    {selectedRecipe.steps.map((step, i) => (
                      <div key={i} className="relative pl-8 group">
                        <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-white border-4 border-slate-100 group-hover:border-emerald-400 transition-colors z-10 flex items-center justify-center">
                           <div className="w-2 h-2 rounded-full bg-slate-300 group-hover:bg-emerald-500 transition-colors"></div>
                        </div>
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1 block group-hover:text-emerald-500 transition-colors">Étape {i + 1}</span>
                        <p className="text-slate-600 font-medium leading-relaxed text-sm group-hover:text-slate-900 transition-colors">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="h-10"></div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center bg-white p-10 text-center relative overflow-hidden group">
            <div className="relative z-10">
              <div className="w-32 h-32 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-8 mx-auto shadow-inner">
                <span className="text-6xl opacity-30 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500">🥗</span>
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">Sélectionnez une recette</h3>
              <p className="text-slate-400 text-sm max-w-xs mx-auto">Choisissez un plat dans le menu de gauche pour afficher les détails.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecipeList;
