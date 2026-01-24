
import React, { useState, useMemo } from 'react';
import { MealPlan, Recipe } from '../types';

interface CalendarViewProps {
  mealPlan: MealPlan | null;
}

const CalendarView: React.FC<CalendarViewProps> = ({ mealPlan }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayInfo, setSelectedDayInfo] = useState<{ day: number; date: Date } | null>(null);

  const monthNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  const daysOfWeek = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  const getRecipe = (id?: string) => id ? mealPlan?.recipes.find(r => r.id === id) : undefined;

  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    let startDay = firstDayOfMonth.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1;

    const daysInMonth = lastDayOfMonth.getDate();
    const days = [];

    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  }, [currentDate]);

  // Logique de mappage : Date Réelle -> Index du plan
  const mealMap = useMemo(() => {
    if (!mealPlan || !mealPlan.startDate) return new Map<string, number>();
    const map = new Map<string, number>();
    const start = new Date(mealPlan.startDate);
    start.setHours(0, 0, 0, 0);

    // On mappe chaque jour du plan (0 à 29) vers une date réelle stringifiée
    mealPlan.days.forEach((dayPlan, index) => {
      const d = new Date(start);
      d.setDate(start.getDate() + index);
      map.set(d.toDateString(), index);
    });
    return map;
  }, [mealPlan]);

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  if (!mealPlan) {
    return (
      <div className="flex flex-col items-center justify-center py-20 sm:py-32 bg-white rounded-[2rem] md:rounded-[3rem] border-2 border-dashed border-slate-200 animate-in fade-in duration-500 text-center px-6">
        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-50 rounded-full flex items-center justify-center text-4xl sm:text-5xl mb-6 float shadow-sm">🗓️</div>
        <p className="text-slate-900 font-black text-lg sm:text-xl">Planification inactive</p>
        <p className="text-slate-400 text-[10px] sm:text-sm mt-2 max-w-xs leading-relaxed font-medium">
          Demandez à l'assistant de générer votre programme en précisant une date de début pour voir votre calendrier.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-700 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight">Agenda Nutrition</h2>
          <p className="text-slate-400 font-bold mt-1 uppercase tracking-widest text-[9px] sm:text-[10px]">
            Visualisation mensuelle complète
          </p>
        </div>
        
        {/* Navigation Mois Améliorée */}
        <div className="flex items-center justify-between md:justify-end gap-4 bg-white p-2 rounded-[1.5rem] shadow-lg shadow-slate-100 border border-slate-100">
          <button onClick={prevMonth} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-all active:scale-95">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </button>
          
          <div className="flex flex-col items-center min-w-[120px]">
            <span className="text-sm font-black text-slate-800 uppercase tracking-widest">
              {monthNames[currentDate.getMonth()]}
            </span>
            <span className="text-[10px] font-bold text-slate-400">
              {currentDate.getFullYear()}
            </span>
          </div>

          <button onClick={nextMonth} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-all active:scale-95">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[1.5rem] sm:rounded-[2.5rem] lg:rounded-[3rem] shadow-premium border border-slate-100 overflow-hidden flex flex-col w-full">
        <div className="grid grid-cols-7 bg-slate-50/50 border-b border-slate-100">
          {daysOfWeek.map(day => (
            <div key={day} className="py-2 sm:py-4 text-center text-[7px] sm:text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 w-full">
          {calendarData.map((date, index) => {
            if (!date) return <div key={`empty-${index}`} className="aspect-square sm:min-h-[120px] md:min-h-[160px] bg-slate-50/10 border-r border-b border-slate-100"></div>;
            
            const dateStr = date.toDateString();
            const mealPlanIndex = mealMap.get(dateStr);
            const hasMeals = mealPlanIndex !== undefined;
            const isToday = dateStr === new Date().toDateString();
            
            let lunch, dinner;
            if (hasMeals) {
              const dayData = mealPlan.days[mealPlanIndex!];
              lunch = getRecipe(dayData.lunch);
              dinner = getRecipe(dayData.dinner);
            }

            return (
              <div 
                key={dateStr} 
                onClick={() => hasMeals && setSelectedDayInfo({ day: mealPlanIndex!, date: date })}
                className={`aspect-square sm:min-h-[120px] md:min-h-[160px] p-1 sm:p-2 md:p-3 border-r border-b border-slate-100 transition-all relative group flex flex-col ${hasMeals ? 'cursor-pointer hover:bg-emerald-50/30' : 'bg-slate-50/5 text-slate-300'}`}
              >
                <div className="flex justify-between items-start mb-0.5 sm:mb-1">
                  <span className={`text-[9px] sm:text-[11px] font-black px-1.5 py-0.5 rounded-lg ${isToday ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'text-slate-400'}`}>
                    {date.getDate()}
                  </span>
                  {hasMeals && (
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                    </div>
                  )}
                </div>
                
                {hasMeals && (
                  <div className="hidden sm:flex flex-col flex-1 space-y-1 overflow-hidden mt-1 animate-in fade-in">
                    <div className="bg-amber-50/60 p-1.5 rounded-lg border border-amber-100/20 flex flex-col">
                       <p className="text-[8px] md:text-[9px] font-bold text-slate-700 truncate leading-none">{lunch?.name}</p>
                    </div>
                    <div className="bg-indigo-50/60 p-1.5 rounded-lg border border-indigo-100/20 flex flex-col">
                       <p className="text-[8px] md:text-[9px] font-bold text-slate-700 truncate leading-none">{dinner?.name}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 sm:gap-6 items-center px-1">
        <button onClick={goToToday} className="px-3 py-1.5 text-[10px] font-black text-slate-500 uppercase bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Retour à Aujourd'hui</button>
        <div className="ml-auto flex items-center gap-4">
           <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-amber-400"></div>
              <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Midi</span>
           </div>
           <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-indigo-400"></div>
              <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Soir</span>
           </div>
        </div>
      </div>

      {selectedDayInfo && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-t-[2rem] sm:rounded-[3rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 border border-white max-h-[85vh] flex flex-col">
            <div className="bg-slate-900 p-6 sm:p-8 text-white relative shrink-0">
              <div className="relative z-10">
                <p className="text-emerald-400 font-black uppercase tracking-widest text-[8px] sm:text-[10px] mb-2">Jour {selectedDayInfo.day + 1} du programme</p>
                <h3 className="text-xl sm:text-2xl lg:text-3xl font-black capitalize tracking-tight leading-tight">
                  {selectedDayInfo.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
              </div>
              <button onClick={() => setSelectedDayInfo(null)} className="absolute top-4 sm:top-8 right-4 sm:right-8 p-2 sm:p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all text-white active:scale-90">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-5 sm:p-8 space-y-4 sm:space-y-6 bg-slate-50/50 overflow-y-auto">
              {['breakfast', 'lunch', 'snack', 'dinner'].map((type) => {
                const dayData = mealPlan.days[selectedDayInfo.day];
                const recipeId = (dayData as any)[type]; // Peut être undefined pour snack/breakfast
                
                if (!recipeId) return null;

                const recipe = getRecipe(recipeId);
                const isSnackOrBreakfast = type === 'snack' || type === 'breakfast';
                
                return (
                  <div key={type} className="bg-white rounded-[1.2rem] sm:rounded-[2rem] p-4 sm:p-6 shadow-sm border border-slate-100 flex gap-4 sm:gap-6 items-center group transition-all hover:border-emerald-200">
                    <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-[1rem] sm:rounded-[1.5rem] flex items-center justify-center text-xl sm:text-3xl shadow-sm shrink-0 
                      ${type === 'lunch' ? 'bg-amber-100 text-amber-600' : 
                        type === 'dinner' ? 'bg-indigo-100 text-indigo-600' :
                        type === 'breakfast' ? 'bg-orange-100 text-orange-600' :
                        'bg-pink-100 text-pink-600'
                      }`}>
                      {type === 'lunch' ? '🍱' : type === 'dinner' ? '🌙' : type === 'breakfast' ? '🥐' : '🍎'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[7px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        {type === 'lunch' ? 'Déjeuner' : type === 'dinner' ? 'Dîner' : type === 'breakfast' ? 'Petit Déjeuner' : 'Collation'}
                      </p>
                      <h4 className="text-sm sm:text-lg font-black text-slate-800 leading-tight truncate">{recipe?.name || (isSnackOrBreakfast ? recipeId : '---')}</h4>
                      <div className="flex items-center gap-2 sm:gap-3 mt-1.5">
                        <span className="text-[8px] sm:text-[11px] text-emerald-600 font-black">{recipe?.calories || '?'} kcal</span>
                        {recipe && (
                          <>
                          <span className="text-[8px] sm:text-[11px] text-slate-300 hidden sm:inline">•</span>
                          <span className="text-[8px] sm:text-[11px] text-slate-400 font-bold">{recipe.ingredients.length} ingr.</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-5 sm:p-8 pt-0 shrink-0">
              <button onClick={() => setSelectedDayInfo(null)} className="w-full py-4 sm:py-5 bg-slate-900 text-white rounded-[1.2rem] sm:rounded-[1.5rem] font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
