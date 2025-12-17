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
const SESSION_STORAGE_KEY = 'xrpmusic_wallet_session';

export function XamanProvider({ children }: { children: ReactNode }) {
  const [xumm, setXumm] = useState<Xumm | null>(null);
  const [user, setUser] = useState<XamanUser | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Save session to localStorage
  const saveSession = useCallback((address: string) => {
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ 
        address, 
        timestamp: Date.now() 
      }));
    } catch (err) {
      console.error('Failed to save session:', err);
    }
  }, []);

  // Load session from localStorage
  const loadSavedSession = useCallback((): string | null => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const { address, timestamp } = JSON.parse(saved);
        // Session valid for 7 days
        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - timestamp < SEVEN_DAYS) {
          return address;
        } else {
          localStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    }
    return null;
  }, []);

  // Clear session from localStorage
  const clearSession = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (err) {
      console.error('Failed to clear session:', err);
    }
  }, []);

  // Check for existing session with SDK
  const checkSession = useCallback(async (sdk: Xumm): Promise<string | null> => {
    try {
      const account = await sdk.user.account;
      if (account) {
        return account;
      }
    } catch (err) {
      console.log('No existing SDK session');
    }
    return null;
  }, []);

  // Set user and save session
  const setUserWithSession = useCallback((address: string) => {
    setUser({ address });
    saveSession(address);
  }, [saveSession]);

  useEffect(() => {
    const sdk = new Xumm(XAMAN_API_KEY);
    setXumm(sdk);

    const init = async () => {
      // First, check localStorage for saved session (instant restore)
      const savedAddress = loadSavedSession();
      if (savedAddress) {
        setUser({ address: savedAddress });
      }

      // Check if returning from mobile redirect
      const urlParams = new URLSearchParams(window.location.search);
      const hasXummParams = urlParams.has('xumm') || window.location.hash.includes('xumm');
      
      if (hasXummParams) {
        setIsConnecting(true);
        // Clean up URL without reload
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }

      // Wait for SDK to be ready
      await sdk.environment.ready;
      
      // Verify session with SDK (might update from saved)
      const sdkAccount = await checkSession(sdk);
      
      if (sdkAccount) {
        // SDK has valid session, use it (and update localStorage)
        setUserWithSession(sdkAccount);
        setIsConnecting(false);
        setInitialized(true);
        return;
      }
      
      // If we had a saved session but SDK doesn't confirm, try to re-authorize silently
      if (savedAddress && !sdkAccount) {
        // Keep the saved session active - user is still "logged in" from our perspective
        // The SDK will re-auth when needed for signing
        console.log('Using cached session for:', savedAddress);
      }
      
      // Handle mobile redirect case
      if (hasXummParams && !sdkAccount) {
        let retries = 10;
        while (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const account = await checkSession(sdk);
          if (account) {
            setUserWithSession(account);
            break;
          }
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
          setUserWithSession(account);
        }
      } catch (err) {
        console.error('Error getting account after success:', err);
      }
      setIsConnecting(false);
    });

    sdk.on('logout', () => {
      setUser(null);
      clearSession();
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
  }, [checkSession, loadSavedSession, setUserWithSession, clearSession]);

  // Poll for session on mobile (backup for redirect issues)
  useEffect(() => {
    if (!xumm || !initialized) return;
    // If we already have a user, no need to poll
    if (user) return;

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
          setUserWithSession(account);
          clearInterval(pollInterval);
        }
      } catch (err) {
        // Still not logged in
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [xumm, initialized, user, setUserWithSession]);

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
    clearSession();
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
