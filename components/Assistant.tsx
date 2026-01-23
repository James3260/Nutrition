
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { chatWithAI, generateSpeech } from '../services/gemini';
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

// --- UTILITAIRES AUDIO (Encodage/Décodage PCM) ---

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function base64Encode(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64Decode(base64: string) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// --- COMPOSANT PRINCIPAL ---

const Assistant: React.FC<AssistantProps> = ({ setMealPlan, user, onUpdateUser, messages, setMessages }) => {
  // Modes
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  
  // Chat Textuel Standard
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- LOGIQUE LIVE API ---
  const [volumeLevel, setVolumeLevel] = useState(0); // Pour la visualisation
  const audioContextRef = useRef<AudioContext | null>(null);
  const liveSessionRef = useRef<any>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioQueueRef = useRef<AudioBufferSourceNode[]>([]);

  // Nettoyage à la fermeture
  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, []);

  const startLiveSession = async () => {
    if (!process.env.API_KEY) {
      alert("Clé API manquante");
      return;
    }

    setIsLiveMode(true);
    
    try {
      // 1. Initialiser l'audio
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 } });
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = audioCtx;
      nextStartTimeRef.current = audioCtx.currentTime;

      // 2. Connexion Gemini Live
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: `Tu es Crystal, une coach nutrition d'élite. Tu es empathique, énergique et très compétente.
          Tu discutes vocalement avec ${user.name}.
          Objectif: Aider l'utilisateur à atteindre ses objectifs de santé.
          Style: Conversation naturelle, fluide, comme au téléphone. Réponses courtes et percutantes.`,
        },
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Connected");
            setIsLiveConnected(true);

            // 3. Configuration du flux Audio Entrant (Micro -> Gemini)
            const source = audioCtx.createMediaStreamSource(stream);
            inputSourceRef.current = source;
            
            // ScriptProcessor pour capturer le PCM brut (4096 buffer size)
            const processor = audioCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              // Conversion Float32 -> Int16 PCM
              const pcmBuffer = new ArrayBuffer(inputData.length * 2);
              const dataView = new DataView(pcmBuffer);
              floatTo16BitPCM(dataView, 0, inputData);
              const base64Data = base64Encode(pcmBuffer);

              // Visualisation simple (volume)
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += Math.abs(inputData[i]);
              setVolumeLevel(Math.min(100, (sum / inputData.length) * 500));

              // Envoi
              sessionPromise.then(session => {
                session.sendRealtimeInput({
                  media: {
                    mimeType: 'audio/pcm;rate=16000',
                    data: base64Data
                  }
                });
              });
            };

            source.connect(processor);
            processor.connect(audioCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            // 4. Réception Audio (Gemini -> Haut-parleurs)
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && audioContextRef.current) {
              const ctx = audioContextRef.current;
              
              // Décodage manuel PCM 24kHz (Format de sortie Gemini Live)
              const rawBytes = base64Decode(audioData);
              const dataInt16 = new Int16Array(rawBytes.buffer);
              const float32Data = new Float32Array(dataInt16.length);
              
              for (let i = 0; i < dataInt16.length; i++) {
                float32Data[i] = dataInt16[i] / 32768.0;
              }

              const buffer = ctx.createBuffer(1, float32Data.length, 24000);
              buffer.copyToChannel(float32Data, 0);

              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);

              // Planification sans trou (Gapless)
              const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
              source.start(startTime);
              nextStartTimeRef.current = startTime + buffer.duration;
              
              audioQueueRef.current.push(source);
              source.onended = () => {
                audioQueueRef.current = audioQueueRef.current.filter(s => s !== source);
              };
            }

            // Gestion des interruptions (si l'utilisateur parle par dessus)
            if (msg.serverContent?.interrupted) {
               audioQueueRef.current.forEach(s => s.stop());
               audioQueueRef.current = [];
               if (audioContextRef.current) nextStartTimeRef.current = audioContextRef.current.currentTime;
            }
          },
          onclose: () => {
            console.log("Session Live fermée");
            stopLiveSession();
          },
          onerror: (err) => {
            console.error("Erreur Live:", err);
            stopLiveSession();
          }
        }
      });
      liveSessionRef.current = sessionPromise;

    } catch (e) {
      console.error("Impossible de démarrer le live:", e);
      setIsLiveMode(false);
    }
  };

  const stopLiveSession = () => {
    setIsLiveConnected(false);
    setIsLiveMode(false);
    
    // Fermeture Audio Context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    // Arrêt Micro
    if (inputSourceRef.current) {
      inputSourceRef.current.disconnect();
      inputSourceRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    // Arrêt Session Gemini (Pas de méthode close explicite sur la promesse, on laisse le GC ou on envoie un signal si l'API le permettait, ici on coupe juste le flux client)
    // Note: session.close() existe sur l'objet session résolu, on pourrait le faire proprement :
    if (liveSessionRef.current) {
       liveSessionRef.current.then((s: any) => {
         try { s.close(); } catch(e) {}
       });
    }
    liveSessionRef.current = null;
    setVolumeLevel(0);
  };

  // --- LOGIQUE CHAT CLASSIQUE ---

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  useEffect(() => {
    if (!isLiveMode) scrollToBottom();
  }, [messages, isLiveMode]);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const txt = input;
    setInput('');
    processTextInput(txt);
  };

  const processTextInput = async (text: string) => {
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: text }]);

    try {
      const res = await chatWithAI(text, user, messages);
      // Traitement des données extraites (poids, etc.)
      if (res.extractedInfo && Object.keys(res.extractedInfo).length > 0) {
        const updatedUser = { ...user };
        if (res.extractedInfo.weight) updatedUser.weightHistory = [...(user.weightHistory || []), { date: new Date().toISOString(), weight: res.extractedInfo.weight }];
        if (res.extractedInfo.height) updatedUser.height = res.extractedInfo.height;
        if (res.extractedInfo.age) updatedUser.age = res.extractedInfo.age;
        if (res.extractedInfo.gender) updatedUser.gender = res.extractedInfo.gender;
        onUpdateUser(updatedUser);
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.reply || "J'ai bien reçu l'information.",
        concept: res.suggestedConcept
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Désolé, une erreur technique est survenue." }]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- RENDU ---

  // MODE LIVE (OVERLAY)
  if (isLiveMode) {
    return (
      <div className="absolute inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-6 animate-in zoom-in-95 duration-500">
        
        {/* Background Ambient */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/20 rounded-full blur-[120px] animate-pulse"></div>
        </div>

        {/* Header */}
        <div className="absolute top-6 left-0 right-0 flex justify-center">
           <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isLiveConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span className="text-white text-xs font-black uppercase tracking-widest">{isLiveConnected ? 'En Ligne avec Crystal' : 'Connexion...'}</span>
           </div>
        </div>

        {/* Visualizer Central */}
        <div className="relative z-10 flex flex-col items-center gap-12">
           <div className="relative w-48 h-48 sm:w-64 sm:h-64 flex items-center justify-center">
              {/* Cercles concentriques animés par le volume */}
              <div className="absolute inset-0 rounded-full border border-emerald-500/30 transition-all duration-75" style={{ transform: `scale(${1 + volumeLevel/200})` }}></div>
              <div className="absolute inset-4 rounded-full border border-emerald-400/20 transition-all duration-100" style={{ transform: `scale(${1 + volumeLevel/150})` }}></div>
              <div className="absolute inset-8 rounded-full border border-emerald-300/10 transition-all duration-150" style={{ transform: `scale(${1 + volumeLevel/100})` }}></div>
              
              {/* Photo Crystal */}
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-tr from-emerald-400 to-teal-300 p-1 shadow-2xl shadow-emerald-500/40 relative overflow-hidden">
                 <div className="absolute inset-0 bg-white/10 animate-pulse"></div>
                 <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center overflow-hidden">
                    <span className="text-6xl sm:text-7xl">✨</span>
                 </div>
              </div>
           </div>

           <div className="text-center space-y-2">
              <p className="text-white font-black text-2xl sm:text-3xl tracking-tight">Crystal</p>
              <p className="text-emerald-400/60 text-sm font-bold uppercase tracking-widest">IA Nutritionniste Premium</p>
           </div>
        </div>

        {/* Controls */}
        <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-6">
           <button 
             onClick={stopLiveSession}
             className="w-16 h-16 sm:w-20 sm:h-20 bg-rose-500 hover:bg-rose-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-rose-900/50 transition-all transform hover:scale-110 active:scale-95"
           >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
           </button>
        </div>
      </div>
    );
  }

  // MODE CHAT STANDARD
  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden font-sans">
      
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-100/40 rounded-full blur-[100px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/40 rounded-full blur-[100px] pointer-events-none z-0"></div>

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 px-6 py-4 flex items-center justify-between bg-white/70 backdrop-blur-xl border-b border-white/50">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-tr from-emerald-400 to-teal-400 rounded-full opacity-70 blur group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative w-10 h-10 bg-white rounded-full flex items-center justify-center text-lg shadow-sm">✨</div>
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
        <button onClick={() => setMessages([])} className="p-2 text-slate-400 hover:text-slate-600 transition-colors" title="Effacer">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto pt-24 pb-32 px-4 sm:px-6 space-y-8 scroll-smooth z-10 custom-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center mt-20 opacity-0 animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-forwards text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-[2.5rem] flex items-center justify-center text-5xl mb-6 shadow-inner border border-white">
              🎙️
            </div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">Bonjour {user.name.split(' ')[0]}</h3>
            <p className="text-sm text-slate-400 max-w-xs leading-relaxed mx-auto mb-8">
              Je suis Crystal. Pour une expérience optimale, essayez le mode conversation réelle.
            </p>
            
            <button 
              onClick={startLiveSession}
              className="group relative inline-flex items-center gap-3 px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-200 hover:bg-emerald-500 transition-all active:scale-95"
            >
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
              </span>
              Discuter en Direct
            </button>
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          return (
            <div key={i} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
              <div className={`
                px-6 py-4 max-w-[85%] sm:max-w-[75%] text-[15px] leading-7 shadow-sm transition-all
                ${isUser 
                  ? 'bg-gradient-to-br from-emerald-600 to-emerald-500 text-white rounded-[1.5rem] rounded-tr-sm shadow-emerald-200/50' 
                  : 'bg-white text-slate-700 border border-white/60 rounded-[1.5rem] rounded-tl-sm shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]'}
              `}>
                {msg.content}
              </div>
            </div>
          );
        })}

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
        <div className="max-w-4xl mx-auto flex gap-3">
            {/* Input Texte */}
            <form onSubmit={handleTextSubmit} className="flex-1 relative flex gap-2 items-center bg-white/80 backdrop-blur-xl p-2 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-white/50">
              <input 
                type="text" 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                placeholder="Écrivez à Crystal..." 
                className="flex-1 bg-transparent border-none outline-none text-[15px] px-6 py-3 text-slate-700 placeholder:text-slate-400 font-medium" 
              />
              <button 
                type="submit" 
                disabled={!input.trim() || isLoading} 
                className="w-11 h-11 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center shadow-md shrink-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-0.5"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
              </button>
            </form>

            {/* Bouton Live */}
            <button 
              onClick={startLiveSession}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-900 to-slate-800 text-white flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all border border-slate-700"
              title="Lancer le Live"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            </button>
        </div>
      </div>
    </div>
  );
};

export default Assistant;
