
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
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
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

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages, isLoading, isLive]);

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
            const int16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
            sessionPromise.then(session => session.sendRealtimeInput({ media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } }));
          };
          source.connect(scriptProcessor);
          scriptProcessor.connect(inputAudioContext.destination);
        },
        onmessage: async (m) => {
          if (m.serverContent?.outputTranscription) {
            const text = m.serverContent.outputTranscription.text || '';
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'assistant' && last.isAudio) return [...prev.slice(0, -1), { ...last, content: last.content + text }];
              return [...prev, { role: 'assistant', content: text, isAudio: true }];
            });
          }
          const base64Audio = m.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
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
        systemInstruction: `Coach NutriTrack AI pour ${user.name}.`,
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
        setPendingPlan(plan);
        const meals = plan.recipes.slice(0, 4).map(r => r.name);
        setShortList(meals);
        setMessages(prev => [...prev, { role: 'assistant', content: "Programme généré avec succès.", proposedShortList: meals }]);
      } else {
        const res = await chatWithAI(userMsg, user);
        setMessages(prev => [...prev, { role: 'assistant', content: res.reply }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Erreur technique IA." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white/70 backdrop-blur-3xl rounded-[2rem] sm:rounded-[3rem] shadow-premium border border-white/80 overflow-hidden relative min-h-[500px] sm:min-h-0">
      <div className="bg-white/40 border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white text-xl shadow-lg">🤖</div>
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Assistant Crystal</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase">{isLive ? 'Session Vocale Active' : 'Prêt'}</p>
          </div>
        </div>
        <button onClick={startLiveSession} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isLive ? 'bg-rose-500 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:text-emerald-600'}`}>
          {isLive ? '✕' : '🎙️'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 no-scrollbar">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-20">
            <div className="text-5xl mb-4">✨</div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em]">Posez-moi une question sur votre nutrition</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[85%] px-5 py-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-white border border-slate-100 text-slate-700 rounded-bl-none shadow-sm'}`}>
              {msg.content}
            </div>
            {msg.proposedShortList && (
              <div className="mt-4 w-full max-w-xs bg-white p-5 rounded-3xl border border-emerald-100 shadow-xl">
                <p className="text-[9px] font-black text-emerald-600 uppercase mb-3">Aperçu du Plan</p>
                <ul className="space-y-2 mb-4">
                  {msg.proposedShortList.map((m, idx) => (
                    <li key={idx} className="text-xs font-bold text-slate-600 flex gap-2">🥗 {m}</li>
                  ))}
                </ul>
                <button onClick={() => setMealPlan(pendingPlan!)} className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all">Activer</button>
              </div>
            )}
          </div>
        ))}
        {isLoading && !isLive && (
          <div className="flex items-center gap-2 text-slate-300">
            <div className="w-1 h-1 bg-emerald-500 rounded-full animate-ping"></div>
            <span className="text-[8px] font-black uppercase">Analyse en cours...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 sm:p-6 bg-white/40 border-t border-slate-50 shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-4xl mx-auto">
          <input 
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="Échangeons ici..."
            className="flex-1 px-5 py-3 sm:py-4 bg-white rounded-2xl border-2 border-slate-100 focus:border-emerald-500/40 outline-none text-sm transition-all shadow-sm"
          />
          <button type="submit" disabled={isLoading || !input.trim()} className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center hover:bg-emerald-600 disabled:opacity-20 transition-all shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 12h14M12 5l7 7-7 7" /></svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default Assistant;
