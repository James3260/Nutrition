
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { generateMealPlan, chatWithAI } from '../services/gemini';
import { MealPlan, User } from '../types';

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

const Assistant: React.FC<AssistantProps> = ({ setMealPlan, user, messages, setMessages }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<MealPlan | null>(null);
  const [shortList, setShortList] = useState<string[] | null>(null);
  
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
            const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
            sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
          };
          source.connect(scriptProcessor);
          scriptProcessor.connect(inputAudioContext.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          if (message.serverContent?.outputTranscription) {
            const text = message.serverContent.outputTranscription.text || '';
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'assistant' && last.isAudio) {
                return [...prev.slice(0, -1), { ...last, content: last.content + text }];
              }
              return [...prev, { role: 'assistant', content: text, isAudio: true }];
            });
          }
          const parts = message.serverContent?.modelTurn?.parts;
          const base64Audio = parts && parts.length > 0 ? parts[0].inlineData?.data : null;
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
        systemInstruction: `Tu es NutriTrack AI, un coach vocal expert en nutrition premium. Tu parles de manière chaleureuse, motivante et concise. Ton but est d'aider ${user.name} à atteindre ses objectifs.`,
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } },
      }
    });
    liveSessionRef.current = await sessionPromise;
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
        setMessages(prev => [...prev, { role: 'assistant', content: "J'ai conçu votre programme sur-mesure. Voici un aperçu.", proposedShortList: sampleMeals }]);
      } else {
        const result = await chatWithAI(userMsg, user);
        setMessages(prev => [...prev, { role: 'assistant', content: result.reply }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Désolé, j'ai rencontré un contretemps technique." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-12rem)] md:h-[80vh] bg-white/60 backdrop-blur-2xl rounded-[2rem] md:rounded-[3rem] shadow-premium border border-white/80 overflow-hidden relative animate-in fade-in zoom-in-95 duration-700">
      {/* Background Ornaments */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-100/30 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-100/20 rounded-full blur-[100px] -ml-32 -mb-32 pointer-events-none"></div>

      <div className="bg-white/50 border-b border-slate-100 px-6 md:px-10 py-5 flex items-center justify-between z-10 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-tr from-emerald-600 to-teal-400 rounded-2xl flex items-center justify-center text-white text-2xl shadow-xl shadow-emerald-200/50 float">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" fillOpacity="0.4"/>
              <path d="M12 2L19.5 20.29L12 18V2Z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight leading-none mb-1">Coach IA Crystal</h2>
            <div className="flex items-center gap-2">
               <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></span>
               <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                 {isLive ? 'Session Vocale' : 'Analyse en temps réel'}
               </p>
            </div>
          </div>
        </div>
        
        <button 
          onClick={startLiveSession}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${isLive ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'bg-slate-50 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 hover:shadow-inner'}`}
          title="Démarrer une session vocale"
        >
          {isLive ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4" /></svg>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-12 space-y-8 no-scrollbar scroll-smooth">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center py-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
             <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-5xl mb-8 float opacity-50">✨</div>
             <p className="font-black text-slate-400 uppercase tracking-[0.4em] text-xs">Votre voyage commence ici</p>
             <p className="text-slate-300 text-[10px] mt-4 max-w-xs font-medium">Posez vos questions ou décrivez votre objectif pour recevoir un plan personnalisé.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-500`}>
            <div className={`max-w-[85%] md:max-w-[70%] px-6 md:px-8 py-4 md:py-5 rounded-[1.5rem] md:rounded-[2.2rem] text-sm md:text-base leading-relaxed shadow-sm transition-all ${
              msg.role === 'user' 
                ? 'bg-emerald-600 text-white rounded-br-none shadow-emerald-100/50' 
                : 'bg-white text-slate-700 rounded-bl-none border border-slate-100 border-b-2'
            }`}>
              {msg.content || (msg.isAudio && "Transcription en cours...")}
            </div>
            
            {msg.proposedShortList && (
              <div className="mt-8 w-full max-w-sm bg-white/90 backdrop-blur-xl rounded-[2.5rem] md:rounded-[3.5rem] border border-emerald-500/20 p-8 md:p-10 shadow-2xl animate-in zoom-in-95 duration-700">
                <div className="flex items-center gap-2 mb-6">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Plan Sur-Mesure Détecté</p>
                </div>
                <ul className="space-y-3 mb-10">
                  {msg.proposedShortList.slice(0, 4).map((meal, idx) => (
                    <li key={idx} className="text-xs text-slate-600 font-bold p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/30 flex items-center gap-3">
                      <span className="text-lg">🥗</span> {meal}
                    </li>
                  ))}
                </ul>
                <button 
                  onClick={() => setMealPlan(pendingPlan!)} 
                  className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-emerald-600 transition-all active:scale-95"
                >
                  Activer mon programme
                </button>
              </div>
            )}
          </div>
        ))}
        {isLoading && !isLive && (
          <div className="flex justify-start animate-in fade-in duration-300">
            <div className="bg-white/80 px-6 py-4 rounded-full border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="flex gap-1.5">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Réflexion IA...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-6 md:p-12 bg-white/40 border-t border-slate-100 backdrop-blur-md shrink-0">
        <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto flex items-center gap-3 md:gap-4">
          <div className="flex-1 relative">
            <input 
              type="text" 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              placeholder={isLive ? "Le coach vous écoute..." : "Dites-moi tout sur vos objectifs..."}
              className="w-full pl-6 md:pl-10 pr-12 md:pr-16 py-4 md:py-6 bg-white/80 rounded-[1.5rem] md:rounded-[2.2rem] border-2 border-slate-100 focus:border-emerald-500/30 focus:bg-white focus:ring-0 text-slate-800 placeholder:text-slate-400 font-medium transition-all text-sm md:text-lg shadow-sm outline-none" 
            />
            {isLoading && (
               <div className="absolute right-6 top-1/2 -translate-y-1/2">
                 <div className="w-5 h-5 border-2 border-emerald-50 border-t-emerald-500 rounded-full animate-spin"></div>
               </div>
            )}
          </div>
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()} 
            className="w-14 h-14 md:w-20 md:h-20 bg-slate-900 text-white rounded-2xl md:rounded-[2.2rem] flex items-center justify-center hover:bg-emerald-600 transition-all disabled:opacity-20 active:scale-90 shadow-2xl shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-8 md:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 19l9 2-9-18-9 18 9-2" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default Assistant;
