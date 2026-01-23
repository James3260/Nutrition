
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
  const [lastExtractedContext, setLastExtractedContext] = useState<any>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll robuste à chaque changement de messages
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  };

  useEffect(() => {
    // Petit délai pour laisser le temps au rendu de se faire
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [messages, isLoading]);

  const handleFinalGeneration = async () => {
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'assistant', content: "Parfait ! Je lance la génération de votre plan de 30 jours ultra-personnalisé. Cela peut prendre quelques secondes..." }]);
    
    try {
      const fullPlan = await generateMealPlan(lastExtractedContext, user);
      setMealPlan(fullPlan);
      setMessages(prev => [...prev, { role: 'assistant', content: "C'est prêt ! Votre plan de 30 jours a été injecté dans votre Agenda." }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Une erreur est survenue lors de la génération du plan. Veuillez réessayer." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const userMsg = input;
    setInput('');
    // Ajout optimiste du message utilisateur
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const res = await chatWithAI(userMsg, user, messages);
      
      if (res.extractedInfo) {
        const newContext = { ...lastExtractedContext, ...res.extractedInfo };
        setLastExtractedContext(newContext);
        
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
        content: res.reply || "Je n'ai pas compris, pouvez-vous répéter ?",
        concept: res.suggestedConcept 
      };
      
      setMessages(prev => [...prev, assistantMsg]);

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: "Oups, problème de connexion. Vérifiez votre réseau ou la clé API." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f2f4f7] relative">
      {/* 
        HEADER INTERNE ASSISTANT 
      */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-full flex items-center justify-center text-white text-base shadow-md">
              ✨
            </div>
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 leading-tight">Coach Crystal</h2>
            <p className="text-[10px] sm:text-xs text-emerald-600 font-medium">Assistant Nutrition • En ligne</p>
          </div>
        </div>
        <div className="text-[10px] px-2 py-1 bg-slate-100 text-slate-500 rounded-md font-bold uppercase tracking-wide">
          IA Premium
        </div>
      </div>

      {/* 
        ZONE DE MESSAGES 
      */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth overscroll-contain bg-[#f2f4f7]">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[60%] opacity-50">
            <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center text-3xl mb-4">💬</div>
            <p className="text-sm font-bold text-slate-500">Dites bonjour à votre coach !</p>
            <p className="text-xs text-slate-400 mt-1">Je peux créer votre plan de repas idéal.</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          // Détection simple des messages d'erreur système pour les styliser différemment
          const isError = !isUser && (msg.content.includes("⚠️") || msg.content.includes("Erreur"));
          
          return (
            <div key={i} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-300`}>
              <div 
                className={`max-w-[85%] sm:max-w-[75%] px-4 py-3 text-[15px] leading-relaxed shadow-sm relative ${
                  isUser 
                    ? 'bg-emerald-600 text-white rounded-[1.2rem] rounded-tr-sm' 
                    : isError 
                      ? 'bg-rose-50 text-rose-600 border border-rose-100 rounded-[1.2rem] rounded-tl-sm'
                      : 'bg-white text-slate-800 rounded-[1.2rem] rounded-tl-sm border border-slate-100'
                }`}
              >
                {msg.content}
              </div>
              
              <span className="text-[9px] text-slate-400 mt-1 px-1 font-medium">
                {isUser ? 'Vous' : 'Crystal'}
              </span>
            </div>
          );
        })}

        {/* Suggestion / Concept Card */}
        {messages.map((msg, i) => msg.concept && (
          <div key={`concept-${i}`} className="flex justify-start mb-4 animate-in fade-in zoom-in-95 duration-500 w-full">
            <div className="bg-white rounded-2xl p-4 shadow-lg border border-emerald-100 max-w-sm ml-0 sm:ml-2 w-full">
              <div className="flex items-center gap-2 mb-3 border-b border-slate-50 pb-2">
                 <span className="text-lg">📋</span>
                 <h4 className="font-bold text-slate-800 text-sm">Proposition de Plan</h4>
              </div>
              <h5 className="font-black text-emerald-700 text-sm mb-1">{msg.concept.title}</h5>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">{msg.concept.description}</p>
              
              <div className="space-y-2 mb-4">
                 {msg.concept.exampleMeals.slice(0,3).map((m, idx) => (
                   <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 p-2 rounded-lg">
                     <span className="text-emerald-500 mt-0.5">•</span> {m}
                   </div>
                 ))}
              </div>
              
              <button 
                onClick={handleFinalGeneration}
                disabled={isLoading}
                className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Génération...
                  </>
                ) : (
                  <><span>🚀</span> Valider & Générer</>
                )}
              </button>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
             <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex gap-1.5 items-center border border-slate-100">
               <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
               <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.15s]"></div>
               <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.3s]"></div>
             </div>
          </div>
        )}
        
        {/* Élément invisible pour scroller en bas */}
        <div ref={messagesEndRef} className="h-4" /> 
      </div>

      {/* 
        ZONE DE SAISIE 
      */}
      <div className="bg-white border-t border-slate-200 px-4 py-3 shrink-0 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-4 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] z-30">
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-4xl mx-auto items-end">
          <div className="flex-1 bg-slate-100 rounded-[1.5rem] px-5 py-1 flex items-center border-2 border-transparent focus-within:border-emerald-500/30 focus-within:bg-white transition-all">
            <input 
              type="text" 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              placeholder="Écrivez votre message..."
              className="w-full bg-transparent border-none outline-none text-[15px] py-3 text-slate-800 placeholder:text-slate-400 font-medium"
            />
          </div>
          <button 
            type="submit" 
            disabled={!input.trim() || isLoading}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md shrink-0 ${
              input.trim() 
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:scale-105' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-0.5">
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default Assistant;
