'use client';

import { useState } from 'react';
import { X, Wallet, Mail, Lock, Eye, EyeOff, Music } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: { email?: string; wallet?: { type: 'xumm' | 'bifrost'; address: string } }) => void;
}

export default function AuthModal({ isOpen, onClose, onLogin }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset' | 'wallet'>('wallet');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [connecting, setConnecting] = useState(false);

  if (!isOpen) return null;

  const handleWalletConnect = (walletType: 'xumm' | 'bifrost') => {
    setConnecting(true);
    // Simulate wallet connection
    setTimeout(() => {
      setConnecting(false);
      onLogin({
        wallet: {
          type: walletType,
          address: 'r' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
        }
      });
      onClose();
    }, 1500);
  };

  const handleEmailLogin = () => {
    onLogin({ email });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden animate-slide-up">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="relative p-8">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
              <Music size={20} className="text-black" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">Music X</span>
          </div>

          {mode === 'wallet' ? (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white mb-6">Connect Wallet</h2>

              <button
                onClick={() => handleWalletConnect('xumm')}
                disabled={connecting}
                className="w-full p-4 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 rounded-xl flex items-center gap-4 transition-all group disabled:opacity-50"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Wallet size={24} className="text-white" />
                </div>
                <div className="text-left">
                  <p className="text-white font-medium">Xaman (XUMM)</p>
                  <p className="text-zinc-500 text-sm">Recommended for XRPL</p>
                </div>
                {connecting && (
                  <div className="ml-auto w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                )}
              </button>

              <button
                onClick={() => handleWalletConnect('bifrost')}
                disabled={connecting}
                className="w-full p-4 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 rounded-xl flex items-center gap-4 transition-all disabled:opacity-50"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                  <Wallet size={24} className="text-white" />
                </div>
                <div className="text-left">
                  <p className="text-white font-medium">Bifrost Wallet</p>
                  <p className="text-zinc-500 text-sm">Multi-chain support</p>
                </div>
              </button>

              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-zinc-600 text-sm">or continue with email</span>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>

              <button
                onClick={() => setMode('login')}
                className="w-full p-3 text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Sign in with email
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white mb-6">
                {mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create account' : 'Reset password'}
              </h2>

              <div className="space-y-3">
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                {mode !== 'reset' && (
                  <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-12 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                )}
              </div>

              {mode === 'login' && (
                <button
                  onClick={() => setMode('reset')}
                  className="text-sm text-zinc-500 hover:text-emerald-400 transition-colors"
                >
                  Forgot password?
                </button>
              )}

              <button
                onClick={handleEmailLogin}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black font-semibold rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
              </button>

              <div className="flex items-center gap-4 my-4">
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-zinc-600 text-sm">or</span>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>

              <button
                onClick={() => setMode('wallet')}
                className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Wallet size={18} />
                Connect Wallet
              </button>

              <p className="text-center text-zinc-500 text-sm mt-6">
                {mode === 'login' ? "Don't have an account? " : mode === 'signup' ? 'Already have an account? ' : 'Remember your password? '}
                <button
                  onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                  className="text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  {mode === 'login' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
