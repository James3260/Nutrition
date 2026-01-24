
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { chatWithAI, generateMealPlan } from '../services/gemini';
import { MealPlan, User, WorkoutSession, HydrationRecord, EatenMealRecord } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  image?: string; // Base64 de l'image envoyée
  concept?: {
    title: string;
    description: string;
    startDate?: string;
    weeklyPreview?: { 
      day: number, 
      breakfast?: string, breakfastWeight?: string,
      lunch: string, lunchWeight: string, 
      snack?: string, snackWeight?: string,
      dinner: string, dinnerWeight: string 
    }[];
  };
  timestamp?: Date;
}

interface AssistantProps {
  setMealPlan: (plan: MealPlan) => void;
  user: User;
  onUpdateUser: (updatedUser: User) => void;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  cloudStatus: 'off' | 'syncing' | 'synced' | 'error';
}

const Assistant: React.FC<AssistantProps> = ({ setMealPlan, user, onUpdateUser, messages, setMessages, cloudStatus }) => {
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calcul du contexte "Live" pour l'IA
  const dailyContext = useMemo(() => {
    const todayStr = new Date().toDateString();
    
    const caloriesBurned = (user.workouts || [])
      .filter(w => new Date(w.date).toDateString() === todayStr)
      .reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);
      
    const hydrationCurrent = (user.hydrationRecords || [])
      .filter(r => new Date(r.date).toDateString() === todayStr)
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    const caloriesEaten = (user.eatenMeals || [])
       .filter(m => new Date(m.date).toDateString() === todayStr)
       .reduce((sum, m) => sum + m.calories, 0);

    return {
      caloriesEaten,
      caloriesBurned,
      hydrationCurrent,
      hydrationGoal: user.hydrationGoal || 2000
    };
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading, isGeneratingPlan]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedImage) || isLoading || isGeneratingPlan) return;

    const userMsgText = input;
    const userImage = selectedImage;
    
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    const newUserMsg: Message = { 
      role: 'user', 
      content: userMsgText, 
      image: userImage || undefined,
      timestamp: new Date() 
    };
    setMessages(prev => [...prev, newUserMsg]);

    try {
      let aiInput: any = userMsgText;
      
      // Préparation de l'input pour Gemini (Multimodal ou Texte)
      if (userImage) {
        // userImage est "data:image/jpeg;base64,....." -> on extrait
        const base64Data = userImage.split(',')[1];
        const mimeType = userImage.split(';')[0].split(':')[1];
        aiInput = {
          imageBase64: base64Data,
          mimeType: mimeType,
          text: userMsgText // Peut être vide
        };
      }

      // On passe le contexte journalier à l'IA
      const response = await chatWithAI(aiInput, user, messages, dailyContext);

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

      // 2. Traitement des actions spéciales (Sport / Hydratation / Repas)
      if (response.actionLog && response.actionLog.length > 0) {
        for (const action of response.actionLog) {
          if (action.type === 'workout') {
            const data = action.data;
            const newWorkout: WorkoutSession = {
              id: Math.random().toString(36).substr(2, 9),
              date: new Date().toISOString(),
              type: data.type || 'ACTIVITY',
              duration: data.duration || 30,
              intensity: data.intensity || 'medium',
              caloriesBurned: data.caloriesEstimate || 200
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
          if (action.type === 'meal') {
             const newMeal: EatenMealRecord = {
               id: Math.random().toString(36).substr(2, 9),
               date: new Date().toISOString(),
               name: action.data.name,
               calories: action.data.calories,
               mealType: action.data.mealType || 'snack',
               imageUrl: userImage || undefined 
             };
             updatedUser.eatenMeals = [...(updatedUser.eatenMeals || []), newMeal];
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

  // NOUVELLE LOGIQUE : Si le plan visuel échoue, on demande le texte (ChatGPT-style)
  const handleGeneratePlan = async (concept: any) => {
    if (isGeneratingPlan) return;
    setIsGeneratingPlan(true);

    setMessages(prev => [...prev, { 
      role: 'assistant', 
      content: `Je finalise votre programme de 30 jours...`, 
      timestamp: new Date() 
    }]);

    try {
      const plan = await generateMealPlan(concept, user);
      setMealPlan(plan);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "✅ Votre programme est validé ! Retrouvez-le dans l'onglet Agenda et Cuisine.", 
        timestamp: new Date() 
      }]);
    } catch (e) {
      console.error(e);
      // FALLBACK : Au lieu de dire "Erreur", on demande à l'IA de l'écrire en texte
      try {
        const textResponse = await chatWithAI("La génération du calendrier visuel a échoué. Peux-tu m'écrire le plan détaillé (repas par repas) sous forme de liste texte simple à la place ? Sois exhaustif.", user, messages, dailyContext);
        setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: "Le calendrier interactif n'a pas pu être chargé, mais voici votre plan détaillé par écrit :\n\n" + textResponse.reply, 
            timestamp: new Date() 
        }]);
      } catch (err) {
         setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: "Oups, je n'arrive vraiment pas à générer ce plan. Essayons avec une demande plus simple ?", 
            timestamp: new Date() 
        }]);
      }
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
             <div>
                <span className="font-bold text-slate-700 block leading-none">Crystal AI</span>
                {/* Visual Indicator of Cloud Sync */}
                <div className="flex items-center gap-1 mt-0.5">
                   {cloudStatus === 'syncing' && <span className="block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>}
                   {cloudStatus === 'synced' && <span className="block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
                   {cloudStatus === 'error' && <span className="block w-1.5 h-1.5 rounded-full bg-amber-500"></span>}
                   <span className={`text-[8px] font-bold uppercase tracking-widest ${
                     cloudStatus === 'error' ? 'text-amber-500' : cloudStatus === 'syncing' ? 'text-blue-400' : 'text-emerald-500'
                   }`}>
                      {cloudStatus === 'syncing' ? 'Sauvegarde...' : cloudStatus === 'error' ? 'Mémoire Locale' : 'Sauvegardé'}
                   </span>
                </div>
             </div>
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
                <p className="text-xs font-medium text-emerald-600">🍽️ {dailyContext.caloriesEaten} kcal</p>
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
                 <p className="text-[10px] text-slate-500 truncate">Vision IA Active</p>
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
        
        {/* HEADER MOBILE */}
        <div className="lg:hidden h-14 border-b border-slate-100 flex items-center px-4 justify-between shrink-0 bg-white z-10">
           <div className="flex items-center gap-3">
             <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-600">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
             </button>
             <div>
               <span className="font-bold text-slate-800 block leading-none">Crystal AI</span>
               <span className={`text-[9px] font-bold uppercase tracking-wider ${
                  cloudStatus === 'error' ? 'text-amber-500' : cloudStatus === 'syncing' ? 'text-blue-400' : 'text-emerald-500'
               }`}>
                 {cloudStatus === 'syncing' ? 'Sync...' : cloudStatus === 'error' ? 'Local' : 'Sauvegardé'}
               </span>
             </div>
           </div>
           <div className="w-8"></div>
        </div>

        {/* MESSAGES LIST */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 space-y-6 custom-scrollbar scroll-smooth">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center animate-in fade-in duration-700">
               <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-4xl mb-6 shadow-sm">📷</div>
               <h2 className="text-2xl font-black text-slate-800 mb-2">Vision & Nutrition</h2>
               <p className="text-slate-400 max-w-xs mx-auto mb-8">Envoyez-moi une photo de votre plat, je calcule les calories pour vous.</p>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md w-full">
                  <button onClick={() => fileInputRef.current?.click()} className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-left hover:bg-slate-100 transition-colors">
                     <span className="text-lg block mb-1">📸</span>
                     <span className="text-xs font-bold text-slate-700">Scanner un repas</span>
                  </button>
                  <button onClick={() => setInput("J'ai couru 30 minutes")} className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-left hover:bg-slate-100 transition-colors">
                     <span className="text-lg block mb-1">🏃‍♂️</span>
                     <span className="text-xs font-bold text-slate-700">Enregistrer un sport</span>
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

                <div className={`max-w-[95%] sm:max-w-[85%] lg:max-w-[70%] space-y-2`}>
                   <div className={`
                     px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed shadow-sm whitespace-pre-wrap
                     ${msg.role === 'user' 
                       ? 'bg-slate-800 text-white rounded-tr-none' 
                       : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'}
                   `}>
                     {msg.image && (
                        <div className="mb-3 rounded-lg overflow-hidden max-w-[200px] border border-white/20">
                          <img src={msg.image} alt="User upload" className="w-full h-auto object-cover" />
                        </div>
                     )}
                     {msg.content}
                   </div>
                   
                   {msg.concept && (
                     <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mt-2 animate-in slide-in-from-left-4">
                        <div className="flex justify-between items-start mb-3">
                           <div>
                              <h4 className="font-black text-emerald-800 text-sm">{msg.concept.title}</h4>
                              <p className="text-emerald-600 text-[10px] font-bold uppercase tracking-widest mt-1">Proposition Semainier</p>
                           </div>
                        </div>
                        
                        <p className="text-emerald-700 text-xs mb-4">{msg.concept.description}</p>
                        
                        {/* Weekly Preview Grid */}
                        {msg.concept.weeklyPreview && (
                           <div className="grid gap-3 mb-4">
                              {msg.concept.weeklyPreview.map((day, idx) => (
                                 <div key={idx} className="bg-white/70 rounded-xl p-3 border border-emerald-100/50 flex flex-col gap-2">
                                    <div className="w-full border-b border-emerald-100/50 pb-1 mb-1">
                                       <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-100 px-2 py-1 rounded-md">Jour {day.day}</span>
                                    </div>
                                    <div className="grid gap-2 text-xs">
                                       {day.breakfast && (
                                         <div className="flex items-start gap-2">
                                            <span className="text-amber-400 text-sm mt-0.5">🥐</span>
                                            <div>
                                              <span className="text-[9px] font-bold text-slate-400 uppercase block">Matin {day.breakfastWeight && `(${day.breakfastWeight})`}</span>
                                              <span className="text-slate-800 font-medium whitespace-normal break-words leading-tight">{day.breakfast}</span>
                                            </div>
                                         </div>
                                       )}
                                       <div className="flex items-start gap-2">
                                          <span className="text-amber-500 text-sm mt-0.5">☀️</span>
                                          <div>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase block">Midi {day.lunchWeight && `(${day.lunchWeight})`}</span>
                                            <span className="text-slate-800 font-medium whitespace-normal break-words leading-tight">{day.lunch}</span>
                                          </div>
                                       </div>
                                       <div className="flex items-start gap-2">
                                          <span className="text-indigo-500 text-sm mt-0.5">🌙</span>
                                          <div>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase block">Soir {day.dinnerWeight && `(${day.dinnerWeight})`}</span>
                                            <span className="text-slate-800 font-medium whitespace-normal break-words leading-tight">{day.dinner}</span>
                                          </div>
                                       </div>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        )}
                        
                        <div className="flex flex-col gap-2 mt-2">
                           <p className="text-[10px] text-emerald-600 text-center italic mb-1">Si ça vous convient, je duplique ce plan sur tout le mois.</p>
                           <button 
                             onClick={() => handleGeneratePlan(msg.concept)}
                             disabled={isGeneratingPlan}
                             className={`w-full py-3 rounded-lg text-xs font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${
                               isGeneratingPlan 
                               ? 'bg-emerald-100 text-emerald-400 cursor-wait' 
                               : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg hover:shadow-xl active:scale-95'
                             }`}
                           >
                              {isGeneratingPlan ? 'Création en cours...' : '✅ Valider & Générer le Mois'}
                           </button>
                        </div>
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
             {/* Image Preview */}
             {selectedImage && (
               <div className="absolute bottom-full left-0 mb-4 ml-2 animate-in slide-in-from-bottom-2 fade-in">
                 <div className="relative group">
                   <img src={selectedImage} alt="Preview" className="h-20 w-20 object-cover rounded-xl shadow-lg border-2 border-white" />
                   <button 
                     onClick={() => setSelectedImage(null)}
                     className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 shadow-md hover:bg-rose-600 transition-colors"
                   >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                   </button>
                 </div>
               </div>
             )}

             <form onSubmit={handleTextSubmit} className="relative flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-3xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleImageSelect}
                />
                
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 text-slate-400 hover:text-emerald-600 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>

                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={selectedImage ? "Ajouter une description..." : "Posez une question ou envoyez une photo..."}
                  className="w-full bg-transparent border-none outline-none text-sm text-slate-800 placeholder:text-slate-400 px-2 py-3 max-h-32"
                  autoComplete="off"
                />
                <button 
                  type="submit" 
                  disabled={(!input.trim() && !selectedImage) || isLoading || isGeneratingPlan}
                  className={`
                    p-3 rounded-2xl flex items-center justify-center transition-all duration-200
                    ${(input.trim() || selectedImage) && !isLoading && !isGeneratingPlan
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
