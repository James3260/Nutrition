
import React, { useState, useEffect } from 'react';
import { MealPlan } from '../types';

interface ShoppingListProps {
  mealPlan: MealPlan | null;
}

const ShoppingList: React.FC<ShoppingListProps> = ({ mealPlan }) => {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  // Chargement de l'état coché au démarrage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('shopping_checked');
      if (saved) {
        setCheckedItems(new Set(JSON.parse(saved)));
      }
    } catch (e) {
      console.warn("Impossible de charger la liste de courses");
    }
  }, []);

  // Sauvegarde automatique lors des changements
  useEffect(() => {
    const array = Array.from(checkedItems);
    localStorage.setItem('shopping_checked', JSON.stringify(array));
  }, [checkedItems]);

  if (!mealPlan) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
        <p className="text-slate-400">Votre liste de courses apparaîtra ici une fois le plan validé.</p>
      </div>
    );
  }

  // Aggregate ingredients
  const aggregated: Record<string, string[]> = {};
  mealPlan.recipes.forEach(recipe => {
    recipe.ingredients.forEach(ing => {
      const key = ing.item.toLowerCase();
      if (!aggregated[key]) aggregated[key] = [];
      aggregated[key].push(ing.amount);
    });
  });

  const toggleItem = (item: string) => {
    const next = new Set(checkedItems);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    setCheckedItems(next);
  };

  const clearChecked = () => {
    if (confirm('Voulez-vous retirer tous les articles cochés de la vue ? (Simulation)')) {
       // Dans une vraie app, on pourrait masquer. Ici on reset juste la sélection.
       setCheckedItems(new Set());
    }
  };

  const progress = Math.round((checkedItems.size / Object.keys(aggregated).length) * 100) || 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div className="bg-white rounded-[2rem] shadow-premium border border-slate-100 overflow-hidden relative">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-500 px-6 py-8 text-white flex justify-between items-end relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
          <div className="relative z-10">
            <h2 className="text-2xl font-black tracking-tight">Liste de Courses</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mt-1">{Object.keys(aggregated).length} ingrédients pour 30 jours</p>
          </div>
          <div className="relative z-10 flex gap-2">
            <button 
              onClick={() => window.print()} 
              className="w-10 h-10 bg-white/10 rounded-xl hover:bg-white/20 transition-colors flex items-center justify-center backdrop-blur-md"
              title="Imprimer"
            >
              🖨️
            </button>
             <button 
              onClick={clearChecked} 
              className="w-10 h-10 bg-white/10 rounded-xl hover:bg-white/20 transition-colors flex items-center justify-center backdrop-blur-md"
              title="Réinitialiser"
            >
              ↺
            </button>
          </div>
        </div>
        
        {/* Barre de progression */}
        <div className="h-1.5 w-full bg-slate-100">
           <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${progress}%` }}></div>
        </div>

        <div className="p-4 sm:p-6 divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
          {Object.entries(aggregated).sort().map(([item, amounts]) => (
            <div 
              key={item} 
              onClick={() => toggleItem(item)}
              className={`py-4 flex items-center gap-4 cursor-pointer group hover:bg-slate-50 px-3 rounded-xl transition-all ${checkedItems.has(item) ? 'opacity-40' : 'opacity-100'}`}
            >
              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300 ${
                checkedItems.has(item) ? 'bg-emerald-500 border-emerald-500 scale-90' : 'border-slate-300 bg-white'
              }`}>
                {checkedItems.has(item) && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className={`capitalize font-bold text-sm sm:text-base text-slate-700 block truncate transition-all ${checkedItems.has(item) ? 'line-through text-slate-400' : ''}`}>
                  {item}
                </span>
                <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium truncate mt-0.5">
                  {Array.from(new Set(amounts)).slice(0, 3).join(', ')}{amounts.length > 3 ? '...' : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
        Sauvegarde automatique locale active
      </p>
    </div>
  );
};

export default ShoppingList;
