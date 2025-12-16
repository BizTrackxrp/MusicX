'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Xumm } from 'xumm';

interface XamanUser {
  address: string;
  name?: string;
  picture?: string;
}

interface XamanContextType {
  user: XamanUser | null;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const XamanContext = createContext<XamanContextType | null>(null);

const XAMAN_API_KEY = '619aefc9-660a-4120-9e22-e8afd2980c8c';

export function XamanProvider({ children }: { children: ReactNode }) {
  const [xumm, setXumm] = useState<Xumm | null>(null);
  const [user, setUser] = useState<XamanUser | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Check for existing session
  const checkSession = useCallback(async (sdk: Xumm) => {
    try {
      const account = await sdk.user.account;
      if (account) {
        setUser({ address: account });
        return true;
      }
    } catch (err) {
      // Not logged in, that's fine
      console.log('No existing session');
    }
    return false;
  }, []);

  useEffect(() => {
    const sdk = new Xumm(XAMAN_API_KEY);
    setXumm(sdk);

    // Initialize and check for existing session
    const init = async () => {
      // Check if returning from mobile redirect
      const urlParams = new URLSearchParams(window.location.search);
      const hasXummParams = urlParams.has('xumm') || window.location.hash.includes('xumm');
      
      if (hasXummParams) {
        setIsConnecting(true);
      }

      // Wait for SDK to be ready
      await sdk.environment.ready;
      
      // Check for existing session
      const hasSession = await checkSession(sdk);
      
      if (!hasSession && hasXummParams) {
        // Retry a few times for mobile redirect
        let retries = 5;
        while (retries > 0 && !hasSession) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const found = await checkSession(sdk);
          if (found) break;
          retries--;
        }
      }
      
      setIsConnecting(false);
      setInitialized(true);
    };

    init();

    // Listen for login events
    sdk.on('success', async () => {
      try {
        const account = await sdk.user.account;
        if (account) {
          setUser({ address: account });
        }
      } catch (err) {
        console.error('Error getting account after success:', err);
      }
      setIsConnecting(false);
    });

    sdk.on('logout', () => {
      setUser(null);
    });

    sdk.on('error', (err) => {
      console.error('Xumm error:', err);
      setError('Connection failed');
      setIsConnecting(false);
    });

    return () => {
      sdk.off('success', () => {});
      sdk.off('logout', () => {});
      sdk.off('error', () => {});
    };
  }, [checkSession]);

  // Poll for session on mobile (backup for redirect issues)
  useEffect(() => {
    if (!xumm || !initialized || user) return;

    // Check if on mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) return;

    // Poll for session every 2 seconds for 30 seconds after page load
    let attempts = 0;
    const maxAttempts = 15;
    
    const pollInterval = setInterval(async () => {
      attempts++;
      if (attempts >= maxAttempts || user) {
        clearInterval(pollInterval);
        return;
      }
      
      try {
        const account = await xumm.user.account;
        if (account) {
          setUser({ address: account });
          clearInterval(pollInterval);
        }
      } catch (err) {
        // Still not logged in
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [xumm, initialized, user]);

  const connect = async () => {
    if (!xumm) return;
    
    setIsConnecting(true);
    setError(null);
    
    try {
      await xumm.authorize();
      
      // For desktop, the success event will fire
      // For mobile, we need to wait for redirect back
      
    } catch (err) {
      setError('Failed to connect wallet');
      console.error(err);
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    if (xumm) {
      xumm.logout();
    }
    setUser(null);
  };

  return (
    <XamanContext.Provider value={{ user, isConnecting, error, connect, disconnect }}>
      {children}
    </XamanContext.Provider>
  );
}

export function useXaman() {
  const context = useContext(XamanContext);
  if (!context) {
    throw new Error('useXaman must be used within XamanProvider');
  }
  return context;
}
