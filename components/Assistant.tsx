
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { generateMealPlan, chatWithAI } from '../services/gemini';
import { MealPlan, User } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  concept?: {
    title: string;
    description: string;
    exampleMeals: string[];
  };
  isAudio?: boolean;
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
  const [isLive, setIsLive] = useState(false);
  const [lastExtractedContext, setLastExtractedContext] = useState<any>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const liveSessionRef = useRef<any>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages, isLoading]);

  const handleFinalGeneration = async () => {
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'assistant', content: "Parfait ! Je lance la génération de votre plan de 30 jours ultra-personnalisé. Cela peut prendre quelques secondes car je calcule tous les grammages..." }]);
    
    try {
      const fullPlan = await generateMealPlan(lastExtractedContext, user);
      setMealPlan(fullPlan);
      setMessages(prev => [...prev, { role: 'assistant', content: "C'est prêt ! Votre plan de 30 jours a été injecté dans votre Agenda et votre Dashboard. Vous pouvez retrouver les détails dans l'onglet Cuisine." }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Désolé, la génération a échoué. Réessayons." }]);
    } finally {
      setIsLoading(false);
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
      const res = await chatWithAI(userMsg, user, messages);
      
      // Stockage du contexte pour la génération finale
      if (res.extractedInfo) {
        const newContext = { ...lastExtractedContext, ...res.extractedInfo };
        setLastExtractedContext(newContext);
        
        // Mise à jour temps réel du profil si possible
        const updatedUser = { ...user };
        if (res.extractedInfo.weight) updatedUser.weightHistory = [...(user.weightHistory || []), { date: new Date().toISOString(), weight: res.extractedInfo.weight }];
        if (res.extractedInfo.height) updatedUser.height = res.extractedInfo.height;
        if (res.extractedInfo.age) updatedUser.age = res.extractedInfo.age;
        if (res.extractedInfo.gender) updatedUser.gender = res.extractedInfo.gender;
        if (res.extractedInfo.exclusions) updatedUser.exclusions = res.extractedInfo.exclusions;
        onUpdateUser(updatedUser);
      }

      const assistantMsg: Message = { 
        role: 'assistant', 
        content: res.reply,
        concept: res.suggestedConcept 
      };
      
      setMessages(prev => [...prev, assistantMsg]);

    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Erreur de connexion avec Crystal AI." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white/70 backdrop-blur-3xl rounded-[2rem] sm:rounded-[3rem] shadow-premium border border-white/80 overflow-hidden relative h-full">
      <div className="bg-white/40 border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white text-xl shadow-lg">🤖</div>
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Coach Crystal AI</h2>
            <p className="text-[10px] text-emerald-500 font-bold uppercase">Protocole Premium Actif</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 no-scrollbar">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-20">
            <div className="text-5xl mb-4">✨</div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] max-w-xs">Bienvenue. Commençons par établir votre profil physique et vos préférences pour votre plan de 30 jours.</p>
          </div>
        )}
        
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[85%] px-5 py-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-emerald-600 text-white rounded-br-none shadow-lg shadow-emerald-100' : 'bg-white border border-slate-100 text-slate-700 rounded-bl-none shadow-sm'}`}>
              {msg.content}
            </div>
            
            {msg.concept && (
              <div className="mt-4 w-full max-w-md bg-white p-6 rounded-[2rem] border-2 border-emerald-100 shadow-xl animate-in zoom-in-95">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center text-lg">📋</div>
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">{msg.concept.title}</h4>
                </div>
                <p className="text-xs text-slate-500 mb-4 font-medium leading-relaxed">{msg.concept.description}</p>
                <div className="bg-slate-50 p-4 rounded-xl mb-6">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Aperçu des plats :</p>
                  <ul className="space-y-1">
                    {msg.concept.exampleMeals.map((meal, idx) => (
                      <li key={idx} className="text-[11px] font-bold text-slate-600 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span> {meal}
                      </li>
                    ))}
                  </ul>
                </div>
                <button 
                  onClick={handleFinalGeneration}
                  disabled={isLoading}
                  className="w-full py-4 bg-slate-900 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {isLoading ? "Génération..." : "Valider & Générer"}
                </button>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-slate-300">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></div>
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Input area avec padding additionnel pour mobile (barre flottante) */}
      <div className="p-4 sm:p-6 pb-12 sm:pb-8 bg-white/40 border-t border-slate-50 shrink-0 lg:pb-6">
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-4xl mx-auto">
          <input 
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="Répondez au coach ici..."
            className="flex-1 px-6 py-4 bg-white rounded-2xl border-2 border-slate-100 focus:border-emerald-500/40 outline-none text-sm transition-all shadow-sm min-w-0"
          />
          <button type="submit" disabled={isLoading || !input.trim()} className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center hover:bg-emerald-600 disabled:opacity-20 transition-all shadow-lg shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 12h14M12 5l7 7-7 7" /></svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default Assistant;
