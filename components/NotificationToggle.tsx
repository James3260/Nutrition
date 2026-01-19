
import React, { useState, useEffect } from 'react';
import { NotificationService } from '../services/NotificationService';

const NotificationToggle: React.FC = () => {
  const [status, setStatus] = useState<NotificationPermission | 'unsupported'>(
    !("Notification" in window) ? 'unsupported' : Notification.permission
  );

  const handleToggle = async () => {
    if (status === 'unsupported') return;
    
    const granted = await NotificationService.requestPermission();
    setStatus(Notification.permission);
  };

  if (status === 'unsupported') return null;

  return (
    <button 
      onClick={handleToggle}
      className={`p-2 rounded-lg transition-all ${
        status === 'granted' 
          ? 'text-emerald-500 bg-emerald-50' 
          : 'text-slate-400 hover:bg-slate-100'
      }`}
      title={status === 'granted' ? "Notifications activées" : "Activer les rappels de repas"}
    >
      {status === 'granted' ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
      )}
    </button>
  );
};

export default NotificationToggle;
