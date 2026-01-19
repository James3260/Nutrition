
import React, { useState } from 'react';
import { MealPlan } from '../types';

interface ShoppingListProps {
  mealPlan: MealPlan | null;
}

const ShoppingList: React.FC<ShoppingListProps> = ({ mealPlan }) => {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-emerald-600 px-6 py-6 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Liste de Courses du Mois</h2>
            <p className="text-sm opacity-80">{Object.keys(aggregated).length} ingrédients à acheter</p>
          </div>
          <button 
            onClick={() => window.print()} 
            className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          </button>
        </div>

        <div className="p-6 divide-y divide-slate-100">
          {Object.entries(aggregated).sort().map(([item, amounts]) => (
            <div 
              key={item} 
              onClick={() => toggleItem(item)}
              className={`py-3 flex items-center gap-4 cursor-pointer group hover:bg-slate-50 px-2 rounded-lg transition-colors`}
            >
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                checkedItems.has(item) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'
              }`}>
                {checkedItems.has(item) && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <span className={`capitalize font-medium text-slate-700 ${checkedItems.has(item) ? 'line-through text-slate-400' : ''}`}>
                  {item}
                </span>
                <p className="text-[10px] text-slate-400 font-mono">
                  {/* Join amounts but simplify if possible - for this MVP we just list them */}
                  {Array.from(new Set(amounts)).slice(0, 3).join(', ')}{amounts.length > 3 ? '...' : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <p className="text-center text-xs text-slate-400">
        Les quantités sont cumulées sur la base de 30 jours de repas.
      </p>
    </div>
  );
};

export default ShoppingList;
