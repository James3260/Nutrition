
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { generateMealPlan, chatWithAI } from '../services/gemini';
import { MealPlan, User, WeightRecord } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  proposedPlan?: MealPlan;
  proposedShortList?: string[];
  isAudio?: boolean;
}

interface AssistantProps {
  setMealPlan: (plan: MealPlan) => void;
  user: User;
  onUpdateUser: (updatedUser: User) => void;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

// Helpers for audio processing
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const Assistant: React.FC<AssistantProps> = ({ setMealPlan, user, onUpdateUser, messages, setMessages }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<MealPlan | null>(null);
  const [shortList, setShortList] = useState<string[] | null>(null);
  const [chosenStartDate, setChosenStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, isLive]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (liveSessionRef.current) liveSessionRef.current.close();
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  const startLiveSession = async () => {
    if (isLive) {
      if (liveSessionRef.current) liveSessionRef.current.close();
      setIsLive(false);
      return;
    }

    setIsLive(true);
    setIsLoading(true);

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Initialize Audio
    const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 16000});
    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
    audioContextRef.current = outputAudioContext;
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: () => {
          setIsLoading(false);
          const source = inputAudioContext.createMediaStreamSource(stream);
          const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
          scriptProcessor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const l = inputData.length;
            const int16 = new Int16Array(l);
            for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
            const pcmBlob = {
              data: encode(new Uint8Array(int16.buffer)),
              mimeType: 'audio/pcm;rate=16000',
            };
            sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
          };
          source.connect(scriptProcessor);
          scriptProcessor.connect(inputAudioContext.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          if (message.serverContent?.outputTranscription) {
            const text = message.serverContent.outputTranscription.text;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'assistant' && last.isAudio) {
                return [...prev.slice(0, -1), { ...last, content: last.content + text }];
              }
              return [...prev, { role: 'assistant', content: text, isAudio: true }];
            });
          }

          const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (base64Audio) {
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
            const buffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
            const source = outputAudioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(outputAudioContext.destination);
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buffer.duration;
          }
        },
        onclose: () => setIsLive(false),
        onerror: () => setIsLive(false),
      },
      config: {
        responseModalities: [Modality.AUDIO],
        outputAudioTranscription: {},
        systemInstruction: `Tu es NutriTrack AI, un coach vocal expert en nutrition. Tu parles de manière chaleureuse, motivante et concise. Ton but est d'aider ${user.name} à atteindre ses objectifs de santé.`,
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } },
      }
    });

    liveSessionRef.current = await sessionPromise;
  };

  const handleFinalizePlan = () => {
    if (pendingPlan) {
      const finalizedPlan: MealPlan = {
        ...pendingPlan,
        startDate: new Date(chosenStartDate).toISOString()
      };
      setMealPlan(finalizedPlan);
      const formattedDate = new Date(chosenStartDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      setMessages(prev => [...prev, { role: 'assistant', content: `C'est validé ! ✅ Votre programme est prêt pour le ${formattedDate}.` }]);
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
          if (Object.keys(updates).length > 0) onUpdateUser({ ...user, ...updates });
        }
        setMessages(prev => [...prev, { role: 'assistant', content: result.reply }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Désolé, j'ai rencontré une petite erreur. Peux-tu reformuler ?" }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-140px)] bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden relative">
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-5 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-2xl shadow-xl shadow-emerald-100 animate-pulse-slow">🤖</div>
          <div>
            <h2 className="text-lg font-black text-slate-800 tracking-tight">Coach NutriTrack</h2>
            <p className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isLive ? 'text-rose-500' : 'text-emerald-500'}`}>
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-rose-500 animate-ping' : 'bg-emerald-500 animate-pulse'}`}></span>
              {isLive ? 'Session Vocale Active' : 'En attente'}
            </p>
          </div>
        </div>
        
        <button 
          onClick={startLiveSession}
          className={`p-4 rounded-2xl transition-all shadow-lg ${isLive ? 'bg-rose-500 text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
          title={isLive ? "Arrêter la voix" : "Parler de vive voix"}
        >
          {isLive ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 bg-slate-50/20 custom-scrollbar">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-30">
            <div className="text-6xl mb-6">🥗</div>
            <p className="font-black text-slate-800 uppercase tracking-[0.2em] text-sm">Prêt à transformer votre alimentation ?</p>
            <p className="text-xs font-bold mt-2">Dites-moi "Génère-moi un plan pour perdre 5kg"</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start animate-scale-in'}`}>
            <div className={`max-w-[85%] md:max-w-[75%] px-7 py-5 rounded-[2.5rem] text-[15px] leading-relaxed shadow-sm transition-all ${msg.role === 'user' ? 'bg-slate-900 text-white rounded-br-none' : 'bg-white text-slate-700 rounded-bl-none border border-slate-100'}`}>
              {msg.content || (msg.isAudio && "Transcription en cours...")}
            </div>
            
            {msg.proposedShortList && (
              <div className="mt-6 w-full max-w-sm bg-white rounded-[3.5rem] border-2 border-emerald-50 p-8 shadow-2xl animate-in zoom-in-95">
                <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4">Aperçu Semaine 1</h4>
                <ul className="space-y-2 mb-8">
                  {msg.proposedShortList.slice(0, 4).map((meal, idx) => (
                    <li key={idx} className="text-xs text-slate-600 font-bold p-3 bg-slate-50 rounded-2xl border border-slate-100">🥗 {meal}</li>
                  ))}
                </ul>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Début du programme</label>
                    <input type="date" value={chosenStartDate} min={new Date().toISOString().split('T')[0]} onChange={(e) => setChosenStartDate(e.target.value)} className="w-full px-5 py-4 bg-slate-100 rounded-2xl text-slate-800 font-bold text-sm outline-none border-2 border-transparent focus:border-emerald-500/10" />
                  </div>
                  <button onClick={handleFinalizePlan} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all active:scale-95">Valider le plan ✅</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {isLoading && !isLive && (
          <div className="flex justify-start">
            <div className="bg-white px-6 py-4 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-3">
              <div className="flex gap-1.5"><div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.1s]"></div><div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.2s]"></div></div>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Réflexion...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-6 md:p-8 bg-white border-t border-slate-100">
        <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto flex items-center gap-3">
          <input 
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder={isLive ? "L'assistant vous écoute..." : "Décrivez vos objectifs ici..."}
            className="flex-1 pl-8 pr-16 py-5 bg-slate-100 rounded-[2rem] border-2 border-transparent focus:border-emerald-500/20 focus:bg-white focus:ring-0 text-slate-800 placeholder:text-slate-400 font-medium transition-all text-md shadow-inner" 
          />
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()} 
            className="w-16 h-16 bg-slate-900 text-white rounded-[1.8rem] flex items-center justify-center hover:bg-emerald-600 transition-all disabled:opacity-20 active:scale-90 shadow-2xl"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        </form>
      </div>
      <style>{`
        .animate-scale-in { animation: scaleIn 0.3s ease-out; }
        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-pulse-slow { animation: pulseSlow 3s infinite; }
        @keyframes pulseSlow { 0%, 100% { opacity: 1; } 50% { opacity: 0.8; } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default Assistant;
