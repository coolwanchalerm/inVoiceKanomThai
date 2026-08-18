import React, { useState } from 'react';
import { KeyRound, X, Check, AlertCircle, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuthPin } from '../context/AuthPinContext';

export default function ChangePinModal({ isOpen, onClose }) {
  const { changePin } = useAuthPin();
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setOldPin('');
    setNewPin('');
    setConfirmPin('');
    setErrorMsg('');
    setSuccessMsg('');
    setShowPin(false);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (oldPin.length !== 6) {
      setErrorMsg('กรุณากรอกรหัส PIN เดิมให้ครบ 6 หลัก');
      return;
    }
    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      setErrorMsg('รหัส PIN ใหม่ต้องเป็นตัวเลข 6 หลัก');
      return;
    }
    if (newPin !== confirmPin) {
      setErrorMsg('รหัส PIN ใหม่และการยืนยันไม่ตรงกัน');
      return;
    }

    setIsSubmitting(true);
    const result = await changePin(oldPin, newPin);
    setIsSubmitting(false);

    if (result.success) {
      setSuccessMsg(result.message);
      setTimeout(() => {
        handleClose();
      }, 1500);
    } else {
      setErrorMsg(result.message);
    }
  };

  const isFormValid = oldPin.length === 6 && newPin.length === 6 && confirmPin.length === 6 && newPin === confirmPin;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div 
        className="modal-content change-pin-modal-card" 
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
          borderRadius: '24px',
          overflow: 'hidden'
        }}
      >
        
        {/* Header */}
        <div className="change-pin-header">
          <div className="change-pin-header-content">
            <div className="change-pin-header-icon">
              <KeyRound size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, letterSpacing: '0.2px' }}>
                เปลี่ยนรหัสผ่าน PIN
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>
                กำหนดรหัสตัวเลข 6 หลักสำหรับเข้าใช้งาน
              </p>
            </div>
          </div>
          <button 
            type="button" 
            className="change-pin-close-btn" 
            onClick={handleClose}
            title="ปิดหน้าต่าง"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="change-pin-body">
          
          {/* Error Alert */}
          {errorMsg && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              marginBottom: '1.25rem',
              fontSize: '0.875rem',
              fontWeight: 500
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Alert */}
          {successMsg && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#047857',
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              marginBottom: '1.25rem',
              fontSize: '0.875rem',
              fontWeight: 600
            }}>
              <Check size={18} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Field 1: Old PIN */}
          <div className="pin-field-group">
            <div className="pin-field-label">
              <span>รหัส PIN เดิม (6 หลัก)</span>
              <span style={{ fontSize: '0.75rem', color: oldPin.length === 6 ? '#10b981' : '#94a3b8', fontWeight: 500 }}>
                {oldPin.length}/6
              </span>
            </div>
            <div className="pin-field-input-wrapper">
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={oldPin}
                onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="pin-field-input"
                autoFocus
                required
              />
            </div>
          </div>

          {/* Field 2: New PIN */}
          <div className="pin-field-group">
            <div className="pin-field-label">
              <span>รหัส PIN ใหม่ (6 หลัก)</span>
              <span style={{ fontSize: '0.75rem', color: newPin.length === 6 ? '#10b981' : '#94a3b8', fontWeight: 500 }}>
                {newPin.length}/6
              </span>
            </div>
            <div className="pin-field-input-wrapper">
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="pin-field-input"
                required
              />
            </div>
          </div>

          {/* Field 3: Confirm New PIN */}
          <div className="pin-field-group" style={{ marginBottom: '1.5rem' }}>
            <div className="pin-field-label">
              <span>ยืนยันรหัส PIN ใหม่</span>
              {newPin && confirmPin && (
                <span style={{ 
                  fontSize: '0.75rem', 
                  color: newPin === confirmPin ? '#10b981' : '#ef4444', 
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}>
                  {newPin === confirmPin ? (
                    <>
                      <Check size={13} />
                      <span>ตรงกัน</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={13} />
                      <span>ไม่ตรงกัน</span>
                    </>
                  )}
                </span>
              )}
            </div>
            <div className="pin-field-input-wrapper">
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="pin-field-input"
                required
              />
              <button
                type="button"
                className="pin-toggle-visibility-btn"
                onClick={() => setShowPin(!showPin)}
                title={showPin ? 'ซ่อนตัวเลข' : 'แสดงตัวเลข'}
              >
                {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClose}
              disabled={isSubmitting}
              style={{
                padding: '0.65rem 1.25rem',
                borderRadius: '12px',
                fontSize: '0.9rem',
                fontWeight: 500
              }}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !isFormValid}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.5rem',
                borderRadius: '12px',
                fontSize: '0.9rem',
                fontWeight: 600,
                backgroundColor: isFormValid ? 'var(--primary-color)' : '#94a3b8',
                cursor: isFormValid ? 'pointer' : 'not-allowed'
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  <span>บันทึกรหัสใหม่</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
