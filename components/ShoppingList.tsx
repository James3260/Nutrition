
import React, { useState, useEffect, useMemo } from 'react';
import { MealPlan } from '../types';

interface ShoppingListProps {
  mealPlan: MealPlan | null;
}

// Utilitaire pour extraire nombre et unité d'une chaîne (ex: "400g" -> {val: 400, unit: "g"})
const parseQuantity = (amountStr: string) => {
  if (!amountStr) return { val: 1, unit: 'pièce' };
  
  // Nettoyage
  const cleanStr = amountStr.trim().toLowerCase().replace(',', '.');
  
  // Regex pour capturer le chiffre au début
  const match = cleanStr.match(/^(\d+(\.\d+)?)\s*([a-z]+)?/);
  
  if (match) {
    return {
      val: parseFloat(match[1]),
      unit: match[3] || 'pièce' // Si pas d'unité (ex: "2 pommes"), on dit pièce
    };
  }
  
  return { val: 1, unit: amountStr }; // Fallback
};

const ShoppingList: React.FC<ShoppingListProps> = ({ mealPlan }) => {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

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

  useEffect(() => {
    const array = Array.from(checkedItems);
    localStorage.setItem('shopping_checked', JSON.stringify(array));
  }, [checkedItems]);

  // --- COEUR DU CALCUL ---
  // On ne boucle plus sur les recettes uniques, mais sur l'usage dans le calendrier (30 jours)
  const aggregatedList = useMemo(() => {
    if (!mealPlan) return {};

    const totals: Record<string, { amount: number; unit: string; originalItems: Set<string> }> = {};

    // 1. On compte combien de fois chaque recette est utilisée
    const recipeUsageCount: Record<string, number> = {};
    
    mealPlan.days.forEach(day => {
      ['breakfast', 'lunch', 'snack', 'dinner'].forEach(type => {
        const recipeId = (day as any)[type];
        if (recipeId) {
          recipeUsageCount[recipeId] = (recipeUsageCount[recipeId] || 0) + 1;
        }
      });
    });

    // 2. On multiplie les ingrédients par la fréquence
    mealPlan.recipes.forEach(recipe => {
      const usage = recipeUsageCount[recipe.id] || 0;
      if (usage === 0) return; // Si la recette n'est pas dans le plan, on n'achète pas

      recipe.ingredients.forEach(ing => {
        const { val, unit } = parseQuantity(ing.amount);
        const totalVal = val * usage; // Multiplication magique pour le mois
        
        // Clé unique par Ingrédient + Unité (pour ne pas mélanger Litres et Grammes du même truc)
        const key = `${ing.item.toLowerCase()}__${unit}`; 

        if (!totals[key]) {
          totals[key] = { amount: 0, unit: unit, originalItems: new Set() };
        }

        totals[key].amount += totalVal;
        totals[key].originalItems.add(ing.item);
      });
    });

    return totals;
  }, [mealPlan]);

  if (!mealPlan) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
        <p className="text-slate-400">Votre liste de courses apparaîtra ici une fois le plan validé.</p>
      </div>
    );
  }

  const itemsArray = Object.entries(aggregatedList).sort((a, b) => a[0].localeCompare(b[0]));

  const toggleItem = (key: string) => {
    const next = new Set(checkedItems);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setCheckedItems(next);
  };

  const clearChecked = () => {
    if (confirm('Voulez-vous décocher tous les articles ?')) {
       setCheckedItems(new Set());
    }
  };

  const progress = itemsArray.length > 0 
    ? Math.round((checkedItems.size / itemsArray.length) * 100) 
    : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24 px-4 sm:px-0 h-full flex flex-col">
      <div className="bg-white rounded-[2rem] shadow-premium border border-slate-100 overflow-hidden relative flex flex-col flex-1 min-h-0">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-500 px-6 py-8 text-white flex justify-between items-end relative shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none"></div>
          <div className="relative z-10">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Liste du Mois</h2>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest opacity-90 mt-1">
              {itemsArray.length} articles pour 30 jours
            </p>
          </div>
          <div className="relative z-10 flex gap-2">
             <button 
              onClick={clearChecked} 
              className="w-10 h-10 bg-white/10 rounded-xl hover:bg-white/20 transition-colors flex items-center justify-center backdrop-blur-md"
              title="Réinitialiser"
            >
              ↺
            </button>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-slate-100 shrink-0">
           <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${progress}%` }}></div>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-6 divide-y divide-slate-50 custom-scrollbar">
          {itemsArray.map(([key, data]) => {
            const displayName = Array.from(data.originalItems)[0]; // On prend le nom le plus commun
            // Formatage intelligent du nombre (pas de décimales moches)
            const displayAmount = Number.isInteger(data.amount) ? data.amount : data.amount.toFixed(1);

            return (
              <div 
                key={key} 
                onClick={() => toggleItem(key)}
                className={`py-4 px-3 flex items-center gap-4 cursor-pointer group hover:bg-slate-50 rounded-xl transition-all ${checkedItems.has(key) ? 'opacity-40' : 'opacity-100'}`}
              >
                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300 shrink-0 ${
                  checkedItems.has(key) ? 'bg-emerald-500 border-emerald-500 scale-90' : 'border-slate-300 bg-white'
                }`}>
                  {checkedItems.has(key) && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                
                <div className="flex-1 min-w-0 flex justify-between items-center gap-4">
                  <span className={`capitalize font-bold text-sm sm:text-base text-slate-700 truncate transition-all ${checkedItems.has(key) ? 'line-through text-slate-400' : ''}`}>
                    {displayName}
                  </span>
                  
                  <div className="bg-emerald-50 px-3 py-1 rounded-lg text-emerald-700 font-black text-xs sm:text-sm whitespace-nowrap text-right min-w-[80px]">
                    {displayAmount} <span className="text-[10px] uppercase opacity-70">{data.unit}</span>
                  </div>
                </div>
              </div>
            );
          })}
          
          {itemsArray.length === 0 && (
             <div className="py-10 text-center text-slate-400">
                Aucun ingrédient trouvé. Vérifiez votre plan.
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShoppingList;
