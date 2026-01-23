
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

  // Helper to get recipe by ID
  const getRecipe = (id: string) => mealPlan?.recipes.find(r => r.id === id);

  // Generate days for the current month view
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

  const mealMap = useMemo(() => {
    if (!mealPlan || !mealPlan.startDate) return new Map<string, number>();
    const map = new Map<string, number>();
    const start = new Date(mealPlan.startDate);
    start.setHours(0, 0, 0, 0);

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
      <div className="flex flex-col items-center justify-center py-20 md:py-32 bg-white rounded-[2rem] md:rounded-[3rem] border-2 border-dashed border-slate-200 animate-in fade-in duration-500 text-center px-6">
        <div className="w-20 h-20 md:w-24 md:h-24 bg-slate-50 rounded-full flex items-center justify-center text-4xl md:text-5xl mb-6 float">🗓️</div>
        <p className="text-slate-900 font-black text-lg md:text-xl">Planification inactive</p>
        <p className="text-slate-400 text-xs md:text-sm mt-2 max-w-xs leading-relaxed font-medium">
          Demandez à l'assistant de générer votre programme pour voir votre calendrier mensuel.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-700 pb-24 md:pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight">Agenda Nutrition</h2>
          <p className="text-slate-400 font-bold mt-1 uppercase tracking-widest text-[9px] md:text-[10px]">
            Visualisation mensuelle
          </p>
        </div>
        
        <div className="flex items-center gap-1 md:gap-2 bg-white p-1 md:p-1.5 rounded-2xl shadow-sm border border-slate-100 self-start md:self-center">
          <button onClick={prevMonth} className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-emerald-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          </button>
          <div className="px-2 md:px-4 min-w-[120px] md:min-w-[140px] text-center">
            <span className="text-[10px] md:text-sm font-black text-slate-800 uppercase tracking-widest">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </span>
          </div>
          <button onClick={nextMonth} className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-emerald-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
          </button>
          <div className="w-px h-6 bg-slate-100 mx-1"></div>
          <button onClick={goToToday} className="px-3 md:px-4 py-2 text-[9px] md:text-[10px] font-black text-emerald-600 uppercase hover:bg-emerald-50 rounded-xl transition-all">Today</button>
        </div>
      </div>

      <div className="bg-white rounded-[1.5rem] md:rounded-[3rem] shadow-premium border border-slate-100 overflow-hidden flex flex-col">
        <div className="grid grid-cols-7 bg-slate-50/50 border-b border-slate-100">
          {daysOfWeek.map(day => (
            <div key={day} className="py-2 md:py-4 text-center text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {calendarData.map((date, index) => {
            if (!date) return <div key={`empty-${index}`} className="aspect-square md:min-h-[160px] bg-slate-50/20 border-r border-b border-slate-100"></div>;
            
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
                className={`aspect-square md:min-h-[160px] p-1.5 md:p-3 border-r border-b border-slate-100 transition-all relative group flex flex-col ${hasMeals ? 'cursor-pointer hover:bg-slate-50/50' : 'opacity-40'}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-[8px] md:text-xs font-black px-1.5 md:px-2 py-0.5 md:py-1 rounded-md md:rounded-lg ${isToday ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'text-slate-400'}`}>
                    {date.getDate()}
                  </span>
                  {hasMeals && (
                    <div className="flex gap-0.5 md:gap-1">
                      <div className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-amber-400"></div>
                      <div className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-indigo-400"></div>
                    </div>
                  )}
                </div>
                
                {hasMeals && (
                  <div className="hidden md:flex flex-1 space-y-1.5 overflow-hidden mt-1">
                    <div className="bg-amber-50/40 p-1.5 rounded-xl border border-amber-100/20 flex flex-col">
                       <span className="text-[7px] font-black text-amber-600 uppercase mb-0.5">Midi</span>
                       <p className="text-[9px] font-bold text-slate-700 truncate leading-none">{lunch?.name}</p>
                    </div>
                    <div className="bg-indigo-50/40 p-1.5 rounded-xl border border-indigo-100/20 flex flex-col">
                       <span className="text-[7px] font-black text-indigo-600 uppercase mb-0.5">Soir</span>
                       <p className="text-[9px] font-bold text-slate-700 truncate leading-none">{dinner?.name}</p>
                    </div>
                  </div>
                )}
                
                {isToday && (
                  <div className="absolute bottom-1 right-1 w-1 h-1 bg-emerald-500 rounded-full animate-pulse md:hidden"></div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 md:gap-6 items-center px-2">
        <div className="flex items-center gap-2">
           <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
           <span className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Déjeuner</span>
        </div>
        <div className="flex items-center gap-2">
           <div className="w-2.5 h-2.5 rounded-full bg-indigo-400"></div>
           <span className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Dîner</span>
        </div>
        <div className="ml-auto bg-white px-3 py-1.5 rounded-xl border border-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-widest">
           Plan 30 jours
        </div>
      </div>

      {selectedDayInfo && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-t-[2.5rem] md:rounded-[3rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300 border border-white">
            <div className="bg-slate-900 p-6 md:p-8 text-white relative">
              <div className="relative z-10">
                <p className="text-emerald-400 font-black uppercase tracking-widest text-[8px] md:text-[10px] mb-2">Jour {selectedDayInfo.day + 1}</p>
                <h3 className="text-xl md:text-3xl font-black capitalize tracking-tight">
                  {selectedDayInfo.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
              </div>
              <button onClick={() => setSelectedDayInfo(null)} className="absolute top-4 md:top-8 right-4 md:right-8 p-2 md:p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 md:p-8 space-y-4 md:space-y-6 bg-slate-50/50">
              {['lunch', 'dinner'].map(type => {
                const dayData = mealPlan.days[selectedDayInfo.day];
                const recipeId = (dayData as any)[type];
                const recipe = getRecipe(recipeId);
                
                return (
                  <div key={type} className="bg-white rounded-[1.5rem] md:rounded-[2.2rem] p-4 md:p-6 shadow-sm border border-slate-100 flex gap-4 md:gap-6 items-center group transition-all">
                    <div className={`w-12 h-12 md:w-16 md:h-16 rounded-[1.2rem] flex items-center justify-center text-2xl md:text-3xl shadow-sm ${type === 'lunch' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                      {type === 'lunch' ? '🍱' : '🌙'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{type === 'lunch' ? 'Midi' : 'Soir'}</p>
                      <h4 className="text-sm md:text-xl font-black text-slate-800 leading-tight truncate">{recipe?.name || '---'}</h4>
                      <div className="flex items-center gap-2 md:gap-3 mt-1.5">
                        <span className="text-[9px] md:text-[11px] text-emerald-600 font-black">{recipe?.calories} kcal</span>
                        <span className="text-[9px] md:text-[11px] text-slate-300">•</span>
                        <span className="text-[9px] md:text-[11px] text-slate-400 font-bold">{recipe?.ingredients.length} ingr.</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-6 md:p-8 pt-0">
              <button onClick={() => setSelectedDayInfo(null)} className="w-full py-4 md:py-5 bg-slate-900 text-white rounded-[1.2rem] md:rounded-[1.5rem] font-black text-[10px] md:text-xs uppercase tracking-widest transition-all shadow-xl">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
