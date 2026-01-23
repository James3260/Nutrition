
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
    <div className="flex flex-col h-full bg-slate-900/40 backdrop-blur-3xl rounded-[2rem] md:rounded-[4rem] shadow-2xl border border-white/5 overflow-hidden relative mb-24 md:mb-0">
      <div className="bg-black/20 border-b border-white/5 px-6 md:px-10 py-4 md:py-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3 md:gap-5">
          <div className="w-10 h-10 md:w-14 md:h-14 bg-emerald-500 rounded-xl md:rounded-[1.5rem] flex items-center justify-center text-xl md:text-3xl shadow-lg shadow-emerald-500/20">🤖</div>
          <div>
            <h2 className="text-sm md:text-xl font-black text-white tracking-tight">Coach IA Premium</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
               <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></span>
               <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-slate-500">
                 {isLive ? 'Vocal' : 'Connecté'}
               </p>
            </div>
          </div>
        </div>
        
        <button 
          onClick={startLiveSession}
          className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center transition-all ${isLive ? 'bg-rose-500 text-white animate-glow' : 'bg-white/5 text-slate-400 hover:text-emerald-500 hover:bg-white/10'}`}
        >
          {isLive ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4" /></svg>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 md:space-y-10 no-scrollbar">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-20 py-10 md:py-20">
             <div className="text-6xl md:text-8xl mb-6 md:mb-8 float">✨</div>
             <p className="font-black text-white uppercase tracking-[0.3em] md:tracking-[0.4em] text-[10px] md:text-sm px-4">Prêt pour votre transformation ?</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start animate-scale-in'}`}>
            <div className={`max-w-[85%] md:max-w-[80%] px-5 md:px-8 py-4 md:py-6 rounded-[1.5rem] md:rounded-[2.5rem] text-sm md:text-[16px] leading-relaxed shadow-xl ${msg.role === 'user' ? 'bg-white text-black rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none border border-white/5'}`}>
              {msg.content || (msg.isAudio && "Transcription...")}
            </div>
            
            {msg.proposedShortList && (
              <div className="mt-6 md:mt-8 w-full max-w-sm bg-black/40 backdrop-blur-xl rounded-[2.5rem] md:rounded-[3.5rem] border border-emerald-500/20 p-6 md:p-10 shadow-2xl animate-in zoom-in-95">
                <p className="text-[8px] md:text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-4 md:mb-6">Aperçu Semaine 1</p>
                <ul className="space-y-2 md:space-y-3 mb-6 md:mb-10">
                  {msg.proposedShortList.slice(0, 4).map((meal, idx) => (
                    <li key={idx} className="text-[10px] md:text-xs text-slate-300 font-bold p-3 md:p-4 bg-white/5 rounded-xl md:rounded-2xl border border-white/5">🥗 {meal}</li>
                  ))}
                </ul>
                <button onClick={() => setMealPlan(pendingPlan!)} className="w-full py-4 md:py-5 bg-emerald-500 text-white rounded-xl md:rounded-[2rem] font-black text-[10px] md:text-[11px] uppercase tracking-[0.2em] md:tracking-[0.3em] shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">Activer le Programme</button>
              </div>
            )}
          </div>
        ))}
        {isLoading && !isLive && (
          <div className="flex justify-start">
            <div className="bg-slate-800 px-4 md:px-6 py-3 md:py-4 rounded-full border border-white/5 shadow-xl flex items-center gap-3 md:gap-4">
              <div className="flex gap-1.5"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]"></div><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]"></div></div>
              <span className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest">IA en réflexion...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 md:p-12 bg-black/20 border-t border-white/5 backdrop-blur-md">
        <form onSubmit={handleSubmit} className="relative max-w-3xl mx-auto flex items-center gap-2 md:gap-4">
          <input 
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder={isLive ? "Le coach écoute..." : "Décrivez vos objectifs..."}
            className="flex-1 pl-6 md:pl-10 pr-12 md:pr-20 py-4 md:py-6 bg-white/5 rounded-2xl md:rounded-[2rem] border-2 border-transparent focus:border-emerald-500/20 focus:bg-white/10 focus:ring-0 text-white placeholder:text-slate-600 font-medium transition-all text-sm md:text-lg shadow-inner" 
          />
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()} 
            className="w-12 h-12 md:w-16 md:h-16 bg-white text-black rounded-xl md:rounded-3xl flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all disabled:opacity-20 active:scale-90 shadow-2xl shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-7 md:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 19l9 2-9-18-9 18 9-2" /></svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default Assistant;
