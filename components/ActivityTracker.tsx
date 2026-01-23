
import React, { useState, useMemo } from 'react';
import { User, WorkoutSession, WeightRecord, HydrationRecord } from '../types';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface ActivityTrackerProps {
  user: User;
  onUpdateUser: (updatedUser: User) => void;
}

const ActivityTracker: React.FC<ActivityTrackerProps> = ({ user, onUpdateUser }) => {
  const [workoutType, setWorkoutType] = useState('Course à pied');
  const [duration, setDuration] = useState(30);
  const [intensity, setIntensity] = useState<'low' | 'medium' | 'high'>('medium');
  const [weight, setWeight] = useState(user.weightHistory?.[user.weightHistory.length - 1]?.weight || 70);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempHydrationGoal, setTempHydrationGoal] = useState(user.hydrationGoal || 2000);
  const [isEditingWeightGoal, setIsEditingWeightGoal] = useState(false);
  const [tempWeightGoal, setTempWeightGoal] = useState(user.weightGoal || 65);

  const workouts = user.workouts || [];
  const weightHistory = user.weightHistory || [];
  const hydrationRecords = user.hydrationRecords || [];
  const hydrationGoal = user.hydrationGoal || 2000;
  const weightGoal = user.weightGoal || null;

  const currentWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].weight : null;
  const heightInMeters = user.height ? user.height / 100 : null;

  const todayStr = new Date().toDateString();

  const bmr = useMemo(() => {
    if (!user.height || !user.age || !currentWeight) return 1800;
    if (user.gender === 'man') {
      return Math.round(88.362 + (13.397 * currentWeight) + (4.799 * user.height) - (5.677 * user.age));
    } else {
      return Math.round(447.593 + (9.247 * currentWeight) + (3.098 * user.height) - (4.330 * user.age));
    }
  }, [user, currentWeight]);

  const caloriesBurnedToday = useMemo(() => {
    return workouts
      .filter(w => new Date(w.date).toDateString() === todayStr)
      .reduce((sum, w) => sum + w.caloriesBurned, 0);
  }, [workouts, todayStr]);

  const energyBalance = bmr + caloriesBurnedToday - 1800;

  const todayHydration = useMemo(() => {
    return hydrationRecords
      .filter(r => new Date(r.date).toDateString() === todayStr)
      .reduce((sum, r) => sum + r.amount, 0);
  }, [hydrationRecords, todayStr]);

  const hydrationProgress = Math.min(100, Math.round((todayHydration / hydrationGoal) * 100));
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (hydrationProgress / 100) * circumference;

  const addHydration = (amount: number) => {
    const newRecord: HydrationRecord = { date: new Date().toISOString(), amount };
    onUpdateUser({ ...user, hydrationRecords: [...hydrationRecords, newRecord] });
  };

  const updateHydrationGoal = () => {
    onUpdateUser({ ...user, hydrationGoal: tempHydrationGoal });
    setIsEditingGoal(false);
  };

  const updateWeightGoal = () => {
    onUpdateUser({ ...user, weightGoal: tempWeightGoal });
    setIsEditingWeightGoal(false);
  };

  const bmi = (currentWeight && heightInMeters) 
    ? (currentWeight / (heightInMeters * heightInMeters)).toFixed(1) 
    : null;

  const getBmiCategory = (val: number) => {
    if (val < 18.5) return { label: 'Insuffis.', color: 'text-blue-500', bg: 'bg-blue-50' };
    if (val < 25) return { label: 'Normal', color: 'text-emerald-500', bg: 'bg-emerald-50' };
    if (val < 30) return { label: 'Surpoids', color: 'text-orange-500', bg: 'bg-orange-50' };
    return { label: 'Obésité', color: 'text-red-500', bg: 'bg-red-50' };
  };

  const bmiCategory = bmi ? getBmiCategory(parseFloat(bmi)) : null;

  const sortedWeightHistory = useMemo(() => {
    return [...weightHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [weightHistory]);

  const chartData = useMemo(() => {
    const labels = sortedWeightHistory.map(r => new Date(r.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));
    const datasets: any[] = [
      {
        label: 'Poids (kg)',
        data: sortedWeightHistory.map(r => r.weight),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 4,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#10b981',
        pointBorderWidth: 2,
        pointRadius: 4,
        tension: 0.4,
        fill: true,
      }
    ];
    if (weightGoal) {
      datasets.push({
        label: 'Cible',
        data: sortedWeightHistory.map(() => weightGoal),
        borderColor: '#f43f5e',
        borderWidth: 2,
        borderDash: [10, 5],
        pointRadius: 0,
        fill: false,
      });
    }
    return { labels, datasets };
  }, [sortedWeightHistory, weightGoal]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top' as const, labels: { font: { weight: 'bold' as const, size: 9 }, usePointStyle: true, boxWidth: 6 } },
      tooltip: { cornerRadius: 10, padding: 10, bodyFont: { size: 11 } }
    },
    scales: {
      y: { ticks: { font: { size: 9 } }, grid: { color: '#f1f5f9' } },
      x: { ticks: { font: { size: 9 } }, grid: { display: false } }
    }
  };

  const addWorkout = (e: React.FormEvent) => {
    e.preventDefault();
    const calories = Math.round(duration * (intensity === 'high' ? 10 : intensity === 'medium' ? 7 : 4));
    const newWorkout: WorkoutSession = {
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString(),
      type: workoutType,
      duration,
      intensity,
      caloriesBurned: calories
    };
    onUpdateUser({ ...user, workouts: [newWorkout, ...workouts] });
  };

  const addWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const newRecord: WeightRecord = { date: new Date().toISOString(), weight };
    onUpdateUser({ ...user, weightHistory: [...weightHistory, newRecord] });
  };

  const remainingToGoal = (currentWeight && weightGoal) ? (currentWeight - weightGoal).toFixed(1) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 animate-in fade-in duration-500 pb-10">
      {/* Sidebar Controls */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-slate-900 text-white rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden group">
          <h2 className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.3em] opacity-50 mb-4">Statut Métabolique</h2>
          <p className="text-3xl sm:text-4xl lg:text-5xl font-black mb-2 leading-none">{energyBalance > 0 ? '+' : ''}{energyBalance} <span className="text-xs font-bold opacity-30 uppercase tracking-widest">kcal/j</span></p>
          <div className="w-full bg-white/10 h-2 rounded-full mt-6 overflow-hidden">
             <div className="bg-emerald-500 h-full transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${Math.min(100, Math.abs((energyBalance / 1000) * 100))}%` }}></div>
          </div>
          <div className="absolute -right-4 -bottom-4 text-6xl opacity-10 group-hover:rotate-12 transition-transform">⚡</div>
        </div>

        <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-slate-100 p-6 sm:p-8 space-y-6">
          <h2 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-3">⚖️ Objectif Poids</h2>
          <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-100 flex justify-between items-center transition-colors hover:border-emerald-100">
             <div>
               <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cible</p>
               {isEditingWeightGoal ? (
                 <div className="flex gap-2"><input type="number" value={tempWeightGoal} onChange={e => setTempWeightGoal(parseFloat(e.target.value))} className="w-20 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-sm font-black outline-none focus:border-emerald-500" /><button onClick={updateWeightGoal} className="bg-emerald-600 text-white px-3 py-1.5 rounded-xl text-[9px] font-black uppercase">OK</button></div>
               ) : (
                 <p onClick={() => setIsEditingWeightGoal(true)} className="text-2xl sm:text-3xl font-black text-slate-900 cursor-pointer group hover:text-emerald-600 transition-colors">{weightGoal || '--'}<span className="text-xs font-bold text-slate-300 ml-1">kg</span></p>
               )}
             </div>
             {remainingToGoal && parseFloat(remainingToGoal) > 0 && (
               <div className="text-right">
                 <p className="text-[8px] sm:text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Restant</p>
                 <p className="text-xl sm:text-2xl font-black text-rose-500">-{remainingToGoal}kg</p>
               </div>
             )}
          </div>
          <form onSubmit={addWeight} className="space-y-3">
            <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Nouvelle pesée</p>
            <div className="flex gap-2 sm:gap-3">
              <input type="number" step="0.1" value={weight} onChange={e => setWeight(parseFloat(e.target.value))} className="flex-1 px-4 py-3.5 sm:py-4 bg-slate-50 border-2 border-transparent focus:border-emerald-500/20 rounded-xl sm:rounded-2xl text-base sm:text-lg font-black outline-none transition-all" />
              <button className="bg-slate-900 text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all active:scale-95">OK</button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-slate-100 p-6 sm:p-8">
          <h2 className="text-base sm:text-lg font-black text-slate-800 mb-6 flex items-center gap-3">🏃 Sport Rapide</h2>
          <form onSubmit={addWorkout} className="space-y-4">
            <select value={workoutType} onChange={e => setWorkoutType(e.target.value)} className="w-full px-4 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl border-2 border-slate-50 bg-slate-50 font-bold text-xs sm:text-sm outline-none focus:border-emerald-500/20">
                <option>Course à pied</option><option>Musculation</option><option>Natation</option><option>Vélo</option><option>Yoga</option><option>HIIT</option>
            </select>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value))} className="w-full px-4 py-3.5 rounded-xl bg-slate-50 font-black text-xs sm:text-sm outline-none" placeholder="Min" />
                <select value={intensity} onChange={e => setIntensity(e.target.value as any)} className="w-full px-4 py-3.5 rounded-xl bg-slate-50 font-bold text-xs sm:text-sm outline-none">
                    <option value="low">Faible</option><option value="medium">Moyenne</option><option value="high">Élevée</option>
                </select>
            </div>
            <button className="w-full bg-emerald-600 text-white py-4 rounded-xl sm:rounded-2xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-emerald-50 active:scale-95">Enregistrer Session</button>
          </form>
        </div>
      </div>

      {/* Main Stats & Chart */}
      <div className="lg:col-span-8 space-y-6 lg:space-y-8">
        <div className="bg-white rounded-[2rem] sm:rounded-[3rem] shadow-sm border border-slate-100 p-6 sm:p-8 md:p-10">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
            <div><h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">Courbe d'évolution</h2><p className="text-slate-400 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest mt-1">Analyse morphologique</p></div>
            {bmi && (
               <div className={`px-4 py-2 rounded-xl ${bmiCategory?.bg} border border-slate-100 flex items-center gap-3 self-end sm:self-center shadow-sm`}>
                  <div className="text-right"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">IMC</p><p className={`text-base sm:text-lg font-black ${bmiCategory?.color}`}>{bmi}</p></div>
                  <span className={`text-[8px] font-black uppercase tracking-widest ${bmiCategory?.color}`}>{bmiCategory?.label}</span>
               </div>
            )}
          </div>
          <div className="h-[250px] sm:h-[350px] lg:h-[400px] w-full relative">
            {weightHistory.length > 1 ? (<Line data={chartData} options={chartOptions as any} />) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-3 border-2 border-dashed border-slate-50 rounded-3xl">
                <div className="text-4xl">📉</div>
                <p className="font-black text-[9px] uppercase tracking-[0.3em]">En attente de pesées</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-[2rem] sm:rounded-[3rem] shadow-sm border border-slate-100 p-6 sm:p-8 md:p-10">
          <div className="flex justify-between items-center mb-8"><h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">💧 Hydratation</h2><button onClick={() => setIsEditingGoal(true)} className="p-2.5 bg-slate-50 text-blue-500 rounded-xl hover:bg-blue-50 transition-colors active:scale-90">⚙️</button></div>
          {isEditingGoal && (
            <div className="mb-6 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center justify-between animate-in slide-in-from-top-2"><input type="number" value={tempHydrationGoal} onChange={e => setTempHydrationGoal(parseInt(e.target.value))} className="w-24 px-4 py-2 rounded-xl bg-white font-black text-sm outline-none border border-blue-100 focus:border-blue-400" /><button onClick={updateHydrationGoal} className="bg-blue-600 text-white px-5 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-md">OK</button></div>
          )}
          <div className="flex flex-col md:flex-row items-center gap-8 lg:gap-14">
            <div className="relative w-40 h-40 sm:w-48 sm:h-48 lg:w-56 lg:h-56 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100"><circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth="10" fill="transparent" className="text-blue-50" /><circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth="10" fill="transparent" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="text-blue-500 transition-all duration-1000 drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]" /></svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 leading-none">{hydrationProgress}%</span>
              </div>
            </div>
            <div className="flex-1 w-full space-y-6 sm:space-y-8 text-center md:text-left">
              <div>
                <p className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 leading-tight">{todayHydration}<span className="text-base sm:text-xl font-normal text-slate-300 tracking-widest ml-1"> / {hydrationGoal}ml</span></p>
                <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2">Niveau de vitalité quotidien</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <button onClick={() => addHydration(250)} className="p-4 sm:p-5 rounded-2xl bg-white border border-blue-100 text-blue-600 font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 transition-all active:scale-95 shadow-sm">Verre (+250ml)</button>
                <button onClick={() => addHydration(500)} className="p-4 sm:p-5 rounded-2xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-100/50 hover:bg-blue-700 transition-all active:scale-95">Gourde (+500ml)</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityTracker;
