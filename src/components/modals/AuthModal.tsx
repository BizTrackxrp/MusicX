'use client';

import { useState } from 'react';
import { X, Wallet, Mail, Lock, Eye, EyeOff, Music, Smartphone } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { useXaman } from '@/lib/xaman-context';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: { email?: string; wallet?: { type: 'xumm' | 'bifrost'; address: string } }) => void;
}

export default function AuthModal({ isOpen, onClose, onLogin }: AuthModalProps) {
  const { theme } = useTheme();
  const { connect, isConnecting, user } = useXaman();
  const [mode, setMode] = useState<'login' | 'signup' | 'reset' | 'wallet'>('wallet');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const handleXamanConnect = async () => {
    await connect();
    // The xaman-context will handle the success event
    // We check for user after connection
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

  const handleBifrostConnect = () => {
    // For now, show a message that Bifrost uses WalletConnect
    alert('Bifrost support coming soon! For now, please use Xaman wallet.');
  };

  const handleEmailLogin = () => {
    onLogin({ email });
    onClose();
  };

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
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
              <Music size={20} className="text-white" />
            </div>
            <span className={`text-2xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-black'}`}>XRP Music</span>
          </div>

          {mode === 'wallet' ? (
            <div className="space-y-4">
              <h2 className={`text-xl font-semibold mb-6 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Connect Wallet</h2>

              <button
                onClick={handleXamanConnect}
                disabled={isConnecting}
                className={`w-full p-4 border rounded-xl flex items-center gap-4 transition-all disabled:opacity-50 ${
                  theme === 'dark'
                    ? 'bg-zinc-800/50 hover:bg-zinc-800 border-zinc-700'
                    : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200'
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Smartphone size={24} className="text-white" />
                </div>
                <div className="text-left flex-1">
                  <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Xaman (XUMM)</p>
                  <p className="text-zinc-500 text-sm">Scan QR or open on mobile</p>
                </div>
                {isConnecting && (
                  <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                )}
              </button>

              <button
                onClick={handleBifrostConnect}
                disabled={isConnecting}
                className={`w-full p-4 border rounded-xl flex items-center gap-4 transition-all disabled:opacity-50 ${
                  theme === 'dark'
                    ? 'bg-zinc-800/50 hover:bg-zinc-800 border-zinc-700'
                    : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200'
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                  <Wallet size={24} className="text-white" />
                </div>
                <div className="text-left">
                  <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Bifrost Wallet</p>
                  <p className="text-zinc-500 text-sm">Coming soon</p>
                </div>
              </button>

              <div className="flex items-center gap-4 my-6">
                <div className={`flex-1 h-px ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
                <span className="text-zinc-500 text-sm">or continue with email</span>
                <div className={`flex-1 h-px ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
              </div>

              <button
                onClick={() => setMode('login')}
                className="w-full p-3 text-blue-500 hover:text-blue-400 transition-colors"
              >
                Sign in with email
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className={`text-xl font-semibold mb-6 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
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
                    className={`w-full pl-12 pr-4 py-3 border rounded-xl transition-colors focus:outline-none focus:border-blue-500 ${
                      theme === 'dark'
                        ? 'bg-zinc-800/50 border-zinc-700 text-white placeholder-zinc-500'
                        : 'bg-zinc-50 border-zinc-200 text-black placeholder-zinc-400'
                    }`}
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
                      className={`w-full pl-12 pr-12 py-3 border rounded-xl transition-colors focus:outline-none focus:border-blue-500 ${
                        theme === 'dark'
                          ? 'bg-zinc-800/50 border-zinc-700 text-white placeholder-zinc-500'
                          : 'bg-zinc-50 border-zinc-200 text-black placeholder-zinc-400'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                )}
              </div>

              {mode === 'login' && (
                <button
                  onClick={() => setMode('reset')}
                  className="text-sm text-zinc-500 hover:text-blue-400 transition-colors"
                >
                  Forgot password?
                </button>
              )}

              <button
                onClick={handleEmailLogin}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
              </button>

              <div className="flex items-center gap-4 my-4">
                <div className={`flex-1 h-px ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
                <span className="text-zinc-500 text-sm">or</span>
                <div className={`flex-1 h-px ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
              </div>

              <button
                onClick={() => setMode('wallet')}
                className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors ${
                  theme === 'dark'
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-black'
                }`}
              >
                <Wallet size={18} />
                Connect Wallet
              </button>

              <p className="text-center text-zinc-500 text-sm mt-6">
                {mode === 'login' ? "Don't have an account? " : mode === 'signup' ? 'Already have an account? ' : 'Remember your password? '}
                <button
                  onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                  className="text-blue-500 hover:text-blue-400 transition-colors"
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
