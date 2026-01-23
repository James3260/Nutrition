
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

  // Auto-scroll à chaque nouveau message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(() => { scrollToBottom(); }, [messages, isLoading]);

  const handleFinalGeneration = async () => {
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'assistant', content: "Parfait ! Je lance la génération de votre plan de 30 jours ultra-personnalisé. Cela peut prendre quelques secondes..." }]);
    
    try {
      const fullPlan = await generateMealPlan(lastExtractedContext, user);
      setMealPlan(fullPlan);
      setMessages(prev => [...prev, { role: 'assistant', content: "C'est prêt ! Votre plan de 30 jours a été injecté dans votre Agenda." }]);
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
    <div className="flex flex-col h-full bg-[#e5ddd5] sm:bg-[#f0f2f5] relative">
      {/* 
        1. HEADER CONTACT 
        Style "WhatsApp" / iMessage propre 
      */}
      <div className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0 shadow-sm z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white text-lg shadow-md">
              🤖
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 leading-tight">Coach Crystal</h2>
            <p className="text-xs text-emerald-600 font-medium">En ligne • Assistant Premium</p>
          </div>
        </div>
      </div>

      {/* 
        2. ZONE DE MESSAGES (SCROLLABLE)
        Utilisation de flex-1 pour prendre tout l'espace restant + overflow-y-auto
      */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 opacity-60">
            <span className="text-4xl mb-2">👋</span>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest bg-white/50 px-4 py-2 rounded-full">
              Démarrer la conversation
            </p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          return (
            <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
              <div 
                className={`max-w-[85%] sm:max-w-[70%] px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed shadow-sm relative ${
                  isUser 
                    ? 'bg-emerald-600 text-white rounded-tr-none' 
                    : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'
                }`}
              >
                {msg.content}
                
                {/* Petit triangle pour la bulle (optionnel mais ajoute au style SMS) */}
                <div className={`absolute top-0 w-3 h-3 ${isUser ? '-right-1.5 bg-emerald-600' : '-left-1.5 bg-white border-l border-t border-slate-100'} rotate-45 transform skew-x-12`}></div>
              </div>
            </div>
          );
        })}

        {/* Concepts speciaux (Cartes interactives dans le chat) */}
        {messages.map((msg, i) => msg.concept && (
          <div key={`concept-${i}`} className="flex justify-start animate-in zoom-in-95 duration-500 mb-4">
            <div className="bg-white p-4 rounded-2xl shadow-md max-w-[90%] sm:max-w-sm border border-emerald-100 ml-2">
              <div className="flex items-center gap-2 mb-2">
                 <span className="text-lg">📋</span>
                 <h4 className="font-bold text-slate-800 text-sm">{msg.concept.title}</h4>
              </div>
              <p className="text-xs text-slate-600 mb-3">{msg.concept.description}</p>
              <div className="bg-slate-50 p-3 rounded-xl mb-3 space-y-1">
                 {msg.concept.exampleMeals.slice(0,3).map((m, idx) => (
                   <div key={idx} className="flex items-center gap-2 text-xs font-medium text-slate-700">
                     <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span> {m}
                   </div>
                 ))}
              </div>
              <button 
                onClick={handleFinalGeneration}
                disabled={isLoading}
                className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-600 transition-colors"
              >
                {isLoading ? 'Calcul en cours...' : 'Valider ce plan'}
              </button>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
             <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex gap-1 items-center border border-slate-100">
               <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
               <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.15s]"></div>
               <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.3s]"></div>
             </div>
          </div>
        )}
        
        {/* Espace vide pour s'assurer que le dernier message passe au-dessus de la barre de saisie et du menu flottant mobile */}
        <div ref={messagesEndRef} className="h-24 sm:h-20" /> 
      </div>

      {/* 
        3. BARRE DE SAISIE
        Fixe en bas du conteneur flex, au-dessus de la barre de navigation mobile 
      */}
      <div className="bg-white border-t border-slate-200 px-3 py-3 sm:px-4 sm:py-4 shrink-0 pb-[calc(env(safe-area-inset-bottom)+5rem)] lg:pb-4">
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-4xl mx-auto items-end">
          <div className="flex-1 bg-slate-100 rounded-[1.5rem] px-4 py-1 flex items-center border border-transparent focus-within:border-emerald-500/50 focus-within:bg-white transition-all">
            <input 
              type="text" 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              placeholder="Message..."
              className="w-full bg-transparent border-none outline-none text-[15px] py-2.5 text-slate-800 placeholder:text-slate-400"
            />
          </div>
          <button 
            type="submit" 
            disabled={!input.trim() || isLoading}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-sm shrink-0 ${
              input.trim() ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:scale-105' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
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
