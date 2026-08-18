import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { hashPin } from '../utils/security';

const AuthPinContext = createContext(null);

// Default SHA-256 hash for PIN '147090'
const DEFAULT_PIN_HASH = '9d1f226465ad3fb7c9db5b88505c7ad73a9b74ffca737048b3ed3da2a7bf6711';
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const STORAGE_KEY_UNLOCKED = 'kanom_app_unlocked';
const STORAGE_KEY_LAST_ACTIVE = 'kanom_app_last_active';

export function AuthPinProvider({ children }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [currentPinHash, setCurrentPinHash] = useState(DEFAULT_PIN_HASH);
  const [isLoadingPin, setIsLoadingPin] = useState(true);
  const lastActiveRef = useRef(Date.now());

  // Fetch current PIN Hash from Supabase
  const fetchPinFromSupabase = useCallback(async () => {
    try {
      // 1. Try fetching app_pin_hash
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['app_pin_hash', 'app_pin']);

      if (error) {
        console.warn('System settings pin fetch note:', error.message);
      } else if (data && data.length > 0) {
        const hashRow = data.find(r => r.key === 'app_pin_hash');
        const legacyRow = data.find(r => r.key === 'app_pin');

        if (hashRow && hashRow.value) {
          const fetchedHash = typeof hashRow.value === 'string' ? hashRow.value.replace(/"/g, '') : String(hashRow.value);
          if (fetchedHash && fetchedHash.length === 64) {
            setCurrentPinHash(fetchedHash);
          }
        } else if (legacyRow && legacyRow.value) {
          // Automatic migration from plain text PIN to secure Hash
          const plainPin = typeof legacyRow.value === 'string' ? legacyRow.value.replace(/"/g, '') : String(legacyRow.value);
          if (plainPin && plainPin.length === 6) {
            const computedHash = await hashPin(plainPin);
            setCurrentPinHash(computedHash);
            // Save hash and remove plain text
            await supabase.from('system_settings').upsert({
              key: 'app_pin_hash',
              value: JSON.stringify(computedHash),
              updated_at: new Date().toISOString()
            });
            await supabase.from('system_settings').delete().eq('key', 'app_pin');
          }
        }
      }
    } catch (err) {
      console.error('Error fetching PIN hash from Supabase:', err);
    } finally {
      setIsLoadingPin(false);
    }
  }, []);

  // Check existing session on mount
  useEffect(() => {
    fetchPinFromSupabase();

    const wasUnlocked = sessionStorage.getItem(STORAGE_KEY_UNLOCKED) === 'true';
    const lastActiveStr = sessionStorage.getItem(STORAGE_KEY_LAST_ACTIVE);
    const lastActiveTime = lastActiveStr ? parseInt(lastActiveStr, 10) : 0;
    const now = Date.now();

    if (wasUnlocked && lastActiveTime > 0 && now - lastActiveTime < INACTIVITY_TIMEOUT_MS) {
      setIsUnlocked(true);
      lastActiveRef.current = now;
      sessionStorage.setItem(STORAGE_KEY_LAST_ACTIVE, now.toString());
    } else {
      // Session expired or not logged in
      sessionStorage.removeItem(STORAGE_KEY_UNLOCKED);
      sessionStorage.removeItem(STORAGE_KEY_LAST_ACTIVE);
      setIsUnlocked(false);
    }
  }, [fetchPinFromSupabase]);

  // Lock function
  const lock = useCallback(() => {
    setIsUnlocked(false);
    sessionStorage.removeItem(STORAGE_KEY_UNLOCKED);
    sessionStorage.removeItem(STORAGE_KEY_LAST_ACTIVE);
  }, []);

  // Unlock function with SHA-256 Hash Comparison
  const unlock = useCallback(async (enteredPin) => {
    try {
      const enteredHash = await hashPin(enteredPin);
      if (enteredHash === currentPinHash) {
        setIsUnlocked(true);
        const now = Date.now();
        lastActiveRef.current = now;
        sessionStorage.setItem(STORAGE_KEY_UNLOCKED, 'true');
        sessionStorage.setItem(STORAGE_KEY_LAST_ACTIVE, now.toString());
        return { success: true };
      }
      return { success: false, message: 'รหัส PIN ไม่ถูกต้อง' };
    } catch (e) {
      console.error('Unlock error:', e);
      return { success: false, message: 'เกิดข้อผิดพลาดในการตรวจสอบรหัส' };
    }
  }, [currentPinHash]);

  // Change PIN function (Saves only SHA-256 Hash)
  const changePin = useCallback(async (oldPin, newPin) => {
    try {
      const oldHash = await hashPin(oldPin);
      if (oldHash !== currentPinHash) {
        return { success: false, message: 'รหัส PIN เดิมไม่ถูกต้อง' };
      }
      if (!newPin || newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
        return { success: false, message: 'รหัส PIN ใหม่ต้องเป็นตัวเลข 6 หลัก' };
      }

      const newHash = await hashPin(newPin);

      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'app_pin_hash',
          value: JSON.stringify(newHash),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Supabase update PIN error:', error);
        throw error;
      }

      // Also clean up any legacy plain text key if exists
      await supabase.from('system_settings').delete().eq('key', 'app_pin');

      setCurrentPinHash(newHash);
      return { success: true, message: 'เปลี่ยนรหัส PIN สำเร็จแล้ว' };
    } catch (err) {
      return { success: false, message: 'เกิดข้อผิดพลาดในการบันทึกรหัส PIN: ' + err.message };
    }
  }, [currentPinHash]);

  // Update activity timestamp
  const recordActivity = useCallback(() => {
    if (!isUnlocked) return;
    const now = Date.now();
    // Throttle updating sessionStorage to once every 10 seconds
    if (now - lastActiveRef.current > 10000) {
      lastActiveRef.current = now;
      sessionStorage.setItem(STORAGE_KEY_LAST_ACTIVE, now.toString());
    } else {
      lastActiveRef.current = now;
    }
  }, [isUnlocked]);

  // Inactivity and visibility listeners
  useEffect(() => {
    if (!isUnlocked) return;

    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    const handleEvent = () => recordActivity();

    events.forEach(ev => window.addEventListener(ev, handleEvent, { passive: true }));

    // Periodic check every 15 seconds for timeout
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastActiveRef.current >= INACTIVITY_TIMEOUT_MS) {
        lock();
      }
    }, 15000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        const lastActiveStr = sessionStorage.getItem(STORAGE_KEY_LAST_ACTIVE);
        const lastActiveTime = lastActiveStr ? parseInt(lastActiveStr, 10) : lastActiveRef.current;
        if (now - lastActiveTime >= INACTIVITY_TIMEOUT_MS) {
          lock();
        } else {
          recordActivity();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      events.forEach(ev => window.removeEventListener(ev, handleEvent));
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isUnlocked, lock, recordActivity]);

  return (
    <AuthPinContext.Provider value={{
      isUnlocked,
      isLoadingPin,
      unlock,
      lock,
      changePin,
      refreshPin: fetchPinFromSupabase
    }}>
      {children}
    </AuthPinContext.Provider>
  );
}

export function useAuthPin() {
  const context = useContext(AuthPinContext);
  if (!context) {
    throw new Error('useAuthPin must be used within an AuthPinProvider');
  }
  return context;
}
