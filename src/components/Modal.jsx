import React from 'react';
import { AlertCircle, CheckCircle, Info, Trash2 } from 'lucide-react';

export default function Modal({ isOpen, title, message, type = 'info', onConfirm, onCancel, confirmText = 'ตกลง', cancelText = 'ยกเลิก' }) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle size={32} style={{ color: 'var(--success)', marginBottom: '1rem' }} />;
      case 'error': return <AlertCircle size={32} style={{ color: 'var(--danger)', marginBottom: '1rem' }} />;
      case 'warning': return <AlertCircle size={32} style={{ color: '#f59e0b', marginBottom: '1rem' }} />;
      case 'delete': return <Trash2 size={32} style={{ color: 'var(--danger)', marginBottom: '1rem' }} />;
      default: return <Info size={32} style={{ color: 'var(--primary-color)', marginBottom: '1rem' }} />;
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '2rem',
        maxWidth: '400px', width: '90%', textAlign: 'center',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)', animation: 'slideUp 0.3s ease-out'
      }}>
        {getIcon()}
        <h3 style={{ margin: '0 0 0.5rem 0', fontFamily: 'var(--font-thai)', fontSize: '1.25rem', color: '#111' }}>{title}</h3>
        <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5 }}>{message}</p>
        
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          {onCancel && (
            <button className="btn btn-outline" onClick={onCancel} style={{ flex: 1 }}>
              {cancelText}
            </button>
          )}
          <button 
            className="btn btn-primary" 
            onClick={onConfirm} 
            style={{ 
              flex: 1, 
              backgroundColor: (type === 'error' || type === 'delete') ? 'var(--danger)' : 'var(--primary-color)' 
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
