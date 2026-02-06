import React, { useState, useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';

export default function DebugPanel({ logs, onForceLogin }) {
  const [isOpen, setIsOpen] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, isOpen]);

  return (
    <div
      className={`fixed bottom-0 right-0 z-[200] bg-slate-900 text-green-400 font-mono text-xs transition-all duration-300 shadow-2xl border-t border-l border-green-900 ${
        isOpen ? 'w-96 h-64' : 'w-32 h-10'
      }`}
    >
      <div
        className="flex justify-between items-center p-2 bg-slate-800 cursor-pointer border-b border-green-900 hover:bg-slate-700"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4" /> Debug
        </div>
        <div>{isOpen ? '▼' : '▲'}</div>
      </div>
      {isOpen && (
        <div className="p-2 h-52 overflow-y-auto flex flex-col">
          {logs.map((log, i) => (
            <div key={i} className="mb-1 border-b border-slate-800 pb-1 break-words">
              <span className="text-slate-500">[{log.time}]</span>{' '}
              <span className={log.type === 'error' ? 'text-red-400' : 'text-green-300'}>
                {log.msg}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onForceLogin();
            }}
            className="mt-4 bg-red-900 text-white p-2 rounded hover:bg-red-700 font-bold text-center uppercase"
          >
            FORCE ADMIN LOGIN
          </button>
        </div>
      )}
    </div>
  );
}
