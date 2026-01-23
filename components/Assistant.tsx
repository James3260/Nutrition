
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
  
  // Refs Audio (Persistance hors cycle de rendu)
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

  // Nettoyage complet
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, []);

  const cleanupAudio = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    try {
      if (inputSourceRef.current) {
        inputSourceRef.current.disconnect();
        inputSourceRef.current = null;
      }
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
      }
      if (audioContextRef.current) {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(e => console.warn("Close error", e));
        }
        audioContextRef.current = null;
      }
    } catch (e) {
      console.warn("Cleanup warning:", e);
    }
    
    liveSessionRef.current = null;
    setIsLiveConnected(false);
    audioQueueRef.current = [];
  };

  const startLiveSession = async () => {
    if (!process.env.API_KEY) {
      alert("Clé API manquante");
      return;
    }
    setLiveError(null);
    setIsLiveMode(true);
    
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      // iOS : Resume context obligatoirement sur interaction utilisateur
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1 
        } 
      });

      nextStartTimeRef.current = audioCtx.currentTime;

      // --- SETUP VISUALISER ---
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64; // Réduit pour moins de charge CPU
      analyserRef.current = analyser;

      const animateVisualizer = () => {
        if (!analyserRef.current || !isLiveMode) return;
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        setVolumeLevel(average * 2);
        
        animationFrameRef.current = requestAnimationFrame(animateVisualizer);
      };
      animateVisualizer();

      // --- CONNEXION GEMINI ---
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {}, // Active la transcription utilisateur
          outputAudioTranscription: {}, // Active la transcription modèle
          tools: tools, // Ajout des outils pour le plan
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: `Tu es Crystal, coach nutrition. Conversation orale avec ${user.name}.
          Si l'utilisateur confirme vouloir le plan, UTILISE L'OUTIL 'propose_meal_plan_concept'.
          Réponses courtes et naturelles.`,
        },
        callbacks: {
          onopen: () => {
            console.log("Live Connected");
            setIsLiveConnected(true);

            // --- SETUP PROCESSING ---
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

              sessionPromise.then(session => {
                session.sendRealtimeInput({
                  media: { mimeType: 'audio/pcm;rate=16000', data: base64Data }
                });
              });
            };
          },
          onmessage: async (msg: LiveServerMessage) => {
            // 1. Gestion des transcriptions pour l'historique
            if (msg.serverContent?.outputTranscription) {
              currentOutputTranscription.current += msg.serverContent.outputTranscription.text;
            } else if (msg.serverContent?.inputTranscription) {
              currentInputTranscription.current += msg.serverContent.inputTranscription.text;
            }

            if (msg.serverContent?.turnComplete) {
               const userText = currentInputTranscription.current;
               const modelText = currentOutputTranscription.current;
               
               if (userText.trim()) {
                 setMessages(prev => [...prev, { role: 'user', content: userText }]);
               }
               if (modelText.trim()) {
                 setMessages(prev => [...prev, { role: 'assistant', content: modelText }]);
               }
               
               currentInputTranscription.current = "";
               currentOutputTranscription.current = "";
            }

            // 2. Gestion des outils (Génération de plan)
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                console.log("Tool Called:", fc.name);
                
                let result: any = { status: "ok" };

                if (fc.name === 'update_user_profile') {
                   const updatedUser = { ...user, ...fc.args };
                   if (fc.args.weight) updatedUser.weightHistory = [...(user.weightHistory || []), { date: new Date().toISOString(), weight: fc.args.weight as number }];
                   onUpdateUser(updatedUser);
                   result = { status: "updated" };
                }

                if (fc.name === 'propose_meal_plan_concept') {
                   // Génération réelle du plan
                   try {
                     // On lance la génération en arrière-plan
                     generateMealPlan(fc.args, user).then(plan => {
                       setMealPlan(plan);
                       // On ajoute un message système spécial dans le chat
                       setMessages(prev => [...prev, { 
                         role: 'assistant', 
                         content: "J'ai généré votre plan complet sur 30 jours ! Vous pouvez le consulter dans l'onglet Agenda.",
                         concept: fc.args as any
                       }]);
                     });
                     result = { status: "generating_in_background" };
                   } catch (e) {
                     console.error("Erreur generation plan", e);
                     result = { error: "failed" };
                   }
                }

                // Réponse obligatoire au serveur
                sessionPromise.then(session => {
                  session.sendToolResponse({
                    functionResponses: {
                      id: fc.id,
                      name: fc.name,
                      response: { result }
                    }
                  });
                });
              }
            }

            // 3. Audio Output
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && audioContextRef.current) {
              const ctx = audioContextRef.current;
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

              const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
              source.start(startTime);
              nextStartTimeRef.current = startTime + buffer.duration;
              
              audioQueueRef.current.push(source);
              source.onended = () => {
                audioQueueRef.current = audioQueueRef.current.filter(s => s !== source);
              };
            }

            if (msg.serverContent?.interrupted) {
               audioQueueRef.current.forEach(s => { try{ s.stop(); }catch(e){} });
               audioQueueRef.current = [];
               if (audioContextRef.current) nextStartTimeRef.current = audioContextRef.current.currentTime;
            }
          },
          onclose: () => {
            console.log("Closed by server");
            cleanupAudio();
            setIsLiveMode(false);
          },
          onerror: (err) => {
            console.error("Live Error", err);
            setLiveError("Connexion instable.");
            cleanupAudio();
          }
        }
      });
      liveSessionRef.current = sessionPromise;

    } catch (e) {
      console.error("Start Error:", e);
      setLiveError("Erreur micro ou réseau.");
      cleanupAudio();
    }
  };

  const stopLiveAndClose = () => {
    cleanupAudio();
    setIsLiveMode(false);
  };

  // --- LOGIQUE CHAT STANDARD ---

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
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
      // Traitement des données extraites (poids, etc.) via le Tool Call dans chatWithAI aussi
      if (res.extractedInfo && Object.keys(res.extractedInfo).length > 0) {
        const updatedUser = { ...user, ...res.extractedInfo };
        if (res.extractedInfo.weight) updatedUser.weightHistory = [...(user.weightHistory || []), { date: new Date().toISOString(), weight: res.extractedInfo.weight }];
        onUpdateUser(updatedUser);
      }
      
      // Si concept proposé en texte
      if (res.suggestedConcept) {
         try {
             const plan = await generateMealPlan(res.suggestedConcept, user);
             setMealPlan(plan);
         } catch(e) { console.error(e); }
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.reply || "Reçu.",
        concept: res.suggestedConcept
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Erreur technique." }]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- RENDU ---

  if (isLiveMode) {
    return (
      <div className="absolute inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-6 animate-in zoom-in-95 duration-500">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-900/40 via-slate-900 to-slate-900"></div>
        </div>

        <div className="absolute top-6 left-0 right-0 flex justify-center">
           <div className={`px-4 py-2 rounded-full border flex items-center gap-2 transition-colors ${liveError ? 'bg-rose-500/20 border-rose-500/50' : 'bg-white/10 border-white/10'}`}>
              <span className={`w-2 h-2 rounded-full ${liveError ? 'bg-rose-500' : isLiveConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span className="text-white text-xs font-black uppercase tracking-widest">
                {liveError ? 'Erreur' : isLiveConnected ? 'En Ligne' : 'Connexion...'}
              </span>
           </div>
        </div>

        <div className="relative z-10 flex flex-col items-center gap-12">
           <div className="relative w-48 h-48 sm:w-64 sm:h-64 flex items-center justify-center">
              {!liveError && (
                <>
                  <div className="absolute inset-0 rounded-full border border-emerald-500/30 transition-transform duration-75 ease-linear" style={{ transform: `scale(${1 + volumeLevel/300})` }}></div>
                </>
              )}
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-tr from-emerald-400 to-teal-300 p-1 shadow-2xl shadow-emerald-500/40 relative overflow-hidden">
                 <div className="absolute inset-0 bg-white/10 animate-pulse"></div>
                 <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center overflow-hidden">
                    <span className="text-6xl sm:text-7xl">✨</span>
                 </div>
              </div>
           </div>

           <div className="text-center space-y-2 max-w-xs">
              {liveError ? (
                <p className="text-rose-400 font-bold text-sm bg-rose-900/50 p-3 rounded-xl border border-rose-500/30">{liveError}</p>
              ) : (
                <>
                  <p className="text-white font-black text-2xl sm:text-3xl tracking-tight">Crystal</p>
                  <p className="text-emerald-400/60 text-sm font-bold uppercase tracking-widest">IA Nutritionniste</p>
                </>
              )}
           </div>
        </div>

        <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-6">
           <button 
             onClick={stopLiveAndClose}
             className="w-16 h-16 sm:w-20 sm:h-20 bg-rose-500 hover:bg-rose-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-rose-900/50 transition-transform active:scale-95"
           >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
           </button>
        </div>
      </div>
    );
  }

  // MODE CHAT STANDARD (Optimisé Mobile)
  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden font-sans">
      {/* Background ultra-léger sans blur GPU coûteux */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-50 via-slate-50 to-slate-50 pointer-events-none z-0"></div>

      <div className="absolute top-0 left-0 right-0 z-20 px-6 py-4 flex items-center justify-between bg-white/95 border-b border-white/50 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-tr from-emerald-400 to-teal-400 rounded-full flex items-center justify-center text-lg text-white shadow-sm">✨</div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 tracking-tight">Coach Crystal</h2>
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">En ligne</p>
          </div>
        </div>
        <button onClick={() => setMessages([])} className="p-2 text-slate-400 hover:text-slate-600 transition-colors" title="Effacer">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pt-24 pb-32 px-4 sm:px-6 space-y-6 scroll-smooth z-10 custom-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center mt-20 text-center animate-in fade-in duration-700">
            <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center text-5xl mb-6 shadow-sm border border-slate-100">🎙️</div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">Bonjour {user.name.split(' ')[0]}</h3>
            <p className="text-sm text-slate-400 max-w-xs leading-relaxed mx-auto mb-8">Je suis Crystal. Je peux vous aider à planifier vos repas ou discuter nutrition.</p>
            <button onClick={startLiveSession} className="group relative inline-flex items-center gap-3 px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-500 transition-transform active:scale-95">
              <span>⚡</span> Discuter en Direct
            </button>
          </div>
        )}
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          return (
            <div key={i} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-300`}>
              <div className={`px-5 py-3.5 max-w-[85%] sm:max-w-[75%] text-[15px] leading-relaxed shadow-sm ${isUser ? 'bg-emerald-600 text-white rounded-[1.2rem] rounded-tr-sm' : 'bg-white text-slate-700 border border-slate-100 rounded-[1.2rem] rounded-tl-sm'}`}>
                {msg.content}
              </div>
            </div>
          );
        })}
        {isLoading && (<div className="flex justify-start"><div className="bg-white px-5 py-4 rounded-[1.5rem] rounded-tl-sm shadow-sm border border-slate-100 flex gap-1.5"><div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.1s]"></div><div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.2s]"></div></div></div>)}
        <div ref={messagesEndRef} className="h-4" /> 
      </div>

      <div className="absolute bottom-6 left-0 right-0 px-4 sm:px-6 z-30">
        <div className="max-w-4xl mx-auto flex gap-3">
            <form onSubmit={handleTextSubmit} className="flex-1 flex gap-2 items-center bg-white p-2 rounded-full shadow-lg shadow-slate-200/50 border border-slate-100">
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Écrivez à Crystal..." className="flex-1 bg-transparent border-none outline-none text-[15px] px-6 py-3 text-slate-700 placeholder:text-slate-400 font-medium" />
              <button type="submit" disabled={!input.trim() || isLoading} className="w-11 h-11 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center shadow-md shrink-0 transition-transform active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-0.5"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
              </button>
            </form>
            <button onClick={startLiveSession} className="w-16 h-16 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-transform" title="Lancer le Live">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            </button>
        </div>
      </div>
    </div>
  );
};

export default Assistant;
