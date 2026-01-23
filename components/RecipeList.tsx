
import React, { useState } from 'react';
import { MealPlan, User } from '../types';

interface RecipeListProps {
  mealPlan: MealPlan | null;
  user: User;
}

const RecipeList: React.FC<RecipeListProps> = ({ mealPlan, user }) => {
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  if (!mealPlan) {
    return (
      <div className="flex flex-col items-center justify-center py-24 md:py-32 bg-white rounded-[2rem] md:rounded-[3rem] border-2 border-dashed border-slate-200 px-6 text-center">
        <div className="text-5xl md:text-6xl mb-6">📖</div>
        <p className="text-slate-800 font-black text-lg md:text-xl">Livre de recettes vide</p>
        <p className="text-slate-400 text-xs md:text-sm mt-2">Votre assistant IA générera vos recettes sur-mesure ici.</p>
      </div>
    );
  }

  const recipes = mealPlan.recipes;
  const selectedRecipe = recipes.find(r => r.id === selectedRecipeId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10 animate-in fade-in duration-500 pb-24 md:pb-12">
      {/* Sidebar List */}
      <div className="md:col-span-4 space-y-4 md:space-y-6">
        <div className="bg-slate-900 p-6 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] text-white">
           <h2 className="text-lg md:text-xl font-black flex items-center gap-3">
             <span className="text-xl md:text-2xl">👩‍🍳</span> Mes Assiettes
           </h2>
           <p className="text-[8px] md:text-[10px] text-emerald-400 font-black uppercase tracking-widest mt-2">Grammages personnalisés</p>
        </div>
        
        <div className="flex md:block gap-3 overflow-x-auto md:overflow-y-auto md:max-h-[60vh] pb-4 md:pb-0 md:pr-2 no-scrollbar">
          {recipes.map((recipe) => (
            <button
              key={recipe.id}
              onClick={() => setSelectedRecipeId(recipe.id)}
              className={`min-w-[240px] md:min-w-0 md:w-full text-left p-4 md:p-5 rounded-[1.5rem] md:rounded-3xl transition-all flex items-center gap-4 border-2 shrink-0 ${
                selectedRecipeId === recipe.id 
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-xl md:scale-[1.02]' 
                  : 'bg-white border-white text-slate-600 hover:border-slate-100 shadow-sm'
              }`}
            >
              <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center text-lg shrink-0 ${selectedRecipeId === recipe.id ? 'bg-white/20' : 'bg-slate-50'}`}>🥗</div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-xs md:text-sm leading-tight truncate">{recipe.name}</p>
                <p className={`text-[8px] md:text-[10px] font-bold mt-1 ${selectedRecipeId === recipe.id ? 'text-white/80' : 'text-slate-400'}`}>
                  {recipe.calories} kcal • {recipe.ingredients.length} ingr.
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail View */}
      <div className="md:col-span-8">
        {selectedRecipe ? (
          <div className="bg-white rounded-[2rem] md:rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden min-h-[500px] md:min-h-[700px] animate-in slide-in-from-right-10 duration-500">
            <div className="min-h-[140px] md:h-48 bg-gradient-to-br from-emerald-500 to-teal-700 p-6 md:p-10 flex items-end">
              <div>
                <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-3">
                  <span className="bg-white/20 backdrop-blur-md text-white text-[8px] md:text-[10px] font-black px-2 md:px-3 py-1 md:py-1.5 rounded-full uppercase tracking-widest border border-white/30">Ratio Perte de Poids</span>
                  <span className="text-white/40 text-xs hidden md:inline">•</span>
                  <span className="text-white/80 font-bold text-[9px] md:text-xs">{selectedRecipe.calories} kcal par portion</span>
                </div>
                <h1 className="text-2xl md:text-4xl font-black text-white leading-tight drop-shadow-sm">{selectedRecipe.name}</h1>
              </div>
            </div>
            
            <div className="p-6 md:p-10">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 md:gap-12">
                <div className="space-y-6 md:space-y-8">
                  <div className="flex items-center gap-4">
                    <span className="w-8 h-8 md:w-10 md:h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center font-black text-sm md:text-base">1</span>
                    <h3 className="text-base md:text-lg font-black text-slate-800 uppercase tracking-tight">Ingrédients</h3>
                  </div>
                  
                  <div className="space-y-2">
                    {selectedRecipe.ingredients.map((ing, i) => (
                      <div key={i} className="flex justify-between items-center p-3 md:p-4 rounded-xl md:rounded-2xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition-colors group">
                        <span className="text-xs md:text-sm font-bold text-slate-600 capitalize group-hover:text-slate-900">{ing.item}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase">Poids :</span>
                          <span className="text-xs md:text-sm font-black text-emerald-600 bg-white px-2 md:px-3 py-1 md:py-1.5 rounded-lg md:rounded-xl border border-emerald-100 shadow-sm">{ing.amount}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-6 md:space-y-8">
                  <div className="flex items-center gap-4">
                    <span className="w-8 h-8 md:w-10 md:h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center font-black text-sm md:text-base">2</span>
                    <h3 className="text-base md:text-lg font-black text-slate-800 uppercase tracking-tight">Préparation</h3>
                  </div>

                  <div className="relative pl-6 space-y-6 md:space-y-8 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                    {selectedRecipe.steps.map((step, i) => (
                      <div key={i} className="relative group">
                        <div className="absolute -left-[1.75rem] top-1.5 w-3.5 h-3.5 md:w-4 md:h-4 rounded-full border-2 border-white bg-slate-900 group-hover:bg-emerald-500 transition-colors"></div>
                        <p className="text-xs md:text-sm text-slate-600 leading-relaxed font-medium">
                          <span className="block text-[8px] md:text-[10px] font-black text-slate-300 uppercase mb-1">Étape {i + 1}</span>
                          {step}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full min-h-[400px] md:min-h-[700px] flex flex-col items-center justify-center bg-white rounded-[2rem] md:rounded-[3rem] border-2 border-dashed border-slate-200 text-slate-300 px-6 text-center">
            <div className="w-24 h-24 md:w-32 md:h-32 bg-slate-50 rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-center mb-6 animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 md:h-16 md:w-16 opacity-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </div>
            <p className="font-black uppercase tracking-widest text-[9px] md:text-xs text-slate-400">Sélectionnez une recette</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecipeList;
