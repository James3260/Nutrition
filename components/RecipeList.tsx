
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
      <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
        <div className="text-6xl mb-6">📖</div>
        <p className="text-slate-800 font-black text-xl">Livre de recettes vide</p>
        <p className="text-slate-400 text-sm mt-2">Votre assistant IA générera vos recettes sur-mesure ici.</p>
      </div>
    );
  }

  const recipes = mealPlan.recipes;
  const selectedRecipe = recipes.find(r => r.id === selectedRecipeId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-10 animate-in fade-in duration-500">
      {/* Sidebar List */}
      <div className="md:col-span-4 space-y-6">
        <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white">
           <h2 className="text-xl font-black flex items-center gap-3">
             <span className="text-2xl">👩‍🍳</span> Mes Assiettes
           </h2>
           <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest mt-2">Grammages calculés pour vous</p>
        </div>
        
        <div className="space-y-3 overflow-y-auto max-h-[60vh] pr-2 custom-scrollbar">
          {recipes.map((recipe) => (
            <button
              key={recipe.id}
              onClick={() => setSelectedRecipeId(recipe.id)}
              className={`w-full text-left p-5 rounded-3xl transition-all flex items-center gap-4 border-2 ${
                selectedRecipeId === recipe.id 
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xl shadow-emerald-200 scale-[1.02]' 
                  : 'bg-white border-white text-slate-600 hover:border-slate-100 shadow-sm'
              }`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 ${selectedRecipeId === recipe.id ? 'bg-white/20' : 'bg-slate-50'}`}>
                🥗
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm leading-tight truncate">{recipe.name}</p>
                <p className={`text-[10px] font-bold mt-1 ${selectedRecipeId === recipe.id ? 'text-white/80' : 'text-slate-400'}`}>
                  {recipe.calories} kcal • {recipe.ingredients.length} ingrédients
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail View */}
      <div className="md:col-span-8">
        {selectedRecipe ? (
          <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden min-h-[700px] animate-in slide-in-from-right-10 duration-500">
            {/* Header Image-like Area */}
            <div className="h-48 bg-gradient-to-br from-emerald-500 to-teal-700 p-10 flex items-end">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="bg-white/20 backdrop-blur-md text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest border border-white/30">Ratio Perte de Poids</span>
                  <span className="text-white/40 text-xs">•</span>
                  <span className="text-white/80 font-bold text-xs">{selectedRecipe.calories} kcal par portion</span>
                </div>
                <h1 className="text-4xl font-black text-white leading-tight drop-shadow-sm">{selectedRecipe.name}</h1>
              </div>
            </div>
            
            <div className="p-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Ingredients with Focus on Grammage */}
                <div className="space-y-8">
                  <div className="flex items-center gap-4">
                    <span className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center font-black">1</span>
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Liste des Courses Précise</h3>
                  </div>
                  
                  <div className="space-y-2">
                    {selectedRecipe.ingredients.map((ing, i) => (
                      <div key={i} className="flex justify-between items-center p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition-colors group">
                        <span className="text-sm font-bold text-slate-600 capitalize group-hover:text-slate-900">{ing.item}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase">Poids :</span>
                          <span className="text-sm font-black text-emerald-600 bg-white px-3 py-1.5 rounded-xl border border-emerald-100 shadow-sm">{ing.amount}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="p-5 rounded-2xl bg-amber-50 border border-amber-100 flex gap-4 items-start">
                    <span className="text-xl">💡</span>
                    <p className="text-[11px] text-amber-800 leading-relaxed font-bold">
                      {/* Fixed: Added 'user' to props and destructured it to access weightHistory */}
                      Note : Ces quantités ont été optimisées en fonction de votre métabolisme de base ({user.weightHistory?.[user.weightHistory.length-1]?.weight || '--'}kg) pour assurer un déficit calorique sain.
                    </p>
                  </div>
                </div>

                {/* Steps with Timeline Design */}
                <div className="space-y-8">
                  <div className="flex items-center gap-4">
                    <span className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center font-black">2</span>
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Préparation Pas à Pas</h3>
                  </div>

                  <div className="relative pl-6 space-y-8 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                    {selectedRecipe.steps.map((step, i) => (
                      <div key={i} className="relative group">
                        <div className="absolute -left-8 top-1.5 w-4 h-4 rounded-full border-2 border-white bg-slate-900 group-hover:bg-emerald-500 transition-colors"></div>
                        <p className="text-sm text-slate-600 leading-relaxed font-medium">
                          <span className="block text-[10px] font-black text-slate-300 uppercase mb-1">Étape {i + 1}</span>
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
          <div className="h-full min-h-[700px] flex flex-col items-center justify-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200 text-slate-300">
            <div className="w-32 h-32 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-6 animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 opacity-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <p className="font-black uppercase tracking-widest text-xs text-slate-400">Sélectionnez une recette pour cuisiner</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecipeList;
