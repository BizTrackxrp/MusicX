'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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

  useEffect(() => {
    const sdk = new Xumm(XAMAN_API_KEY);
    setXumm(sdk);

    // Check if already authorized
    sdk.user.account.then((account) => {
      if (account) {
        setUser({ address: account });
      }
    }).catch(() => {
      // Not logged in, that's fine
    });

    // Listen for login events
    sdk.on('success', async () => {
      const account = await sdk.user.account;
      if (account) {
        setUser({ address: account });
      }
    });

    sdk.on('logout', () => {
      setUser(null);
    });

    return () => {
      sdk.off('success', () => {});
      sdk.off('logout', () => {});
    };
  }, []);

  const connect = async () => {
    if (!xumm) return;
    
    setIsConnecting(true);
    setError(null);
    
    try {
      await xumm.authorize();
    } catch (err) {
      setError('Failed to connect wallet');
      console.error(err);
    } finally {
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
