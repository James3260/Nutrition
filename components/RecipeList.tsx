
import React, { useState } from 'react';
import { MealPlan, User } from '../types';

interface RecipeListProps {
  mealPlan: MealPlan | null;
  user: User;
}

const RecipeList: React.FC<RecipeListProps> = ({ mealPlan, user }) => {
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [isCookingMode, setIsCookingMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  if (!mealPlan) {
    return (
      <div className="flex flex-col items-center justify-center py-24 sm:py-32 bg-white rounded-[2rem] md:rounded-[3rem] border-2 border-dashed border-slate-200 px-6 text-center">
        <div className="text-5xl sm:text-6xl mb-6 float">📖</div>
        <p className="text-slate-800 font-black text-lg sm:text-xl">Livre de recettes vide</p>
        <p className="text-slate-400 text-[10px] sm:text-sm mt-2 max-w-xs leading-relaxed">Votre assistant IA générera vos recettes sur-mesure ici une fois votre programme activé.</p>
      </div>
    );
  }

  const recipes = mealPlan.recipes;
  const selectedRecipe = recipes.find(r => r.id === selectedRecipeId);

  const startCooking = () => {
    setIsCookingMode(true);
    setCurrentStep(0);
  };

  const nextStep = () => {
    if (selectedRecipe && currentStep < selectedRecipe.steps.length - 1) {
      setCurrentStep(c => c + 1);
    } else {
      setIsCookingMode(false); // Fin
    }
  };

  const prevStep = () => {
    if (currentStep > 0) setCurrentStep(c => c - 1);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 animate-in fade-in duration-500 pb-10">
      
      {/* Mode Cuisine Immersive Overlay */}
      {isCookingMode && selectedRecipe && (
        <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col animate-in zoom-in-95 duration-300">
          {/* Progress Bar */}
          <div className="w-full h-2 bg-slate-800">
            <div 
              className="h-full bg-emerald-500 transition-all duration-500 ease-out" 
              style={{ width: `${((currentStep + 1) / selectedRecipe.steps.length) * 100}%` }}
            ></div>
          </div>

          {/* Header */}
          <div className="px-6 py-6 flex justify-between items-center text-white shrink-0">
            <div>
              <h2 className="text-lg font-black tracking-tight">{selectedRecipe.name}</h2>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                Étape {currentStep + 1} sur {selectedRecipe.steps.length}
              </p>
            </div>
            <button 
              onClick={() => setIsCookingMode(false)}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 max-w-4xl mx-auto w-full">
            <div className="space-y-8">
               <span className="inline-block px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-black uppercase tracking-widest mb-4">
                 Action
               </span>
               <p className="text-2xl sm:text-4xl md:text-5xl font-bold text-white leading-tight">
                 {selectedRecipe.steps[currentStep]}
               </p>
               
               {/* Ingredients helper for current step (mockup logic) */}
               <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                 <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3 font-bold">Ingrédients Rappel</p>
                 <div className="flex flex-wrap gap-2">
                   {selectedRecipe.ingredients.map((ing, i) => (
                     <span key={i} className={`text-xs px-3 py-1.5 rounded-lg border ${selectedRecipe.steps[currentStep].toLowerCase().includes(ing.item.toLowerCase().split(' ')[0]) ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-transparent text-slate-500 border-slate-700'}`}>
                       {ing.amount} {ing.item}
                     </span>
                   ))}
                 </div>
               </div>
            </div>
          </div>

          {/* Controls */}
          <div className="p-6 sm:p-10 bg-slate-800/50 backdrop-blur-md border-t border-white/5 flex gap-4 shrink-0">
            <button 
              onClick={prevStep}
              disabled={currentStep === 0}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center disabled:opacity-20 transition-all"
            >
              ←
            </button>
            <button 
              onClick={nextStep}
              className="flex-1 h-16 sm:h-20 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-lg sm:text-xl uppercase tracking-widest shadow-xl shadow-emerald-900/50 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              {currentStep === selectedRecipe.steps.length - 1 ? 'Terminer ! 🎉' : 'Étape Suivante →'}
            </button>
          </div>
        </div>
      )}

      {/* Sidebar List - Horizontale sur mobile, Verticale sur Desktop */}
      <div className="lg:col-span-4 space-y-4 sm:space-y-6">
        <div className="bg-slate-900 p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] text-white shadow-xl">
           <h2 className="text-lg sm:text-xl font-black flex items-center gap-3">
             <span className="text-xl sm:text-2xl">👩‍🍳</span> Mes Assiettes
           </h2>
           <p className="text-[8px] sm:text-[10px] text-emerald-400 font-black uppercase tracking-[0.2em] mt-2">Grammages personnalisés</p>
        </div>
        
        <div className="flex lg:block gap-3 overflow-x-auto lg:overflow-y-auto lg:max-h-[65vh] pb-4 lg:pb-0 lg:pr-2 no-scrollbar snap-x snap-mandatory">
          {recipes.map((recipe) => (
            <button
              key={recipe.id}
              onClick={() => setSelectedRecipeId(recipe.id)}
              className={`min-w-[260px] sm:min-w-[300px] lg:min-w-0 lg:w-full text-left p-4 sm:p-5 rounded-[1.5rem] lg:rounded-3xl transition-all flex items-center gap-4 border-2 shrink-0 snap-center mb-0 lg:mb-4 ${
                selectedRecipeId === recipe.id 
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-xl lg:translate-x-2' 
                  : 'bg-white border-white text-slate-600 hover:border-slate-100 shadow-sm'
              }`}
            >
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center text-lg shrink-0 transition-transform ${selectedRecipeId === recipe.id ? 'bg-white/20 rotate-6' : 'bg-slate-50'}`}>🥗</div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-xs sm:text-sm leading-tight truncate uppercase tracking-tight">{recipe.name}</p>
                <p className={`text-[8px] sm:text-[10px] font-bold mt-1 ${selectedRecipeId === recipe.id ? 'text-white/80' : 'text-slate-400'}`}>
                  {recipe.calories} kcal • {recipe.ingredients.length} ingr.
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail View */}
      <div className="lg:col-span-8">
        {selectedRecipe ? (
          <div className="bg-white rounded-[2rem] sm:rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden min-h-[500px] sm:min-h-[700px] animate-in slide-in-from-right-10 duration-500 relative">
            
            {/* Start Cooking Floating Button (Mobile friendly) */}
            <div className="absolute top-6 right-6 z-20">
               <button 
                 onClick={startCooking}
                 className="bg-white/20 backdrop-blur-md hover:bg-white text-white hover:text-emerald-600 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-white/40 shadow-xl transition-all flex items-center gap-2"
               >
                 <span>👨‍🍳</span> Cuisiner
               </button>
            </div>

            <div className="min-h-[160px] sm:h-60 bg-gradient-to-br from-emerald-500 to-teal-700 p-6 sm:p-10 flex items-end relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
              <div className="relative z-10 w-full">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
                  <span className="bg-white/20 backdrop-blur-md text-white text-[7px] sm:text-[9px] font-black px-2 sm:px-3 py-1 sm:py-1.5 rounded-full uppercase tracking-widest border border-white/30">Ratio Perte de Poids</span>
                  <span className="text-white/80 font-bold text-[8px] sm:text-xs">{selectedRecipe.calories} kcal par portion</span>
                </div>
                <h1 className="text-xl sm:text-3xl lg:text-4xl font-black text-white leading-tight drop-shadow-sm w-[80%]">{selectedRecipe.name}</h1>
              </div>
            </div>
            
            <div className="p-6 sm:p-10">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 lg:gap-12">
                {/* Ingredients */}
                <div className="space-y-6 sm:space-y-8">
                  <div className="flex items-center gap-4">
                    <span className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center font-black text-sm sm:text-base shadow-inner">1</span>
                    <h3 className="text-sm sm:text-lg font-black text-slate-800 uppercase tracking-widest">Ingrédients</h3>
                  </div>
                  
                  <div className="space-y-2">
                    {selectedRecipe.ingredients.map((ing, i) => (
                      <div key={i} className="flex justify-between items-center p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition-colors group">
                        <span className="text-xs sm:text-sm font-bold text-slate-600 capitalize group-hover:text-slate-900 truncate pr-4">{ing.item}</span>
                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                          <span className="text-[7px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest hidden sm:inline">Poids :</span>
                          <span className="text-[10px] sm:text-sm font-black text-emerald-600 bg-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-emerald-100 shadow-sm">{ing.amount}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Steps */}
                <div className="space-y-6 sm:space-y-8">
                  <div className="flex items-center gap-4">
                    <span className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center font-black text-sm sm:text-base shadow-inner">2</span>
                    <h3 className="text-sm sm:text-lg font-black text-slate-800 uppercase tracking-widest">Préparation</h3>
                  </div>

                  <div className="relative pl-6 sm:pl-8 space-y-6 sm:space-y-8 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                    {selectedRecipe.steps.map((step, i) => (
                      <div key={i} className="relative group">
                        <div className="absolute -left-[1.75rem] sm:-left-[2.15rem] top-1.5 w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 rounded-full border-2 border-white bg-slate-900 group-hover:bg-emerald-500 transition-colors z-10 shadow-sm"></div>
                        <div className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                          <span className="block text-[8px] sm:text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Étape {i + 1}</span>
                          {step}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <button onClick={startCooking} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-emerald-600 transition-all flex items-center justify-center gap-2">
                     <span>🔥</span> Lancer le mode Cuisine
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full min-h-[400px] sm:min-h-[700px] flex flex-col items-center justify-center bg-white rounded-[2rem] sm:rounded-[3rem] border-2 border-dashed border-slate-200 text-slate-300 px-6 text-center animate-in fade-in duration-1000">
            <div className="w-20 h-20 sm:w-32 sm:h-32 bg-slate-50 rounded-[1.5rem] sm:rounded-[2.5rem] flex items-center justify-center mb-6 shadow-sm opacity-50 group">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 sm:h-16 sm:w-16 opacity-10 group-hover:opacity-30 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </div>
            <p className="font-black uppercase tracking-[0.3em] text-[8px] sm:text-xs text-slate-400">Sélectionnez une assiette</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecipeList;
