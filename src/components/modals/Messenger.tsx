'use client';

import { useState } from 'react';
import { X, MoreHorizontal, BellOff, Ban, Send } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { Conversation } from '@/types';
import { mockConversations } from '@/lib/mock-data';

interface MessengerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Messenger({ isOpen, onClose }: MessengerProps) {
  const { theme } = useTheme();
  const [activeChat, setActiveChat] = useState<Conversation | null>(null);
  const [message, setMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  if (!isOpen) return null;

  return (
    <div className={`fixed right-0 top-0 h-full w-96 border-l z-40 flex flex-col transition-colors ${
      theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200'
    }`}>
      <div className={`p-4 border-b flex items-center justify-between ${
        theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'
      }`}>
        <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Messages</h3>
        <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      {activeChat ? (
        <div className="flex-1 flex flex-col">
          <div className={`p-4 border-b flex items-center justify-between ${
            theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'
          }`}>
            <button onClick={() => setActiveChat(null)} className="flex items-center gap-3">
              <img src={activeChat.participantAvatar} alt="" className="w-10 h-10 rounded-full" />
              <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{activeChat.participantName}</span>
            </button>
            <div className="relative">
              <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-zinc-500 hover:text-white">
                <MoreHorizontal size={20} />
              </button>
              {showSettings && (
                <div className={`absolute right-0 top-full mt-2 w-48 border rounded-xl shadow-xl z-10 ${
                  theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
                }`}>
                  <button className={`w-full px-4 py-3 text-left flex items-center gap-3 ${
                    theme === 'dark' ? 'text-white hover:bg-zinc-800' : 'text-black hover:bg-zinc-100'
                  }`}>
                    <BellOff size={16} /> Mute
                  </button>
                  <button className="w-full px-4 py-3 text-left text-red-400 hover:bg-zinc-800 flex items-center gap-3">
                    <Ban size={16} /> Block
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            <div className="flex justify-start">
              <div className={`max-w-[80%] p-3 rounded-2xl rounded-bl-sm ${
                theme === 'dark' ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-black'
              }`}>
                Hey! Thanks for checking out my track 🎵
              </div>
            </div>
            <div className="flex justify-end">
              <div className="max-w-[80%] p-3 bg-blue-600 rounded-2xl rounded-br-sm text-white">
                Love it! Just picked up edition #42
              </div>
            </div>
          </div>
          <div className={`p-4 border-t flex gap-2 ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`}>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className={`flex-1 px-4 py-3 border rounded-xl focus:outline-none focus:border-blue-500 ${
                theme === 'dark'
                  ? 'bg-zinc-800/50 border-zinc-700 text-white placeholder-zinc-500'
                  : 'bg-zinc-50 border-zinc-200 text-black placeholder-zinc-400'
              }`}
            />
            <button className="p-3 bg-blue-500 hover:bg-blue-400 rounded-xl">
              <Send size={20} className="text-white" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {mockConversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setActiveChat(conv)}
              className={`w-full p-4 flex items-center gap-3 border-b transition-colors ${
                theme === 'dark'
                  ? 'hover:bg-zinc-900 border-zinc-800/50'
                  : 'hover:bg-zinc-50 border-zinc-100'
              }`}
            >
              <div className="relative">
                <img src={conv.participantAvatar} alt="" className="w-12 h-12 rounded-full" />
                {conv.unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
                    {conv.unreadCount}
                  </div>
                )}
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{conv.participantName}</span>
                  <span className="text-zinc-500 text-sm">{conv.lastMessageTime}</span>
                </div>
                <p className="text-zinc-400 text-sm truncate">{conv.lastMessage}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
