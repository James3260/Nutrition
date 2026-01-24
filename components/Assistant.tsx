
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { chatWithAI, generateMealPlan } from '../services/gemini';
import { MealPlan, User, WorkoutSession, HydrationRecord } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  concept?: {
    title: string;
    description: string;
    exampleMeals: string[];
    startDate?: string;
  };
  timestamp?: Date;
}

interface AssistantProps {
  setMealPlan: (plan: MealPlan) => void;
  user: User;
  onUpdateUser: (updatedUser: User) => void;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

const Assistant: React.FC<AssistantProps> = ({ setMealPlan, user, onUpdateUser, messages, setMessages }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Calcul du contexte "Live" pour l'IA
  const dailyContext = useMemo(() => {
    const todayStr = new Date().toDateString();
    
    const caloriesBurned = (user.workouts || [])
      .filter(w => new Date(w.date).toDateString() === todayStr)
      .reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);
      
    const hydrationCurrent = (user.hydrationRecords || [])
      .filter(r => new Date(r.date).toDateString() === todayStr)
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    // Estimation basique des calories mangées (mockup sans mealPlan précis ici)
    const caloriesEaten = (user.eatenMeals || [])
       .filter(m => new Date(m.date).toDateString() === todayStr)
       .length * 600; // Moyenne arbitraire si pas de data précise

    return {
      caloriesEaten,
      caloriesBurned,
      hydrationCurrent,
      hydrationGoal: user.hydrationGoal || 2000
    };
  }, [user]);

  // Scroll automatique intelligent
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading, isGeneratingPlan]);

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || isGeneratingPlan) return;

    const userMsg = input;
    setInput('');
    setIsLoading(true);

    const newUserMsg: Message = { role: 'user', content: userMsg, timestamp: new Date() };
    setMessages(prev => [...prev, newUserMsg]);

    try {
      // On passe le contexte journalier à l'IA
      const response = await chatWithAI(userMsg, user, messages, dailyContext);

      let updatedUser = { ...user };
      let hasUpdates = false;

      // 1. Mise à jour profil simple
      if (response.extractedInfo && Object.keys(response.extractedInfo).length > 0) {
        updatedUser = { ...updatedUser, ...response.extractedInfo };
        if (response.extractedInfo.weight) {
           updatedUser.weightHistory = [
             ...(user.weightHistory || []), 
             { date: new Date().toISOString(), weight: response.extractedInfo.weight }
           ];
        }
        hasUpdates = true;
      }

      // 2. Traitement des actions spéciales (Sport / Hydratation)
      if (response.actionLog && response.actionLog.length > 0) {
        for (const action of response.actionLog) {
          if (action.type === 'workout') {
            const data = action.data;
            const factorMap: Record<string, number> = { 
               RUNNING: 10, CYCLING: 8, SWIMMING: 9, WALKING: 4, 
               WEIGHTLIFTING: 6, CROSSFIT: 11, HIIT: 12, YOGA: 3, 
               PILATES: 4, TEAM_SPORTS: 8 
            };
            const factor = factorMap[data.type] || 5;
            const intensityMult = data.intensity === 'high' ? 1.2 : data.intensity === 'low' ? 0.8 : 1.0;
            const calories = Math.round(data.duration * factor * intensityMult);

            const newWorkout: WorkoutSession = {
              id: Math.random().toString(36).substr(2, 9),
              date: new Date().toISOString(),
              type: data.type, // L'IA doit renvoyer le type ENUM correct
              duration: data.duration,
              intensity: data.intensity || 'medium',
              caloriesBurned: calories
            };
            updatedUser.workouts = [newWorkout, ...(updatedUser.workouts || [])];
            hasUpdates = true;
          }
          
          if (action.type === 'hydration') {
             const newRecord: HydrationRecord = {
               date: new Date().toISOString(),
               amount: action.data.amount
             };
             updatedUser.hydrationRecords = [...(updatedUser.hydrationRecords || []), newRecord];
             hasUpdates = true;
          }
        }
      }

      if (hasUpdates) {
        onUpdateUser(updatedUser);
      }

      const newAiMsg: Message = { 
        role: 'assistant', 
        content: response.reply, 
        concept: response.suggestedConcept,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, newAiMsg]);

    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Désolé, une erreur technique est survenue.", timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePlan = async (concept: any) => {
    if (isGeneratingPlan) return;
    setIsGeneratingPlan(true);

    // Feedback visuel immédiat dans le chat
    setMessages(prev => [...prev, { 
      role: 'assistant', 
      content: `Entendu ! Je génère votre programme "${concept.title}" pour commencer le ${concept.startDate || "dès que possible"}. Cela prend environ 15 secondes...`, 
      timestamp: new Date() 
    }]);

    try {
      // APPEL AU SERVICE GEMINI QUI RETOURNE LE JSON COMPLET
      const plan = await generateMealPlan(concept, user);
      
      // MISE À JOUR DE L'ETAT GLOBAL DE L'APPLICATION
      setMealPlan(plan);
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "✅ C'est prêt ! J'ai mis à jour votre Agenda, vos Recettes et votre Liste de courses. Vous pouvez consulter les autres onglets.", 
        timestamp: new Date() 
      }]);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Oups, la génération a échoué. Veuillez réessayer.", 
        timestamp: new Date() 
      }]);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const clearHistory = () => {
    if(confirm("Effacer tout l'historique de conversation ? Cela ne supprimera pas votre plan actuel.")) {
      setMessages([]);
      setTimeout(() => setIsSidebarOpen(false), 100);
    }
  };

  // --- RENDER ---
  return (
    <div className="flex h-full w-full bg-white relative font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <div className={`
        fixed inset-y-0 left-0 z-[80] w-64 bg-slate-50 border-r border-slate-200 transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:w-72 flex flex-col shrink-0 h-full
      `}>
        <div className="p-4 border-b border-slate-100 flex justify-between items-center h-16 shrink-0">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white text-lg">✨</div>
             <span className="font-bold text-slate-700">Crystal AI</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Profil & Contexte</p>
             <div className="space-y-1">
                <p className="text-xs font-medium text-slate-700">👤 {user.name}</p>
                <p className="text-xs font-medium text-slate-700">⚖️ {user.weightHistory?.slice(-1)[0]?.weight || '--'} kg</p>
                <div className="h-px bg-slate-100 my-2"></div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Aujourd'hui</p>
                <p className="text-xs font-medium text-blue-600">💧 {dailyContext.hydrationCurrent}/{dailyContext.hydrationGoal}ml</p>
                <p className="text-xs font-medium text-orange-600">🔥 {dailyContext.caloriesBurned} kcal brûlées</p>
             </div>
          </div>

          <button 
            onClick={clearHistory}
            className="w-full flex items-center gap-3 px-3 py-3 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
          >
            <span className="text-lg">🗑️</span> Nouvelle conversation
          </button>
        </div>

        <div className="p-4 border-t border-slate-100 shrink-0">
           <div className="flex items-center gap-3 px-3 py-2 bg-slate-100 rounded-xl">
              <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center text-slate-600 font-bold">
                 {user.name[0]}
              </div>
              <div className="min-w-0">
                 <p className="text-xs font-bold text-slate-800 truncate">{user.name}</p>
                 <p className="text-[10px] text-slate-500 truncate">Mode Connecté</p>
              </div>
           </div>
        </div>
      </div>

      {/* OVERLAY MOBILE pour Sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-[70] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col min-w-0 h-full bg-white relative">
        
        {/* HEADER MOBILE (visible uniquement sur mobile) */}
        <div className="lg:hidden h-14 border-b border-slate-100 flex items-center px-4 justify-between shrink-0 bg-white z-10">
           <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-600">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
           </button>
           <span className="font-bold text-slate-800">Crystal AI</span>
           <div className="w-8"></div>
        </div>

        {/* MESSAGES LIST */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 space-y-6 custom-scrollbar scroll-smooth">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center animate-in fade-in duration-700">
               <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-4xl mb-6 shadow-sm">🤖</div>
               <h2 className="text-2xl font-black text-slate-800 mb-2">Comment puis-je vous aider ?</h2>
               <p className="text-slate-400 max-w-xs mx-auto mb-8">Je suis connectée à votre Activité et votre Hydratation.</p>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md w-full">
                  <button onClick={() => setInput("J'ai couru 30 minutes")} className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-left hover:bg-slate-100 transition-colors">
                     <span className="text-lg block mb-1">🏃‍♂️</span>
                     <span className="text-xs font-bold text-slate-700">Enregistrer un sport</span>
                  </button>
                  <button onClick={() => setInput("J'ai bu 500ml d'eau")} className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-left hover:bg-slate-100 transition-colors">
                     <span className="text-lg block mb-1">💧</span>
                     <span className="text-xs font-bold text-slate-700">Ajouter de l'eau</span>
                  </button>
               </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs shrink-0 mt-1 shadow-sm">
                    ✨
                  </div>
                )}

                <div className={`max-w-[85%] sm:max-w-[75%] space-y-2`}>
                   <div className={`
                     px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed shadow-sm whitespace-pre-wrap
                     ${msg.role === 'user' 
                       ? 'bg-slate-800 text-white rounded-tr-none' 
                       : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'}
                   `}>
                     {msg.content}
                   </div>
                   
                   {msg.concept && (
                     <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mt-2 animate-in slide-in-from-left-4">
                        <h4 className="font-black text-emerald-800 text-sm mb-1">{msg.concept.title}</h4>
                        <p className="text-emerald-700 text-xs mb-3">{msg.concept.description}</p>
                        {msg.concept.startDate && (
                          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-3">Début : {msg.concept.startDate}</p>
                        )}
                        <div className="space-y-1 mb-3">
                           {msg.concept.exampleMeals.map((meal, idx) => (
                             <div key={idx} className="flex items-center gap-2 text-xs text-emerald-600">
                                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                                {meal}
                             </div>
                           ))}
                        </div>
                        <button 
                          onClick={() => handleGeneratePlan(msg.concept)}
                          disabled={isGeneratingPlan}
                          className={`w-full py-3 rounded-lg text-xs font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${
                            isGeneratingPlan 
                            ? 'bg-emerald-100 text-emerald-400 cursor-wait' 
                            : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg hover:shadow-xl active:scale-95'
                          }`}
                        >
                           {isGeneratingPlan ? (
                             <>
                               <span className="w-3 h-3 border-2 border-emerald-400 border-t-emerald-600 rounded-full animate-spin"></span>
                               Génération en cours...
                             </>
                           ) : (
                             <>✨ Générer ce programme</>
                           )}
                        </button>
                     </div>
                   )}
                   
                   <p className={`text-[10px] text-slate-300 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                      {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                   </p>
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-xs shrink-0 mt-1">
                    {user.name[0]}
                  </div>
                )}
              </div>
            ))
          )}
          
          {(isLoading || isGeneratingPlan) && (
            <div className="flex gap-4">
               <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs shrink-0 mt-1">✨</div>
               <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex gap-1 items-center">
                  <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:0.1s]"></span>
                  <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]"></span>
               </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>

        {/* INPUT AREA */}
        <div className="p-4 border-t border-slate-100 bg-white shrink-0 z-20">
          <div className="max-w-3xl mx-auto relative">
             <form onSubmit={handleTextSubmit} className="relative flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-3xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ex: J'ai couru 1h ou J'ai bu de l'eau..."
                  className="w-full bg-transparent border-none outline-none text-sm text-slate-800 placeholder:text-slate-400 px-4 py-3 max-h-32"
                  autoComplete="off"
                />
                <button 
                  type="submit" 
                  disabled={!input.trim() || isLoading || isGeneratingPlan}
                  className={`
                    p-3 rounded-2xl flex items-center justify-center transition-all duration-200
                    ${input.trim() && !isLoading && !isGeneratingPlan
                      ? 'bg-emerald-600 text-white shadow-md hover:bg-emerald-500 transform hover:scale-105' 
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
                  `}
                >
                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                   </svg>
                </button>
             </form>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Assistant;
