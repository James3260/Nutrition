
import React, { useState, useRef, useEffect } from 'react';
import { generateMealPlan, chatWithAI, generateSpeech } from '../services/gemini';
import { MealPlan, User } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  concept?: {
    title: string;
    description: string;
    exampleMeals: string[];
  };
  audioBase64?: string;
  isAudioMessage?: boolean;
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
  const [isRecording, setIsRecording] = useState(false);
  const [lastExtractedContext, setLastExtractedContext] = useState<any>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const playAudio = async (base64Data: string) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
      const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start(0);
    } catch (e) { console.error("Erreur lecture audio:", e); }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => { 
        if (e.data.size > 0) audioChunksRef.current.push(e.data); 
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (e) { 
      alert("Accès micro refusé. Vérifiez vos permissions."); 
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          await processInput({ audioData: base64Audio, mimeType: 'audio/mp3' }, true);
        };
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const txt = input;
    setInput('');
    processInput(txt, false);
  };

  const processInput = async (inputData: string | { audioData: string, mimeType: string }, isAudio: boolean) => {
    setIsLoading(true);
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: isAudio ? "🎤 Message Vocal" : (inputData as string),
      isAudioMessage: isAudio 
    }]);

    try {
      const res = await chatWithAI(inputData, user, messages);

      if (res.extractedInfo && Object.keys(res.extractedInfo).length > 0) {
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

      let audioResponse = null;
      if (res.reply && (isAudio || res.reply.length < 200)) {
        audioResponse = await generateSpeech(res.reply);
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.reply || "J'ai bien pris en compte vos informations.",
        concept: res.suggestedConcept,
        audioBase64: audioResponse || undefined
      }]);

      if (audioResponse) playAudio(audioResponse);

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: "Désolé, une erreur est survenue." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalGeneration = async () => {
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'assistant', content: "Je génère votre plan de 30 jours, cela peut prendre une minute..." }]);
    try {
      const fullPlan = await generateMealPlan(lastExtractedContext, user);
      setMealPlan(fullPlan);
      setMessages(prev => [...prev, { role: 'assistant', content: "C'est fait ! Votre agenda est rempli avec succès." }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Erreur lors de la création du plan." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden font-sans">
      
      {/* Background Decor Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-100/40 rounded-full blur-[100px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/40 rounded-full blur-[100px] pointer-events-none z-0"></div>

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 px-6 py-4 flex items-center justify-between bg-white/70 backdrop-blur-xl border-b border-white/50">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-tr from-emerald-400 to-teal-400 rounded-full opacity-70 blur group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative w-10 h-10 bg-white rounded-full flex items-center justify-center text-lg shadow-sm">
              ✨
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 tracking-tight">Coach Crystal</h2>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">En ligne</p>
            </div>
          </div>
        </div>
        <button onClick={() => setMessages([])} className="p-2 text-slate-400 hover:text-slate-600 transition-colors" title="Effacer la conversation">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto pt-24 pb-32 px-4 sm:px-6 space-y-8 scroll-smooth z-10 custom-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center mt-20 opacity-0 animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-forwards">
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-[2rem] flex items-center justify-center text-4xl mb-6 shadow-inner border border-white">
              🎙️
            </div>
            <p className="text-lg font-black text-slate-700 tracking-tight mb-2">Comment puis-je vous aider ?</p>
            <p className="text-sm text-slate-400 text-center max-w-xs leading-relaxed">
              Je peux créer un plan nutritionnel, adapter des recettes ou simplement discuter de vos objectifs.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {["Perdre 3kg en 1 mois", "Régime végétarien simple", "Plus d'énergie le matin"].map((suggestion) => (
                <button 
                  key={suggestion}
                  onClick={() => { setInput(suggestion); }} 
                  className="px-4 py-2 bg-white border border-slate-100 rounded-full text-xs font-bold text-slate-600 shadow-sm hover:shadow-md hover:border-emerald-200 hover:text-emerald-600 transition-all active:scale-95"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          const isError = !isUser && msg.content.includes("Erreur");
          
          return (
            <div key={i} className={`group flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
              <div className={`
                relative px-6 py-4 max-w-[85%] sm:max-w-[75%] text-[15px] leading-7 shadow-sm transition-all
                ${isUser 
                  ? 'bg-gradient-to-br from-emerald-600 to-emerald-500 text-white rounded-[1.5rem] rounded-tr-sm shadow-emerald-200/50' 
                  : isError 
                    ? 'bg-rose-50 text-rose-600 border border-rose-100 rounded-[1.5rem]' 
                    : 'bg-white text-slate-700 border border-white/60 rounded-[1.5rem] rounded-tl-sm shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]'}
              `}>
                {msg.isAudioMessage ? (
                   <div className="flex items-center gap-3">
                     <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                      </span>
                     <span className="font-bold tracking-wide">Message Vocal</span>
                   </div>
                ) : (
                  msg.content
                )}

                {!isUser && msg.audioBase64 && (
                  <button 
                    onClick={() => playAudio(msg.audioBase64!)}
                    className="mt-3 flex items-center gap-2 bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-slate-100"
                  >
                    <span>🔊</span> Écouter
                  </button>
                )}
              </div>
              
              <span className={`text-[10px] text-slate-300 font-bold mt-2 px-2 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest`}>
                {isUser ? 'Vous' : 'Crystal'}
              </span>
            </div>
          );
        })}

        {messages.map((msg, i) => msg.concept && (
          <div key={`concept-${i}`} className="flex justify-start w-full pl-2 animate-in fade-in zoom-in-95 duration-500">
            <div className="bg-white/80 backdrop-blur-md rounded-[2rem] p-6 shadow-xl border border-white max-w-sm w-full relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
              <h5 className="font-black text-slate-800 text-lg mb-2">{msg.concept.title}</h5>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">{msg.concept.description}</p>
              
              <div className="space-y-2 mb-6">
                {msg.concept.exampleMeals.map((meal, idx) => (
                   <div key={idx} className="flex items-center gap-3 text-xs font-medium text-slate-600 bg-slate-50 p-2 rounded-lg">
                      <span className="text-emerald-500 text-base">•</span> {meal}
                   </div>
                ))}
              </div>

              <button 
                onClick={handleFinalGeneration} 
                disabled={isLoading} 
                className="w-full py-4 bg-slate-900 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
              >
                <span>🚀</span> Générer le Plan Complet
              </button>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start animate-in fade-in duration-300">
             <div className="bg-white/80 backdrop-blur px-5 py-4 rounded-[1.5rem] rounded-tl-sm shadow-sm flex gap-2 items-center border border-white">
               <div className="flex gap-1.5">
                 <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"></div>
                 <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.15s]"></div>
                 <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.3s]"></div>
               </div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-4" /> 
      </div>

      {/* Input Area */}
      <div className="absolute bottom-6 left-0 right-0 px-4 sm:px-6 z-30">
        <div className="max-w-4xl mx-auto">
          {isRecording ? (
            <div className="flex items-center justify-between w-full bg-rose-500/90 backdrop-blur-md text-white rounded-full px-2 py-2 shadow-2xl animate-in zoom-in duration-300 border border-rose-400/50">
              <div className="flex items-center gap-4 px-6">
                <div className="relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-200 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                </div>
                <span className="font-black text-xs uppercase tracking-[0.2em]">Enregistrement en cours...</span>
              </div>
              <button 
                onClick={stopRecording} 
                className="w-12 h-12 bg-white text-rose-600 rounded-full flex items-center justify-center shadow-lg transform hover:scale-105 active:scale-90 transition-all"
              >
                 <span className="w-4 h-4 bg-rose-600 rounded-sm"></span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleTextSubmit} className="relative flex gap-2 items-center bg-white/80 backdrop-blur-xl p-2 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-white/50">
              <input 
                type="text" 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                placeholder="Discutez avec Crystal..." 
                className="flex-1 bg-transparent border-none outline-none text-[15px] px-6 py-3 text-slate-700 placeholder:text-slate-400 font-medium" 
              />
              
              {input.trim() ? (
                <button 
                  type="submit" 
                  disabled={isLoading} 
                  className="w-11 h-11 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center shadow-md shrink-0 transition-all transform hover:scale-105 active:scale-95"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-0.5"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
                </button>
              ) : (
                <button 
                  type="button" 
                  onClick={startRecording} 
                  disabled={isLoading} 
                  className="w-11 h-11 rounded-full bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 flex items-center justify-center shrink-0 transition-all active:scale-90 group"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 group-hover:scale-110 transition-transform"><path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" /><path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" /></svg>
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Assistant;
