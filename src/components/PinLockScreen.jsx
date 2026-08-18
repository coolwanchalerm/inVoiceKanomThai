import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Delete, ShieldCheck, Sparkles, AlertCircle, KeyRound } from 'lucide-react';
import { useAuthPin } from '../context/AuthPinContext';

export default function PinLockScreen() {
  const { unlock } = useAuthPin();
  const [enteredPin, setEnteredPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const handleDigit = useCallback((digit) => {
    setErrorMsg('');
    setEnteredPin((prev) => {
      if (prev.length < 6) {
        return prev + digit;
      }
      return prev;
    });
  }, []);

  const handleBackspace = useCallback(() => {
    setErrorMsg('');
    setEnteredPin((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setErrorMsg('');
    setEnteredPin('');
  }, []);

  // When enteredPin reaches 6 digits, verify automatically
  useEffect(() => {
    let isMounted = true;

    async function verifyPin() {
      if (enteredPin.length === 6) {
        const result = await unlock(enteredPin);
        if (!result.success && isMounted) {
          setIsShaking(true);
          setErrorMsg(result.message || 'รหัส PIN ไม่ถูกต้อง');
          if (navigator.vibrate) {
            try {
              navigator.vibrate([100, 50, 100]);
            } catch (e) {
              // ignore
            }
          }
          setTimeout(() => {
            if (isMounted) {
              setIsShaking(false);
              setEnteredPin('');
            }
          }, 600);
        }
      }
    }

    verifyPin();
    return () => { isMounted = false; };
  }, [enteredPin, unlock]);

  // Physical Keyboard Support
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape' || e.key === 'Delete') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDigit, handleBackspace, handleClear]);

  const keypadNumbers = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['clear', '0', 'backspace']
  ];

  return (
    <div className="pin-lock-overlay">
      <div className={`pin-lock-card ${isShaking ? 'shake-animation' : ''}`}>
        
        {/* Brand Header */}
        <div className="pin-lock-header">
          <div className="pin-brand-avatar-container">
            {!logoError ? (
              <img 
                src="/logo.jpg" 
                alt="Logo" 
                className="pin-brand-logo-img"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="pin-lock-icon-fallback">
                <Lock size={30} style={{ color: 'var(--accent-color)' }} />
              </div>
            )}
            <div className="pin-brand-badge">
              <Sparkles size={11} style={{ color: '#ffffff' }} />
            </div>
          </div>

          <h1 className="pin-lock-title">ขนมไทยแทนคุณ</h1>
          <p className="pin-lock-subtitle">กรุณากรอกรหัส PIN 6 หลักเพื่อเข้าใช้งาน</p>
        </div>

        {/* 6 Dots Indicator */}
        <div className="pin-dots-container">
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const isFilled = index < enteredPin.length;
            return (
              <div
                key={index}
                className={`pin-dot ${isFilled ? 'filled' : ''}`}
              />
            );
          })}
        </div>

        {/* Error / Hint Message */}
        <div className="pin-error-container">
          {errorMsg ? (
            <div className="pin-error-badge">
              <AlertCircle size={15} />
              <span>{errorMsg}</span>
            </div>
          ) : (
            <div className="pin-hint-text">
              <span>พิมพ์ตัวเลขบนแป้นพิมพ์หรือกดปุ่มด้านล่าง</span>
            </div>
          )}
        </div>

        {/* Numeric Keypad */}
        <div className="pin-keypad-grid">
          {keypadNumbers.map((row, rIdx) => (
            <div key={rIdx} className="pin-keypad-row">
              {row.map((btn) => {
                if (btn === 'clear') {
                  return (
                    <button
                      key={btn}
                      type="button"
                      className="pin-key-btn text-btn"
                      onClick={handleClear}
                      disabled={enteredPin.length === 0}
                      title="ล้างทั้งหมด"
                    >
                      ล้าง
                    </button>
                  );
                }
                if (btn === 'backspace') {
                  return (
                    <button
                      key={btn}
                      type="button"
                      className="pin-key-btn icon-btn"
                      onClick={handleBackspace}
                      disabled={enteredPin.length === 0}
                      title="ลบตัวเลข"
                    >
                      <Delete size={22} />
                    </button>
                  );
                }
                return (
                  <button
                    key={btn}
                    type="button"
                    className="pin-key-btn number-btn"
                    onClick={() => handleDigit(btn)}
                    disabled={enteredPin.length >= 6}
                  >
                    <span className="pin-num">{btn}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
