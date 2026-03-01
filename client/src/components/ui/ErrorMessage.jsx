import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function ErrorMessage({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(217,47,43,0.08)' }}>
        <AlertTriangle size={28} style={{ color: '#d92f2b' }} />
      </div>
      <p style={{ color: '#999', fontSize: 14 }}>{message || 'Something went wrong'}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{ marginTop: 14, padding: '10px 24px', background: '#1B2A72', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          Try Again
        </button>
      )}
    </div>
  );
}
