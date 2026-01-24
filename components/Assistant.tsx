
import React, { useState, useRef, useEffect } from 'react';
import { chatWithAI, tools } from '../services/gemini';
import { MealPlan, User } from '../types';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  concept?: {
    title: string;
    description: string;
    exampleMeals: string[];
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile sidebar toggle
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Live API (Simplifié pour focus Chat) ---
  const [isLiveMode, setIsLiveMode] = useState(false);
  // (Le code Live API complet est masqué ici pour alléger, mais l'appel reste possible si vous le souhaitez, 
  // on se concentre sur l'UX Chat demandée)

  // Scroll automatique vers le bas lors de nouveaux messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input;
    setInput('');
    setIsLoading(true);

    // 1. Ajouter message user
    const newUserMsg: Message = { role: 'user', content: userMsg, timestamp: new Date() };
    setMessages(prev => [...prev, newUserMsg]);

    try {
      // 2. Appel AI
      const response = await chatWithAI(userMsg, user, messages);

      // 3. Mise à jour profil si détecté
      if (response.extractedInfo && Object.keys(response.extractedInfo).length > 0) {
        const updatedUser = { ...user, ...response.extractedInfo };
        // Gestion poids historique
        if (response.extractedInfo.weight) {
           updatedUser.weightHistory = [
             ...(user.weightHistory || []), 
             { date: new Date().toISOString(), weight: response.extractedInfo.weight }
           ];
        }
        onUpdateUser(updatedUser);
      }

      // 4. Ajouter réponse AI
      const newAiMsg: Message = { 
        role: 'assistant', 
        content: response.reply, 
        concept: response.suggestedConcept,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, newAiMsg]);

    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Désolé, une erreur est survenue. Veuillez réessayer.", timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = () => {
    if(confirm("Effacer tout l'historique de conversation ?")) {
      setMessages([]);
    }
  };

  // --- RENDER ---
  return (
    <div className="flex h-full bg-white overflow-hidden relative font-sans">
      
      {/* SIDEBAR (Desktop: Toujours visible, Mobile: Drawer) */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-slate-50 border-r border-slate-200 transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:w-72 flex flex-col
      `}>
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white text-lg">✨</div>
             <span className="font-bold text-slate-700">Crystal AI</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Profil Détecté</p>
             <div className="space-y-1">
                <p className="text-xs font-medium text-slate-700">👤 {user.name}</p>
                <p className="text-xs font-medium text-slate-700">⚖️ {user.weightHistory?.slice(-1)[0]?.weight || '--'} kg</p>
                <p className="text-xs font-medium text-slate-700">📏 {user.height || '--'} cm</p>
             </div>
          </div>

          <button 
            onClick={clearHistory}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
          >
            <span className="text-lg">🗑️</span> Nouvelle conversation
          </button>
        </div>

        <div className="p-4 border-t border-slate-100">
           <div className="flex items-center gap-3 px-3 py-2 bg-slate-100 rounded-xl">
              <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center text-slate-600 font-bold">
                 {user.name[0]}
              </div>
              <div className="min-w-0">
                 <p className="text-xs font-bold text-slate-800 truncate">{user.name}</p>
                 <p className="text-[10px] text-slate-500 truncate">Utilisateur Premium</p>
              </div>
           </div>
        </div>
      </div>

      {/* OVERLAY MOBILE pour Sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col min-w-0 bg-white relative">
        
        {/* HEADER MOBILE */}
        <div className="lg:hidden h-14 border-b border-slate-100 flex items-center px-4 justify-between shrink-0">
           <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-600">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
           </button>
           <span className="font-bold text-slate-800">Crystal AI</span>
           <div className="w-8"></div>
        </div>

        {/* MESSAGES LIST */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-0 animate-in fade-in duration-700">
               <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-4xl mb-6 shadow-sm">🤖</div>
               <h2 className="text-2xl font-black text-slate-800 mb-2">Comment puis-je vous aider ?</h2>
               <p className="text-slate-400 max-w-xs mx-auto">Je peux analyser vos repas, calculer vos calories ou créer un programme complet.</p>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 max-w-md w-full">
                  <button onClick={() => setInput("Analyse mon poids actuel")} className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-left hover:bg-slate-100 transition-colors">
                     <span className="text-lg block mb-1">⚖️</span>
                     <span className="text-xs font-bold text-slate-700">Mon suivi poids</span>
                  </button>
                  <button onClick={() => setInput("Suggère un dîner léger")} className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-left hover:bg-slate-100 transition-colors">
                     <span className="text-lg block mb-1">🥗</span>
                     <span className="text-xs font-bold text-slate-700">Idée repas léger</span>
                  </button>
               </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                
                {/* Avatar AI */}
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs shrink-0 mt-1 shadow-sm">
                    ✨
                  </div>
                )}

                {/* Bulle Message */}
                <div className={`max-w-[85%] sm:max-w-[75%] space-y-2`}>
                   <div className={`
                     px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed shadow-sm
                     ${msg.role === 'user' 
                       ? 'bg-slate-800 text-white rounded-tr-none' 
                       : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'}
                   `}>
                     {/* Markdown simulation basic */}
                     {msg.content.split('\n').map((line, idx) => (
                       <p key={idx} className={`min-h-[1rem] ${line.startsWith('-') ? 'pl-4' : ''}`}>
                         {line}
                       </p>
                     ))}
                   </div>
                   
                   {/* Affichage d'un concept de plan si proposé */}
                   {msg.concept && (
                     <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mt-2 animate-in slide-in-from-left-4">
                        <h4 className="font-black text-emerald-800 text-sm mb-1">{msg.concept.title}</h4>
                        <p className="text-emerald-700 text-xs mb-3">{msg.concept.description}</p>
                        <div className="space-y-1 mb-3">
                           {msg.concept.exampleMeals.map((meal, idx) => (
                             <div key={idx} className="flex items-center gap-2 text-xs text-emerald-600">
                                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                                {meal}
                             </div>
                           ))}
                        </div>
                        <button className="w-full py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-emerald-700 transition-colors">
                           Générer ce programme
                        </button>
                     </div>
                   )}
                   
                   {/* Timestamp discret */}
                   <p className={`text-[10px] text-slate-300 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                      {msg.timestamp ? msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                   </p>
                </div>

                {/* Avatar User */}
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-xs shrink-0 mt-1">
                    {user.name[0]}
                  </div>
                )}
              </div>
            ))
          )}
          
          {/* Indicateur de chargement */}
          {isLoading && (
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
        <div className="p-4 border-t border-slate-100 bg-white">
          <div className="max-w-3xl mx-auto relative">
             <form onSubmit={handleTextSubmit} className="relative flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-3xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Posez une question à Crystal..."
                  className="w-full bg-transparent border-none outline-none text-sm text-slate-800 placeholder:text-slate-400 px-4 py-3 max-h-32"
                  autoComplete="off"
                />
                <button 
                  type="submit" 
                  disabled={!input.trim() || isLoading}
                  className={`
                    p-3 rounded-2xl flex items-center justify-center transition-all duration-200
                    ${input.trim() && !isLoading 
                      ? 'bg-emerald-600 text-white shadow-md hover:bg-emerald-500 transform hover:scale-105' 
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
                  `}
                >
                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                   </svg>
                </button>
             </form>
             <p className="text-center text-[10px] text-slate-300 mt-2">
                Crystal AI peut faire des erreurs. Vérifiez les informations médicales.
             </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Assistant;
