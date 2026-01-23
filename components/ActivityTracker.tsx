
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

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

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

  // BMR & Balance
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

  // Hydration logic
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
    if (val < 18.5) return { label: 'Insuffisance pondérale', color: 'text-blue-500', bg: 'bg-blue-50' };
    if (val < 25) return { label: 'Poids normal', color: 'text-emerald-500', bg: 'bg-emerald-50' };
    if (val < 30) return { label: 'Surpoids', color: 'text-orange-500', bg: 'bg-orange-50' };
    return { label: 'Obésité', color: 'text-red-500', bg: 'bg-red-50' };
  };

  const bmiCategory = bmi ? getBmiCategory(parseFloat(bmi)) : null;

  const sortedWeightHistory = useMemo(() => {
    return [...weightHistory].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
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
        pointRadius: 6,
        pointHoverRadius: 8,
        tension: 0.4,
        fill: true,
      }
    ];

    if (weightGoal) {
      datasets.push({
        label: 'Objectif',
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
      legend: {
        display: true,
        position: 'top' as const,
        labels: { font: { family: 'Inter', weight: 'bold' as const, size: 10 }, usePointStyle: true, boxWidth: 8 }
      },
      tooltip: {
        backgroundColor: '#1e293b',
        titleFont: { size: 12, weight: 'bold' as const },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 12,
        displayColors: false,
        callbacks: {
          label: (context: any) => `${context.dataset.label}: ${context.parsed.y} ${context.dataset.label.includes('Poids') ? 'kg' : ''}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: { font: { weight: 'bold' as const, size: 10 }, color: '#94a3b8' },
        grid: { color: 'rgba(241, 245, 249, 1)', drawBorder: false }
      },
      x: {
        ticks: { font: { weight: 'bold' as const, size: 10 }, color: '#94a3b8' },
        grid: { display: false, drawBorder: false }
      }
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500 pb-20">
      <div className="lg:col-span-4 space-y-6">
        {/* Balance Card */}
        <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 mb-4">Statut Métabolique</h2>
          <p className="text-4xl font-black mb-2">{energyBalance > 0 ? '+' : ''}{energyBalance} <span className="text-sm font-bold opacity-40 uppercase">kcal/jour</span></p>
          <div className="w-full bg-white/10 h-2 rounded-full mt-6 overflow-hidden">
             <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${Math.min(100, Math.abs((energyBalance / 1000) * 100))}%` }}></div>
          </div>
        </div>

        {/* Weight Management */}
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-8 space-y-8">
          <div>
            <h2 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-3">⚖️ Objectif Poids</h2>
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
               <div className="flex justify-between items-center">
                 <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cible</p>
                   {isEditingWeightGoal ? (
                     <div className="flex gap-2">
                       <input type="number" value={tempWeightGoal} onChange={e => setTempWeightGoal(parseFloat(e.target.value))} className="w-20 px-3 py-1 bg-white border rounded-xl text-lg font-black" />
                       <button onClick={updateWeightGoal} className="bg-emerald-600 text-white px-3 py-1 rounded-xl text-[10px] font-bold">OK</button>
                     </div>
                   ) : (
                     <p onClick={() => setIsEditingWeightGoal(true)} className="text-3xl font-black text-slate-900 cursor-pointer hover:text-emerald-600 transition-colors">
                       {weightGoal || '--'} <span className="text-sm">kg</span>
                     </p>
                   )}
                 </div>
                 {remainingToGoal && parseFloat(remainingToGoal) > 0 && (
                   <div className="text-right">
                     <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Restant</p>
                     <p className="text-xl font-black text-rose-500">-{remainingToGoal} kg</p>
                   </div>
                 )}
               </div>
            </div>
          </div>

          <form onSubmit={addWeight} className="space-y-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Nouvelle pesée</p>
            <div className="flex gap-2">
              <input type="number" step="0.1" value={weight} onChange={e => setWeight(parseFloat(e.target.value))} className="flex-1 px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-emerald-500/20 rounded-2xl text-lg font-black" />
              <button className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg active:scale-95">Valider</button>
            </div>
          </form>
        </div>

        {/* Sport Session */}
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-8">
          <h2 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-3">🏃 Activité Physique</h2>
          <form onSubmit={addWorkout} className="space-y-4">
            <select value={workoutType} onChange={e => setWorkoutType(e.target.value)} className="w-full px-6 py-4 rounded-2xl border-2 border-slate-50 bg-slate-50 font-bold text-sm outline-none focus:border-emerald-500/20 transition-all">
                <option>Course à pied</option>
                <option>Musculation</option>
                <option>Natation</option>
                <option>Vélo</option>
                <option>Yoga / Pilates</option>
                <option>HIIT</option>
            </select>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Minutes</label>
                  <input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value))} className="w-full px-6 py-4 rounded-2xl bg-slate-50 font-black text-sm outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Intensité</label>
                  <select value={intensity} onChange={e => setIntensity(e.target.value as any)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 font-bold text-sm outline-none">
                    <option value="low">Faible</option>
                    <option value="medium">Moyenne</option>
                    <option value="high">Élevée</option>
                  </select>
                </div>
            </div>
            <button className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-50 active:scale-95">Enregistrer la séance</button>
          </form>
        </div>
      </div>

      <div className="lg:col-span-8 space-y-8">
        {/* Charts Section */}
        <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 p-10 overflow-hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Courbe d'évolution</h2>
              <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">Analyse de la perte de poids</p>
            </div>
            {bmi && (
               <div className={`px-6 py-3 rounded-2xl ${bmiCategory?.bg} border border-slate-100 flex items-center gap-3`}>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Mon IMC</p>
                    <p className={`text-xl font-black ${bmiCategory?.color}`}>{bmi}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl ${bmiCategory?.bg} border border-current opacity-20`}></div>
               </div>
            )}
          </div>
          
          <div className="h-[400px] w-full relative">
            {weightHistory.length > 1 ? (
              <Line data={chartData} options={chartOptions as any} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center">📉</div>
                <p className="font-black text-[10px] uppercase tracking-widest">En attente de données historiques</p>
              </div>
            )}
          </div>
        </div>

        {/* Hydration Section */}
        <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 p-10">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">💧 Hydratation</h2>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-slate-400 uppercase">Cible : {hydrationGoal}ml</span>
              <button onClick={() => setIsEditingGoal(true)} className="p-2 hover:bg-slate-50 rounded-lg text-blue-500">⚙️</button>
            </div>
          </div>

          {isEditingGoal && (
            <div className="mb-8 p-6 bg-blue-50 rounded-[2rem] border border-blue-100 flex items-center justify-between animate-in slide-in-from-top-4">
              <div className="flex items-center gap-4">
                <p className="text-sm font-black text-blue-900">Nouvel objectif (ml) :</p>
                <input type="number" value={tempHydrationGoal} onChange={e => setTempHydrationGoal(parseInt(e.target.value))} className="w-24 px-4 py-2 rounded-xl bg-white font-black outline-none border-2 border-transparent focus:border-blue-400" />
              </div>
              <button onClick={updateHydrationGoal} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase">Enregistrer</button>
            </div>
          )}

          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="relative w-48 h-48 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth="10" fill="transparent" className="text-blue-50" />
                <circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth="10" fill="transparent" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="text-blue-500 transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-black text-slate-900 leading-none">{hydrationProgress}%</span>
              </div>
            </div>

            <div className="flex-1 space-y-8 w-full">
              <div>
                <p className="text-5xl font-black text-slate-900 leading-tight">{todayHydration} <span className="text-xl font-normal text-slate-300">/ {hydrationGoal} ml</span></p>
                <p className="text-slate-400 font-bold text-xs mt-2 uppercase tracking-widest">Progression quotidienne</p>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <button onClick={() => addHydration(250)} className="group p-5 rounded-3xl bg-blue-50 border border-transparent hover:border-blue-200 transition-all flex flex-col items-center gap-2">
                   <span className="text-xl group-active:scale-125 transition-transform">🥛</span>
                   <span className="text-[9px] font-black text-blue-600 uppercase">+250ml</span>
                </button>
                <button onClick={() => addHydration(500)} className="group p-5 rounded-3xl bg-blue-600 text-white shadow-xl shadow-blue-100 transition-all flex flex-col items-center gap-2">
                   <span className="text-xl group-active:scale-125 transition-transform">🧪</span>
                   <span className="text-[9px] font-black uppercase">+500ml</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityTracker;
