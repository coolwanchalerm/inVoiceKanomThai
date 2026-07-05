import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingOverlay({ isVisible, message = 'กำลังโหลด...' }) {
  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(3px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999, animation: 'fadeIn 0.2s ease-out'
    }}>
      <Loader2 className="animate-spin" size={48} style={{ color: 'var(--primary-color)', marginBottom: '1rem' }} />
      <h3 style={{ fontFamily: 'var(--font-thai)', color: 'var(--primary-color)', margin: 0 }}>{message}</h3>
    </div>
  );
}
