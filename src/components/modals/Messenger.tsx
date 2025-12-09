'use client';

import { useState } from 'react';
import { X, MoreHorizontal, BellOff, Ban, Send } from 'lucide-react';
import { Conversation } from '@/types';
import { mockConversations } from '@/lib/mock-data';

interface MessengerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Messenger({ isOpen, onClose }: MessengerProps) {
  const [activeChat, setActiveChat] = useState<Conversation | null>(null);
  const [message, setMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-zinc-950 border-l border-zinc-800 z-40 flex flex-col">
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Messages</h3>
        <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      {activeChat ? (
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <button onClick={() => setActiveChat(null)} className="flex items-center gap-3">
              <img src={activeChat.participantAvatar} alt="" className="w-10 h-10 rounded-full" />
              <span className="text-white font-medium">{activeChat.participantName}</span>
            </button>
            <div className="relative">
              <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-zinc-500 hover:text-white">
                <MoreHorizontal size={20} />
              </button>
              {showSettings && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-10">
                  <button className="w-full px-4 py-3 text-left text-white hover:bg-zinc-800 flex items-center gap-3">
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
              <div className="max-w-[80%] p-3 bg-zinc-800 rounded-2xl rounded-bl-sm text-white">
                Hey! Thanks for checking out my track 🎵
              </div>
            </div>
            <div className="flex justify-end">
              <div className="max-w-[80%] p-3 bg-emerald-600 rounded-2xl rounded-br-sm text-white">
                Love it! Just picked up edition #42
              </div>
            </div>
          </div>
          <div className="p-4 border-t border-zinc-800 flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
            <button className="p-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl">
              <Send size={20} className="text-black" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {mockConversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setActiveChat(conv)}
              className="w-full p-4 flex items-center gap-3 hover:bg-zinc-900 border-b border-zinc-800/50"
            >
              <div className="relative">
                <img src={conv.participantAvatar} alt="" className="w-12 h-12 rounded-full" />
                {conv.unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-xs text-black font-bold">
                    {conv.unreadCount}
                  </div>
                )}
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium">{conv.participantName}</span>
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
