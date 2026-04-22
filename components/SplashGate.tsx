'use client';

import { useEffect, useState } from 'react';
import SplashScreen from './SplashScreen';

const STORAGE_KEY = 'wf_splash_seen';

export default function SplashGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const seen = typeof window !== 'undefined' && sessionStorage.getItem(STORAGE_KEY) === '1';
    if (seen) {
      setReady(true);
    } else {
      setShow(true);
    }
  }, []);

  const handleComplete = () => {
    if (typeof window !== 'undefined') sessionStorage.setItem(STORAGE_KEY, '1');
    setShow(false);
    setReady(true);
  };

  return (
    <>
      {show && <SplashScreen onComplete={handleComplete} />}
      <div style={{ visibility: ready ? 'visible' : 'hidden' }}>{children}</div>
    </>
  );
}
