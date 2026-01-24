
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { chatWithAI, generateMealPlan, tools } from '../services/gemini';
import { MealPlan, User } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  concept?: {
    title: string;
    description: string;
    exampleMeals: string[];
  };
}

interface AssistantProps {
  setMealPlan: (plan: MealPlan) => void;
  user: User;
  onUpdateUser: (updatedUser: User) => void;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

// --- UTILITAIRES AUDIO ---

function processAudioInput(inputData: Float32Array, inputSampleRate: number, targetSampleRate: number = 16000) {
  const ratio = inputSampleRate / targetSampleRate;
  const newLength = Math.floor(inputData.length / ratio);
  const pcmBuffer = new Int16Array(newLength);
  
  for (let i = 0; i < newLength; i++) {
    const offset = Math.floor(i * ratio);
    const sample = Math.max(-1, Math.min(1, inputData[offset])); 
    pcmBuffer[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
  }
  return pcmBuffer.buffer;
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
  const [liveError, setLiveError] = useState<string | null>(null);
  
  // Chat Textuel
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- LOGIQUE LIVE API ---
  const [volumeLevel, setVolumeLevel] = useState(0); 
  
  // Refs Audio
  const audioContextRef = useRef<AudioContext | null>(null);
  const liveSessionRef = useRef<any>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null); 
  const nextStartTimeRef = useRef<number>(0);
  const audioQueueRef = useRef<AudioBufferSourceNode[]>([]);
  const animationFrameRef = useRef<number>(0);
  
  // Transcription Buffers
  const currentInputTranscription = useRef<string>("");
  const currentOutputTranscription = useRef<string>("");

  useEffect(() => {
    return () => cleanupAudio();
  }, []);

  const cleanupAudio = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    try {
      if (inputSourceRef.current) inputSourceRef.current.disconnect();
      if (processorRef.current) processorRef.current.disconnect();
      if (analyserRef.current) analyserRef.current.disconnect();
      if (audioContextRef.current) {
        if (audioContextRef.current.state !== 'closed') audioContextRef.current.close();
        audioContextRef.current = null;
      }
    } catch (e) { console.warn(e); }
    liveSessionRef.current = null;
    setIsLiveConnected(false);
    audioQueueRef.current = [];
  };

  const startLiveSession = async () => {
    if (!process.env.API_KEY) return;
    setLiveError(null);
    setIsLiveMode(true);
    
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;
      if (audioCtx.state === 'suspended') await audioCtx.resume();

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } 
      });

      nextStartTimeRef.current = audioCtx.currentTime;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const animateVisualizer = () => {
        if (!analyserRef.current || !isLiveMode) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = dataArray.reduce((a, b) => a + b, 0);
        setVolumeLevel((sum / dataArray.length) * 2);
        animationFrameRef.current = requestAnimationFrame(animateVisualizer);
      };
      animateVisualizer();

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: tools,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          systemInstruction: `Tu es Crystal, coach nutrition. Parle avec ${user.name}. Court et vif. Enregistre les données avec 'update_user_profile'.`,
        },
        callbacks: {
          onopen: () => {
            setIsLiveConnected(true);
            const source = audioCtx.createMediaStreamSource(stream);
            inputSourceRef.current = source;
            const processor = audioCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            source.connect(analyser);
            analyser.connect(processor);
            processor.connect(audioCtx.destination); 
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBuffer = processAudioInput(inputData, audioCtx.sampleRate, 16000);
              const base64Data = base64Encode(pcmBuffer);
              sessionPromise.then(session => session.sendRealtimeInput({ media: { mimeType: 'audio/pcm;rate=16000', data: base64Data } }));
            };
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.serverContent?.outputTranscription) currentOutputTranscription.current += msg.serverContent.outputTranscription.text;
            else if (msg.serverContent?.inputTranscription) currentInputTranscription.current += msg.serverContent.inputTranscription.text;

            if (msg.serverContent?.turnComplete) {
               if (currentInputTranscription.current.trim()) setMessages(p => [...p, { role: 'user', content: currentInputTranscription.current }]);
               if (currentOutputTranscription.current.trim()) setMessages(p => [...p, { role: 'assistant', content: currentOutputTranscription.current }]);
               currentInputTranscription.current = ""; currentOutputTranscription.current = "";
            }

            if (msg.toolCall?.functionCalls) {
              for (const fc of msg.toolCall.functionCalls) {
                const args = fc.args || {};
                if (fc.name === 'update_user_profile') {
                   const updatedUser = { ...user, ...args };
                   if (args.weight) updatedUser.weightHistory = [...(user.weightHistory || []), { date: new Date().toISOString(), weight: args.weight as number }];
                   onUpdateUser(updatedUser);
                }
                sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: "ok" } } }));
              }
            }

            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && audioContextRef.current) {
              const ctx = audioContextRef.current;
              const rawBytes = base64Decode(audioData);
              const dataInt16 = new Int16Array(rawBytes.buffer);
              const float32Data = new Float32Array(dataInt16.length);
              for (let i = 0; i < dataInt16.length; i++) float32Data[i] = dataInt16[i] / 32768.0;
              const buffer = ctx.createBuffer(1, float32Data.length, 24000);
              buffer.copyToChannel(float32Data, 0);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
              source.start(startTime);
              nextStartTimeRef.current = startTime + buffer.duration;
              audioQueueRef.current.push(source);
            }
          },
          onclose: () => { cleanupAudio(); setIsLiveMode(false); },
          onerror: () => { setLiveError("Connexion instable."); cleanupAudio(); }
        }
      });
    } catch (e) { setLiveError("Erreur micro."); cleanupAudio(); }
  };

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages, isLoading]);

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const txt = input; 
    setInput(''); 
    setIsLoading(true);
    
    // Ajout immédiat du message utilisateur
    setMessages(prev => [...prev, { role: 'user', content: txt }]);
    
    try {
      const res = await chatWithAI(txt, user, messages);
      
      // Mise à jour profil utilisateur
      if (res.extractedInfo && Object.keys(res.extractedInfo).length > 0) {
        const updatedUser = { ...user, ...res.extractedInfo };
        if (res.extractedInfo.weight) updatedUser.weightHistory = [...(user.weightHistory || []), { date: new Date().toISOString(), weight: res.extractedInfo.weight }];
        onUpdateUser(updatedUser);
      }
      
      // Ajout réponse Assistant (avec sécurité pour le contenu)
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

  if (isLiveMode) {
    return (
      <div className="absolute inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center p-6 animate-in zoom-in-95 duration-500">
        {/* ... (Code du mode Live inchangé) ... */}
        <div className="absolute top-10 px-5 py-2.5 rounded-full border border-white/10 bg-white/5 flex items-center gap-3 backdrop-blur-md">
          <span className={`w-2.5 h-2.5 rounded-full ${isLiveConnected ? 'bg-emerald-400 animate-pulse shadow-[0_0_12px_rgba(52,211,153,0.5)]' : 'bg-amber-400'}`}></span>
          <span className="text-white text-[10px] font-black uppercase tracking-[0.2em]">{isLiveConnected ? 'Mode Vocal Actif' : 'Connexion Crystal...'}</span>
        </div>
        <div className="relative w-56 h-56 sm:w-72 sm:h-72 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-emerald-500/10 transition-transform duration-75" style={{ transform: `scale(${1 + volumeLevel/200})` }}></div>
          <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-7xl shadow-[0_0_60px_-15px_rgba(16,185,129,0.4)] animate-pulse">✨</div>
        </div>
        <button onClick={() => { cleanupAudio(); setIsLiveMode(false); }} className="absolute bottom-16 w-20 h-20 bg-rose-500 hover:bg-rose-600 rounded-full flex items-center justify-center text-white shadow-2xl transition-all active:scale-90 group">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 group-hover:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 relative font-sans">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-gradient-to-tr from-emerald-50/40 via-white to-slate-100 pointer-events-none"></div>

      {/* 
         FIX SCROLL: 
         1. min-h-0 est critique pour que le scroll fonctionne dans un flex container imbriqué.
         2. pb-4 pour l'espacement du bas.
         3. Pas de 'items-center' ici pour éviter les bugs de largeur, on centre le contenu interne.
      */}
      <div className="flex-1 overflow-y-auto min-h-0 z-10 custom-scrollbar relative">
        <div className="w-full max-w-3xl mx-auto px-4 sm:px-8 py-10 space-y-8 min-h-full flex flex-col justify-end">
          {messages.length === 0 && (
            <div className="py-24 text-center animate-in fade-in slide-in-from-bottom-10 duration-1000">
              <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center text-5xl mx-auto mb-8 shadow-premium border border-white">🎙️</div>
              <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Bonjour {user.name.split(' ')[0]}</h3>
              <p className="text-sm text-slate-400 max-w-xs mx-auto mb-10 leading-relaxed font-medium">Posez-moi vos questions sur votre nutrition ou lancez un suivi vocal en direct.</p>
              <button onClick={startLiveSession} className="px-10 py-5 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-emerald-100 hover:bg-emerald-500 hover:-translate-y-1 active:scale-95 transition-all">Démarrer Crystal Live</button>
            </div>
          )}
          
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-4 duration-500`}>
              <div className={`px-6 py-4 max-w-[90%] md:max-w-[80%] text-[15px] leading-relaxed shadow-sm transition-all break-words ${
                msg.role === 'user' 
                  ? 'bg-emerald-600 text-white rounded-[1.8rem] rounded-tr-sm' 
                  : 'bg-white text-slate-700 border border-white rounded-[1.8rem] rounded-tl-sm shadow-premium'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white px-6 py-5 rounded-[1.8rem] rounded-tl-sm flex gap-2 shadow-sm border border-white">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.15s]"></div>
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.3s]"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-4 shrink-0" />
        </div>
      </div>

      {/* Control Area - Fixed at bottom */}
      <div className="shrink-0 p-6 sm:pb-10 bg-white/40 backdrop-blur-xl border-t border-white/50 z-30">
        <div className="max-w-3xl mx-auto flex gap-4 items-center">
          <form onSubmit={handleTextSubmit} className="flex-1 flex gap-2 items-center bg-white p-2 rounded-[2rem] shadow-xl shadow-slate-200/40 border border-white">
            <input 
              type="text" 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              placeholder="Écrivez à Crystal..." 
              className="flex-1 bg-transparent border-none outline-none px-6 py-4 text-[15px] text-slate-800 placeholder:text-slate-300 font-bold" 
            />
            <button type="submit" disabled={!input.trim() || isLoading} className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg hover:bg-emerald-500 active:scale-90 transition-all disabled:opacity-50 shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-0.5"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
            </button>
          </form>
          <button onClick={startLiveSession} className="w-16 h-16 rounded-[1.8rem] bg-slate-900 text-white flex items-center justify-center shadow-2xl hover:bg-slate-800 hover:-translate-y-1 active:scale-95 transition-all group shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-emerald-400 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Assistant;
