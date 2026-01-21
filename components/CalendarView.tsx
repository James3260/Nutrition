
import React, { useState } from 'react';
import { MealPlan } from '../types';

interface CalendarViewProps {
  mealPlan: MealPlan | null;
}

const CalendarView: React.FC<CalendarViewProps> = ({ mealPlan }) => {
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

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

  const daysOfWeek = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const getRecipe = (id: string) => mealPlan.recipes.find(r => r.id === id);

  // Calcul des dates réelles
  const startDate = mealPlan.startDate ? new Date(mealPlan.startDate) : new Date();
  
  const getActualDate = (dayIndex: number) => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + dayIndex);
    return d;
  };

  const selectedDayData = selectedDayIndex !== null ? mealPlan.days[selectedDayIndex] : null;
  const selectedDate = selectedDayIndex !== null ? getActualDate(selectedDayIndex) : null;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Mon Programme</h2>
          <p className="text-slate-400 font-bold mt-1 uppercase tracking-widest text-xs">
            Calendrier personnalisé • Débuté le {startDate.toLocaleDateString('fr-FR')}
          </p>
        </div>
        <div className="bg-emerald-50 text-emerald-700 px-6 py-2 rounded-2xl font-black text-xs uppercase tracking-widest">
          {startDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
        {/* Days Header */}
        <div className="grid grid-cols-7 bg-slate-50/50 border-b border-slate-100">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
            <div key={day} className="py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{day}</div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7">
          {mealPlan.days.map((day, index) => {
            const actualDate = getActualDate(index);
            const lunch = getRecipe(day.lunch);
            const dinner = getRecipe(day.dinner);
            const isToday = actualDate.toDateString() === new Date().toDateString();

            return (
              <div 
                key={index} 
                onClick={() => setSelectedDayIndex(index)}
                className={`min-h-[140px] p-2 border-r border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group relative ${isToday ? 'bg-emerald-50/30' : ''}`}
              >
                <div className="flex justify-between items-start">
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${isToday ? 'bg-emerald-600 text-white' : 'text-slate-300 group-hover:text-emerald-500'}`}>
                    {actualDate.getDate().toString().padStart(2, '0')}
                  </span>
                  {isToday && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>}
                </div>
                
                <div className="mt-3 space-y-2">
                  <div className="bg-amber-50/50 rounded-lg p-1.5 border border-amber-100/30">
                    <p className="text-[10px] font-black text-slate-700 truncate leading-tight">{lunch?.name}</p>
                  </div>
                  <div className="bg-indigo-50/50 rounded-lg p-1.5 border border-indigo-100/30">
                    <p className="text-[10px] font-black text-slate-700 truncate leading-tight">{dinner?.name}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Détail */}
      {selectedDayIndex !== null && selectedDayData && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-slate-900 p-8 text-white flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-black capitalize">
                  {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                <p className="text-emerald-400 font-bold uppercase tracking-widest text-[10px] mt-1">
                  Jour {selectedDayIndex + 1} de votre programme
                </p>
              </div>
              <button onClick={() => setSelectedDayIndex(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l18 18" />
                </svg>
              </button>
            </div>
            
            <div className="p-8 space-y-6 bg-slate-50/50">
              {['lunch', 'dinner'].map(type => {
                const recipeId = (selectedDayData as any)[type];
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
              <button onClick={() => setSelectedDayIndex(null)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
