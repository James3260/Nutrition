
import React from 'react';
import { HistoryEvent } from '../types';

interface HistoryLogProps {
  events: HistoryEvent[];
  limit?: number;
  title?: string;
  showIcon?: boolean;
}

const HistoryLog: React.FC<HistoryLogProps> = ({ events, limit, title = "Journal d'activité", showIcon = true }) => {
  const displayEvents = limit ? events.slice(0, limit) : events;

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'system': return { bg: 'bg-slate-100', text: 'text-slate-500', icon: '⚙️' };
      case 'meal': return { bg: 'bg-emerald-100', text: 'text-emerald-600', icon: '🥗' };
      case 'profile': return { bg: 'bg-blue-100', text: 'text-blue-600', icon: '👤' };
      case 'sport': return { bg: 'bg-amber-100', text: 'text-amber-600', icon: '🏃' };
      case 'admin': return { bg: 'bg-rose-100', text: 'text-rose-600', icon: '🛡️' };
      default: return { bg: 'bg-slate-100', text: 'text-slate-500', icon: '📝' };
    }
  };

  if (events.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
        <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Aucun événement enregistré</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-50 flex items-center justify-between">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
          {showIcon && <span>📋</span>} {title}
        </h3>
        {limit && events.length > limit && (
          <span className="text-[9px] font-black bg-slate-100 text-slate-400 px-2 py-1 rounded-full">
            DERNIÈRES ACTIONS
          </span>
        )}
      </div>
      <div className="divide-y divide-slate-50">
        {displayEvents.map((event) => {
          const style = getTypeStyle(event.type);
          const date = new Date(event.timestamp);
          return (
            <div key={event.id} className="p-4 flex items-start gap-4 hover:bg-slate-50/50 transition-colors">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 ${style.bg}`}>
                {style.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <p className="text-[11px] font-black text-slate-800 leading-tight">
                    {event.userName} <span className="text-slate-400 font-bold">•</span> {event.action}
                  </p>
                  <span className="text-[8px] font-black text-slate-300 uppercase whitespace-nowrap ml-2">
                    {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">{event.details}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HistoryLog;
