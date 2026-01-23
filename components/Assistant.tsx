
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
  audioBase64?: string; // Pour stocker la réponse audio TTS
  isAudioMessage?: boolean; // Pour indiquer si l'utilisateur a envoyé un audio
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

  // --- AUDIO PLAYER UTILS ---
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
    } catch (e) {
      console.error("Erreur lecture audio", e);
    }
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  };

  useEffect(() => {
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [messages, isLoading, isRecording]);

  // --- RECORDING HANDLERS ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (e) {
      console.error("Accès micro refusé", e);
      alert("Impossible d'accéder au micro. Vérifiez vos permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' }); // Gemini est tolérant sur le mimeType
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          await handleAudioSubmit(base64Audio);
        };
        // Arrêt des pistes
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleAudioSubmit = async (base64Audio: string) => {
    setIsLoading(true);
    // On ajoute un message visuel "Message Audio"
    setMessages(prev => [...prev, { role: 'user', content: "🎤 Message Vocal", isAudioMessage: true }]);

    try {
      // 1. Envoi à l'IA (Audio -> Texte + Réponse)
      const res = await chatWithAI({ audioData: base64Audio, mimeType: 'audio/mp3' }, user, messages);
      
      // Mise à jour contexte utilisateur si nécessaire
      if (res.extractedInfo) {
        const newContext = { ...lastExtractedContext, ...res.extractedInfo };
        setLastExtractedContext(newContext);
        // (Mise à jour user code existant...)
      }

      // 2. Génération du TTS pour la réponse
      let audioResponse = null;
      if (res.reply) {
        audioResponse = await generateSpeech(res.reply);
      }

      const assistantMsg: Message = { 
        role: 'assistant', 
        content: res.reply || "Je vous écoute.",
        concept: res.suggestedConcept,
        audioBase64: audioResponse || undefined
      };
      
      setMessages(prev => [...prev, assistantMsg]);
      
      // Auto-play si audio dispo
      if (audioResponse) playAudio(audioResponse);

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: "Désolé, je n'ai pas pu traiter votre audio." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const res = await chatWithAI(userMsg, user, messages);
      // ... logique contexte ... (identique à avant)
      
      // On génère aussi l'audio pour les réponses textuelles pour garder la cohérence ? 
      // Optionnel, mais cool. Faisons-le pour les réponses courtes.
      let audioResponse = null;
      if (res.reply && res.reply.length < 200) { 
         audioResponse = await generateSpeech(res.reply);
      }

      const assistantMsg: Message = { 
        role: 'assistant', 
        content: res.reply || "...",
        concept: res.suggestedConcept,
        audioBase64: audioResponse || undefined
      };
      
      setMessages(prev => [...prev, assistantMsg]);
      if (audioResponse) playAudio(audioResponse);

    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Erreur de connexion." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalGeneration = async () => {
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'assistant', content: "Je lance la génération de votre plan..." }]);
    try {
      const fullPlan = await generateMealPlan(lastExtractedContext, user);
      setMealPlan(fullPlan);
      setMessages(prev => [...prev, { role: 'assistant', content: "C'est prêt ! Votre plan est dans l'Agenda." }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Erreur de génération." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f2f4f7] relative">
      {/* HEADER */}
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
            <p className="text-[10px] sm:text-xs text-emerald-600 font-medium">Assistant Vocal • En ligne</p>
          </div>
        </div>
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth overscroll-contain bg-[#f2f4f7]">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[60%] opacity-50 text-center px-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mb-4">🎙️</div>
            <p className="text-sm font-bold text-slate-500">Parlez ou écrivez</p>
            <p className="text-xs text-slate-400 mt-1">Maintenez le micro pour discuter de vive voix.</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
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
                {msg.isAudioMessage ? (
                   <div className="flex items-center gap-2">
                     <span className="animate-pulse">🎤</span> Message Audio
                   </div>
                ) : msg.content}

                {/* Bouton lecture audio pour les réponses assistant */}
                {!isUser && msg.audioBase64 && (
                  <button 
                    onClick={() => playAudio(msg.audioBase64!)}
                    className="mt-2 flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-bold transition-colors w-full sm:w-auto"
                  >
                    <span>🔊</span> Écouter
                  </button>
                )}
              </div>
              <span className="text-[9px] text-slate-400 mt-1 px-1 font-medium">{isUser ? 'Vous' : 'Crystal'}</span>
            </div>
          );
        })}

        {/* Suggestion / Concept Card (Code inchangé pour l'affichage des plans) */}
        {messages.map((msg, i) => msg.concept && (
          <div key={`concept-${i}`} className="flex justify-start mb-4 w-full">
            <div className="bg-white rounded-2xl p-4 shadow-lg border border-emerald-100 max-w-sm w-full">
              <h5 className="font-black text-emerald-700 text-sm mb-1">{msg.concept.title}</h5>
              <p className="text-xs text-slate-600 mb-4">{msg.concept.description}</p>
              <button onClick={handleFinalGeneration} disabled={isLoading} className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase">Valider le Plan</button>
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
        <div ref={messagesEndRef} className="h-4" /> 
      </div>

      {/* ZONE DE SAISIE */}
      <div className="bg-white border-t border-slate-200 px-4 py-3 shrink-0 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-4 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] z-30">
        
        {isRecording ? (
          /* UI D'ENREGISTREMENT */
          <div className="flex items-center justify-between w-full max-w-4xl mx-auto bg-rose-50 rounded-[1.5rem] px-2 py-1 border border-rose-100 animate-pulse">
            <div className="flex items-center gap-3 px-4 py-2">
              <div className="w-3 h-3 bg-rose-500 rounded-full animate-ping"></div>
              <span className="text-rose-600 font-black text-xs uppercase tracking-widest">Enregistrement...</span>
            </div>
            <button 
              onClick={stopRecording} // Click to stop
              className="w-11 h-11 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg transform active:scale-90 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            </button>
          </div>
        ) : (
          /* UI TEXTE STANDARD */
          <form onSubmit={handleTextSubmit} className="flex gap-2 max-w-4xl mx-auto items-end">
            <div className="flex-1 bg-slate-100 rounded-[1.5rem] px-5 py-1 flex items-center border-2 border-transparent focus-within:border-emerald-500/30 focus-within:bg-white transition-all">
              <input 
                type="text" 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                placeholder="Message..."
                className="w-full bg-transparent border-none outline-none text-[15px] py-3 text-slate-800 placeholder:text-slate-400 font-medium"
              />
            </div>
            
            {/* Si texte vide, afficher micro, sinon envoyer */}
            {input.trim() ? (
              <button 
                type="submit" 
                disabled={isLoading}
                className="w-12 h-12 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 hover:scale-105 flex items-center justify-center transition-all shadow-md shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-0.5">
                  <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                </svg>
              </button>
            ) : (
              <button 
                type="button"
                onClick={startRecording} // Click to start
                disabled={isLoading}
                className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-600 flex items-center justify-center transition-all shadow-sm shrink-0 active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                  <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
                </svg>
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export default Assistant;
