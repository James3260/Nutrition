
import React, { useState, useRef, useEffect } from 'react';
import { generateMealPlan, chatWithAI } from '../services/gemini';
import { MealPlan, User, WeightRecord } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  proposedPlan?: MealPlan;
  proposedShortList?: string[];
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
  const [pendingPlan, setPendingPlan] = useState<MealPlan | null>(null);
  const [shortList, setShortList] = useState<string[] | null>(null);
  // État pour la date de début choisie par l'utilisateur
  const [chosenStartDate, setChosenStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleFinalizePlan = () => {
    if (pendingPlan) {
      // On utilise la date choisie via l'input
      const finalizedPlan: MealPlan = {
        ...pendingPlan,
        startDate: new Date(chosenStartDate).toISOString()
      };
      setMealPlan(finalizedPlan);
      
      const formattedDate = new Date(chosenStartDate).toLocaleDateString('fr-FR', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long' 
      });

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `C'est validé ! ✅ Votre programme de 30 jours est programmé pour commencer le ${formattedDate}. Retrouvez tous vos repas dans l'onglet Calendrier.` 
      }]);
      setPendingPlan(null);
      setShortList(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      if ((userMsg.toLowerCase().includes('plan') || userMsg.toLowerCase().includes('repas')) && !shortList) {
        const plan = await generateMealPlan(userMsg, user);
        const sampleMeals = plan.recipes.slice(0, 7).map(r => r.name);
        setShortList(sampleMeals);
        setPendingPlan(plan);
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: "D'accord, je prépare votre mois ! Voici un aperçu de la première semaine. À partir de quand souhaitez-vous commencer ?",
          proposedShortList: sampleMeals
        }]);
      } else {
        const result = await chatWithAI(userMsg, user);
        
        if (result.extractedInfo) {
          const updates: any = {};
          if (result.extractedInfo.weight) {
            const newWeightRecord: WeightRecord = { date: new Date().toISOString(), weight: result.extractedInfo.weight };
            updates.weightHistory = [...(user.weightHistory || []), newWeightRecord];
          }
          if (result.extractedInfo.height) updates.height = result.extractedInfo.height;
          if (result.extractedInfo.age) updates.age = result.extractedInfo.age;
          if (result.extractedInfo.gender) updates.gender = result.extractedInfo.gender;
          if (Object.keys(updates).length > 0) onUpdateUser({ ...user, ...updates });
        }
        setMessages(prev => [...prev, { role: 'assistant', content: result.reply }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Désolé, j'ai rencontré une petite erreur de connexion. Pouvez-vous reformuler votre demande ?" }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-140px)] bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden relative">
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-emerald-100">🤖</div>
          <div>
            <h2 className="text-md font-black text-slate-800 leading-tight">Assistant NutriTrack</h2>
            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              En ligne
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-6 bg-slate-50/30 custom-scrollbar">
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start animate-in fade-in slide-in-from-bottom-4 duration-500'}`}>
            <div className={`max-w-[85%] md:max-w-[70%] px-6 py-4 rounded-[2rem] text-[15px] leading-relaxed shadow-sm transition-all hover:shadow-md ${msg.role === 'user' ? 'bg-slate-900 text-white rounded-br-none' : 'bg-white text-slate-700 rounded-bl-none border border-slate-200'}`}>
              {msg.content}
            </div>

            {msg.proposedShortList && (
              <div className="mt-4 w-full max-w-sm bg-white rounded-[3.5rem] border-2 border-emerald-100 p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="flex items-center gap-3 mb-4">
                   <div className="w-8 h-8 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 font-bold">1</div>
                   <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Semaine de démarrage</h4>
                </div>
                
                <ul className="space-y-2 mb-6">
                  {msg.proposedShortList.slice(0, 3).map((meal, idx) => (
                    <li key={idx} className="text-xs text-slate-600 font-bold p-2 bg-slate-50 rounded-xl border border-slate-100/50">
                      🥗 {meal}
                    </li>
                  ))}
                  <li className="text-[10px] text-slate-400 text-center font-bold italic">... +27 autres repas équilibrés</li>
                </ul>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date de début du plan</label>
                    <input 
                      type="date" 
                      value={chosenStartDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setChosenStartDate(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-100 border-2 border-transparent focus:border-emerald-500/20 rounded-xl text-slate-800 font-bold text-sm outline-none transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={handleFinalizePlan} 
                      className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-95"
                    >
                      Activer le programme ✅
                    </button>
                    <button 
                      onClick={() => { setShortList(null); setPendingPlan(null); setMessages(prev => [...prev, { role: 'user', content: "Peux-tu me proposer d'autres idées s'il te plaît ?" }]); }} 
                      className="w-full py-3 text-slate-400 rounded-2xl font-black text-[9px] uppercase hover:text-rose-500 transition-all"
                    >
                      Refaire la proposition
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start animate-in fade-in duration-300">
            <div className="bg-white px-6 py-4 rounded-[2rem] rounded-tl-none border border-slate-100 shadow-sm flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.1s]"></div>
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.2s]"></div>
              </div>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Réflexion...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-6 md:px-10 md:pb-8 bg-white border-t border-slate-100">
        <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto group">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Échangez avec votre coach..." className="w-full pl-8 pr-20 py-5 bg-slate-100 rounded-[2rem] border-2 border-transparent focus:border-emerald-500/20 focus:bg-white focus:ring-0 text-slate-800 placeholder:text-slate-400 font-medium transition-all text-md shadow-inner" />
          <button type="submit" disabled={isLoading || !input.trim()} className="absolute right-2 top-2 bottom-2 w-14 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center hover:bg-emerald-600 transition-all disabled:opacity-20 active:scale-90 shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default Assistant;
