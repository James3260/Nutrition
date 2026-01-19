
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
  const [tempGoal, setTempGoal] = useState(user.hydrationGoal || 2000);

  const workouts = user.workouts || [];
  const weightHistory = user.weightHistory || [];
  const hydrationRecords = user.hydrationRecords || [];
  const hydrationGoal = user.hydrationGoal || 2000;

  const currentWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].weight : null;
  const heightInMeters = user.height ? user.height / 100 : null;

  const todayStr = new Date().toDateString();

  // Energy Balance Logic
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

  const estimatedCaloriesIn = 1800;
  const energyBalance = bmr + caloriesBurnedToday - estimatedCaloriesIn;

  // Hydration logic - FIXED
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
    const newRecord: HydrationRecord = {
      date: new Date().toISOString(),
      amount
    };
    onUpdateUser({
      ...user,
      hydrationRecords: [...hydrationRecords, newRecord]
    });
  };

  const updateHydrationGoal = () => {
    onUpdateUser({ ...user, hydrationGoal: tempGoal });
    setIsEditingGoal(false);
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

  const correlationData = useMemo(() => {
    if (!heightInMeters) return null;
    return {
      labels: sortedWeightHistory.map(r => new Date(r.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })),
      datasets: [
        {
          label: 'Poids (kg)',
          data: sortedWeightHistory.map(r => r.weight),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          yAxisID: 'y',
          tension: 0.3,
          pointRadius: 3,
        },
        {
          label: 'IMC',
          data: sortedWeightHistory.map(r => (r.weight / (heightInMeters * heightInMeters)).toFixed(2)),
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          yAxisID: 'y1',
          tension: 0.3,
          pointRadius: 3,
          borderDash: [5, 5],
        }
      ]
    };
  }, [sortedWeightHistory, heightInMeters]);

  const correlationOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: { font: { size: 10, weight: 'bold' as const }, usePointStyle: true, boxWidth: 6 }
      },
      tooltip: { mode: 'index' as const, intersect: false },
    },
    scales: {
      y: { type: 'linear' as const, display: true, position: 'left' as const, ticks: { font: { size: 9 } } },
      y1: { type: 'linear' as const, display: true, position: 'right' as const, grid: { drawOnChartArea: false }, ticks: { font: { size: 9 } } },
      x: { ticks: { font: { size: 9 } } }
    },
  };

  const calculateCalories = (type: string, dur: number, inten: string) => {
    const base = dur * 7;
    const multiplier = inten === 'high' ? 1.5 : inten === 'low' ? 0.7 : 1;
    return Math.round(base * multiplier);
  };

  const addWorkout = (e: React.FormEvent) => {
    e.preventDefault();
    const newWorkout: WorkoutSession = {
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString(),
      type: workoutType,
      duration,
      intensity,
      caloriesBurned: calculateCalories(workoutType, duration, intensity)
    };
    onUpdateUser({ ...user, workouts: [newWorkout, ...workouts] });
  };

  const addWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const newRecord: WeightRecord = { date: new Date().toISOString(), weight };
    onUpdateUser({ ...user, weightHistory: [...weightHistory, newRecord] });
  };

  const totalCaloriesWeek = workouts
    .filter(w => new Date(w.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    .reduce((acc, w) => acc + w.caloriesBurned, 0);

  const bmiProgress = useMemo(() => {
    if (sortedWeightHistory.length < 2 || !heightInMeters) return null;
    const firstBmi = sortedWeightHistory[0].weight / (heightInMeters * heightInMeters);
    const lastBmi = sortedWeightHistory[sortedWeightHistory.length - 1].weight / (heightInMeters * heightInMeters);
    return (lastBmi - firstBmi).toFixed(2);
  }, [sortedWeightHistory, heightInMeters]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500 pb-20">
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <h2 className="text-sm font-black uppercase tracking-widest opacity-60 mb-4">Balance Énergétique</h2>
          <p className="text-3xl font-black">+{energyBalance} <span className="text-sm opacity-50">kcal</span></p>
          <div className="w-full bg-white/10 h-1.5 rounded-full mt-4 overflow-hidden">
             <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(100, (energyBalance / 500) * 100)}%` }}></div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">🏋️‍♂️ Nouvelle Séance</h2>
          <form onSubmit={addWorkout} className="space-y-4">
            <select value={workoutType} onChange={e => setWorkoutType(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none bg-slate-50">
                <option>Course à pied</option>
                <option>Musculation</option>
                <option>Natation</option>
                <option>Vélo</option>
                <option>Yoga / Pilates</option>
                <option>HIIT</option>
                <option>Marche active</option>
            </select>
            <div className="grid grid-cols-2 gap-4">
                <input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50" placeholder="Durée" />
                <select value={intensity} onChange={e => setIntensity(e.target.value as any)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50">
                  <option value="low">Faible</option>
                  <option value="medium">Modérée</option>
                  <option value="high">Élevée</option>
                </select>
            </div>
            <button className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all">Enregistrer</button>
          </form>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">⚖️ Nouveau Poids</h2>
          <form onSubmit={addWeight} className="flex gap-2">
            <input type="number" step="0.1" value={weight} onChange={e => setWeight(parseFloat(e.target.value))} className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-sm bg-slate-50" />
            <button className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold">OK</button>
          </form>
        </div>

        {bmi && (
          <div className={`rounded-3xl p-6 border ${bmiCategory?.bg} border-slate-200`}>
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-lg font-bold text-slate-800">Votre IMC</h2>
              <span className={`text-2xl font-black ${bmiCategory?.color}`}>{bmi}</span>
            </div>
            <p className={`text-sm font-bold ${bmiCategory?.color}`}>{bmiCategory?.label}</p>
          </div>
        )}
      </div>

      <div className="lg:col-span-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-emerald-600 text-white p-6 rounded-3xl shadow-lg shadow-emerald-100">
            <p className="text-[10px] font-black uppercase opacity-60 mb-1">Brûlées (7j)</p>
            <h3 className="text-3xl font-black">{totalCaloriesWeek} kcal</h3>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Poids actuel</p>
            <h3 className="text-3xl font-black text-slate-800">{currentWeight || '--'} kg</h3>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Séances (30j)</p>
            <h3 className="text-3xl font-black text-slate-800">{workouts.length}</h3>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-slate-800">📈 Corrélation Poids & IMC</h2>
          </div>
          <div className="h-[300px] w-full">
            {correlationData ? <Line data={correlationData} options={correlationOptions} /> : <p className="text-center text-slate-300 py-20 italic">Données insuffisantes</p>}
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-slate-800">💧 Hydratation</h2>
            {isEditingGoal ? (
                <div className="flex items-center gap-2">
                  <input type="number" value={tempGoal} onChange={e => setTempGoal(parseInt(e.target.value))} className="w-20 px-2 py-1 border rounded text-xs" />
                  <button onClick={updateHydrationGoal} className="bg-blue-500 text-white px-3 py-1 rounded text-[10px] font-bold">OK</button>
                </div>
              ) : (
                <button onClick={() => setIsEditingGoal(true)} className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:underline">
                  Objectif: {hydrationGoal}ml
                </button>
              )}
          </div>

          <div className="flex flex-col md:flex-row items-center gap-10">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-blue-50" />
                <circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="text-blue-500 transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-slate-800 leading-none">{hydrationProgress}%</span>
              </div>
            </div>

            <div className="flex-1 space-y-6 w-full">
              <p className="text-4xl font-black text-slate-800">{todayHydration} <span className="text-lg font-normal text-slate-400">/ {hydrationGoal} ml</span></p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button onClick={() => addHydration(250)} className="p-3 rounded-2xl bg-blue-50 border border-blue-100 text-[10px] font-black text-blue-600">🥛 +250ml</button>
                <button onClick={() => addHydration(500)} className="p-3 rounded-2xl bg-blue-50 border border-blue-100 text-[10px] font-black text-blue-600">🧪 +500ml</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityTracker;
