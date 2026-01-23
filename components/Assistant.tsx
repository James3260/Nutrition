
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
    } catch (e) { console.error(e); }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (e) { alert("Accès micro refusé"); }
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
    // Affichage optimiste
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: isAudio ? "🎤 Message Vocal" : (inputData as string),
      isAudioMessage: isAudio 
    }]);

    try {
      const res = await chatWithAI(inputData, user, messages);

      // Mise à jour des données utilisateur via les Tools
      if (res.extractedInfo && Object.keys(res.extractedInfo).length > 0) {
        const newContext = { ...lastExtractedContext, ...res.extractedInfo };
        setLastExtractedContext(newContext);
        
        const updatedUser = { ...user };
        // Mapping intelligent des champs
        if (res.extractedInfo.weight) {
          updatedUser.weightHistory = [...(user.weightHistory || []), { date: new Date().toISOString(), weight: res.extractedInfo.weight }];
        }
        if (res.extractedInfo.height) updatedUser.height = res.extractedInfo.height;
        if (res.extractedInfo.age) updatedUser.age = res.extractedInfo.age;
        if (res.extractedInfo.gender) updatedUser.gender = res.extractedInfo.gender;
        if (res.extractedInfo.exclusions) updatedUser.exclusions = res.extractedInfo.exclusions;
        onUpdateUser(updatedUser);
      }

      // TTS pour réponses courtes ou audio
      let audioResponse = null;
      if (res.reply && (isAudio || res.reply.length < 150)) {
        audioResponse = await generateSpeech(res.reply);
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.reply || "Je n'ai pas de réponse textuelle, mais j'ai pris en compte vos données.",
        concept: res.suggestedConcept,
        audioBase64: audioResponse || undefined
      }]);

      if (audioResponse) playAudio(audioResponse);

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: "Désolé, une erreur est survenue avec le cerveau de l'IA." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalGeneration = async () => {
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'assistant', content: "Je génère votre plan de 30 jours..." }]);
    try {
      const fullPlan = await generateMealPlan(lastExtractedContext, user);
      setMealPlan(fullPlan);
      setMessages(prev => [...prev, { role: 'assistant', content: "C'est fait ! Votre agenda est rempli." }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Erreur lors de la création du plan." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f2f4f7] relative">
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-full flex items-center justify-center text-white text-base shadow-md">✨</div>
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 leading-tight">Coach Crystal</h2>
            <p className="text-[10px] sm:text-xs text-emerald-600 font-medium">Assistant Premium</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth overscroll-contain bg-[#f2f4f7]">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[60%] opacity-50 text-center px-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mb-4">💬</div>
            <p className="text-sm font-bold text-slate-500">Bonjour !</p>
            <p className="text-xs text-slate-400 mt-1">Je suis là pour créer votre programme.</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          const isError = !isUser && msg.content.includes("Erreur");
          return (
            <div key={i} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-300`}>
              <div className={`max-w-[85%] sm:max-w-[75%] px-4 py-3 text-[15px] leading-relaxed shadow-sm relative ${
                isUser ? 'bg-emerald-600 text-white rounded-[1.2rem] rounded-tr-sm' : isError ? 'bg-rose-50 text-rose-600 border border-rose-100 rounded-xl' : 'bg-white text-slate-800 rounded-[1.2rem] rounded-tl-sm border border-slate-100'
              }`}>
                {msg.isAudioMessage ? <div className="flex items-center gap-2"><span className="animate-pulse">🎤</span> Audio</div> : msg.content}
                {!isUser && msg.audioBase64 && (
                  <button onClick={() => playAudio(msg.audioBase64!)} className="mt-2 flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-bold w-full sm:w-auto"><span>🔊</span> Écouter</button>
                )}
              </div>
            </div>
          );
        })}

        {messages.map((msg, i) => msg.concept && (
          <div key={`concept-${i}`} className="flex justify-start w-full">
            <div className="bg-white rounded-2xl p-4 shadow-lg border border-emerald-100 max-w-sm w-full">
              <h5 className="font-black text-emerald-700 text-sm mb-1">{msg.concept.title}</h5>
              <p className="text-xs text-slate-600 mb-4">{msg.concept.description}</p>
              <button onClick={handleFinalGeneration} disabled={isLoading} className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase">Générer le Plan</button>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
             <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex gap-2 items-center border border-slate-100">
               <div className="flex gap-1">
                 <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"></div>
                 <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.15s]"></div>
                 <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.3s]"></div>
               </div>
               <span className="text-xs text-slate-400 font-medium">Crystal réfléchit...</span>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-4" /> 
      </div>

      <div className="bg-white border-t border-slate-200 px-4 py-3 shrink-0 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-4 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] z-30">
        {isRecording ? (
          <div className="flex items-center justify-between w-full max-w-4xl mx-auto bg-rose-50 rounded-[1.5rem] px-2 py-1 border border-rose-100 animate-pulse">
            <div className="flex items-center gap-3 px-4 py-2"><div className="w-3 h-3 bg-rose-500 rounded-full animate-ping"></div><span className="text-rose-600 font-black text-xs uppercase">Enregistrement...</span></div>
            <button onClick={stopRecording} className="w-11 h-11 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg">■</button>
          </div>
        ) : (
          <form onSubmit={handleTextSubmit} className="flex gap-2 max-w-4xl mx-auto items-end">
            <div className="flex-1 bg-slate-100 rounded-[1.5rem] px-5 py-1 flex items-center border-2 border-transparent focus-within:border-emerald-500/30 transition-all">
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Message..." className="w-full bg-transparent border-none outline-none text-[15px] py-3 text-slate-800 placeholder:text-slate-400 font-medium" />
            </div>
            {input.trim() ? (
              <button type="submit" disabled={isLoading} className="w-12 h-12 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center shadow-md shrink-0">➤</button>
            ) : (
              <button type="button" onClick={startRecording} disabled={isLoading} className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-600 flex items-center justify-center shadow-sm shrink-0">🎙️</button>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export default Assistant;
