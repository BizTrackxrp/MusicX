'use client';

import { X, Music, Wallet } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { useXaman } from '@/lib/xaman-context';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: { wallet: { type: 'xumm'; address: string } }) => void;
}

export default function AuthModal({ isOpen, onClose, onLogin }: AuthModalProps) {
  const { theme } = useTheme();
  const { connect, isConnecting, user } = useXaman();

  if (!isOpen) return null;

  const handleXamanConnect = async () => {
    await connect();
  };

  // If user just connected, trigger onLogin and close
  if (user && isOpen) {
    onLogin({
      wallet: {
        type: 'xumm',
        address: user.address
      }
    });
    onClose();
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden animate-slide-up ${
        theme === 'dark' 
          ? 'bg-gradient-to-br from-zinc-900 to-zinc-950 border-zinc-800' 
          : 'bg-white border-zinc-200'
      }`}>
        <div className={`absolute inset-0 pointer-events-none ${theme === 'dark' ? 'bg-gradient-to-br from-blue-500/5 to-transparent' : ''}`} />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="relative p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
              <Music size={20} className="text-white" />
            </div>
            <span className={`text-2xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
              XRP Music
            </span>
          </div>

          {/* Title */}
          <h2 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
            Connect Your Wallet
          </h2>
          <p className={`mb-6 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
            Sign in with your Xaman wallet to mint, buy, and collect music NFTs on the XRP Ledger.
          </p>

          {/* Xaman Connect Button */}
          <button
            onClick={handleXamanConnect}
            disabled={isConnecting}
            className={`w-full p-4 border rounded-xl flex items-center gap-4 transition-all disabled:opacity-50 ${
              theme === 'dark'
                ? 'bg-zinc-800/50 hover:bg-zinc-800 border-zinc-700 hover:border-zinc-600'
                : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <img 
              src="/Xaman-logo.png" 
              alt="Xaman" 
              className="w-12 h-12 rounded-xl"
            />
            <div className="text-left flex-1">
              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                Xaman Wallet
              </p>
              <p className="text-zinc-500 text-sm">
                {isConnecting ? 'Opening Xaman...' : 'Scan QR or open on mobile'}
              </p>
            </div>
            {isConnecting && (
              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            )}
          </button>

          {/* Info */}
          <div className={`mt-6 p-4 rounded-xl ${theme === 'dark' ? 'bg-zinc-800/30' : 'bg-zinc-50'}`}>
            <div className="flex items-start gap-3">
              <Wallet size={20} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                  Don&apos;t have Xaman?
                </p>
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  Download the Xaman app for{' '}
                  <a 
                    href="https://apps.apple.com/app/xumm/id1492302343" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    iOS
                  </a>
                  {' '}or{' '}
                  <a 
                    href="https://play.google.com/store/apps/details?id=com.xrpllabs.xumm" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    Android
                  </a>
                  {' '}to get started.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
