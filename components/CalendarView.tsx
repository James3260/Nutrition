
import React, { useState } from 'react';
import { MealPlan } from '../types';

interface CalendarViewProps {
  mealPlan: MealPlan | null;
}

const CalendarView: React.FC<CalendarViewProps> = ({ mealPlan }) => {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  if (!mealPlan) {
    return (
      <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
        <div className="text-6xl mb-6">🗓️</div>
        <p className="text-slate-800 font-black text-xl">Aucun programme actif</p>
        <p className="text-slate-400 text-sm mt-2 max-w-xs text-center leading-relaxed">
          Demandez à l'assistant de générer votre plan nutritionnel pour voir votre calendrier se remplir.
        </p>
      </div>
    );
  }

  const daysOfWeek = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const getRecipe = (id: string) => mealPlan.recipes.find(r => r.id === id);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Mon Programme</h2>
          <p className="text-slate-400 font-bold mt-1 uppercase tracking-widest text-xs">Vue Mensuelle Interactive</p>
        </div>
        <div className="bg-emerald-50 text-emerald-700 px-6 py-2 rounded-2xl font-black text-xs uppercase tracking-widest">
          Mois de Vitalité
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
        {/* Days Header */}
        <div className="grid grid-cols-7 bg-slate-50/50 border-b border-slate-100">
          {daysOfWeek.map(day => (
            <div key={day} className="py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{day}</div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7">
          {mealPlan.days.map((day) => {
            const lunch = getRecipe(day.lunch);
            const dinner = getRecipe(day.dinner);

            return (
              <div 
                key={day.day} 
                onClick={() => setSelectedDay(day.day)}
                className={`min-h-[140px] p-2 border-r border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group relative ${day.day % 7 === 0 ? 'border-r-0' : ''}`}
              >
                <span className="text-[10px] font-black text-slate-300 group-hover:text-emerald-500 transition-colors">{day.day.toString().padStart(2, '0')}</span>
                
                <div className="mt-3 space-y-2">
                  <div className="bg-amber-50 rounded-lg p-2 border border-amber-100/50">
                    <p className="text-[9px] font-bold text-amber-700 truncate leading-none mb-1">Midi</p>
                    <p className="text-[10px] font-black text-slate-700 truncate leading-tight">{lunch?.name}</p>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-2 border border-indigo-100/50">
                    <p className="text-[9px] font-bold text-indigo-700 truncate leading-none mb-1">Soir</p>
                    <p className="text-[10px] font-black text-slate-700 truncate leading-tight">{dinner?.name}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail Overlay / Modal */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-slate-900 p-8 text-white flex justify-between items-start">
              <div>
                <h3 className="text-3xl font-black">Jour {selectedDay}</h3>
                <p className="text-emerald-400 font-bold uppercase tracking-widest text-[10px] mt-1">Détails de vos assiettes</p>
              </div>
              <button onClick={() => setSelectedDay(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l18 18" />
                </svg>
              </button>
            </div>
            
            <div className="p-8 space-y-8 bg-slate-50/50">
              {['lunch', 'dinner'].map(type => {
                const recipeId = (mealPlan.days.find(d => d.day === selectedDay) as any)[type];
                const recipe = getRecipe(recipeId);
                return (
                  <div key={type} className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex gap-6 items-center group hover:border-emerald-200 transition-colors">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${type === 'lunch' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                      {type === 'lunch' ? '🍱' : '🌙'}
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{type === 'lunch' ? 'Déjeuner' : 'Dîner'}</p>
                      <h4 className="text-lg font-black text-slate-800 leading-tight">{recipe?.name}</h4>
                      <p className="text-xs text-emerald-600 font-bold mt-1">{recipe?.calories} kcal</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-8 pb-8">
              <button 
                onClick={() => setSelectedDay(null)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all"
              >
                C'est noté
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
