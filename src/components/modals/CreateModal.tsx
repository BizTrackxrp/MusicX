'use client';

import { useState } from 'react';
import { X, Music, Video, Disc, Upload, Plus, DollarSign, Check, TrendingUp, Image as ImageIcon } from 'lucide-react';

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TrackInput {
  id: number;
  title: string;
  price: number;
  file: File | null;
}

export default function CreateModal({ isOpen, onClose }: CreateModalProps) {
  const [step, setStep] = useState(1);
  const [releaseType, setReleaseType] = useState<'single' | 'album'>('single');
  const [mediaType, setMediaType] = useState<'audio' | 'video'>('audio');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(100);
  const [price, setPrice] = useState(25);
  const [albumPrice, setAlbumPrice] = useState(0);
  const [tracks, setTracks] = useState<TrackInput[]>([{ id: 1, title: '', price: 25, file: null }]);
  const [minting, setMinting] = useState(false);

  if (!isOpen) return null;

  const addTrack = () => {
    setTracks([...tracks, { id: tracks.length + 1, title: '', price: 25, file: null }]);
  };

  const updateTrack = (id: number, field: keyof TrackInput, value: string | number | File | null) => {
    setTracks(tracks.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const removeTrack = (id: number) => {
    if (tracks.length > 1) {
      setTracks(tracks.filter(t => t.id !== id));
    }
  };

  const totalTrackPrice = tracks.reduce((sum, t) => sum + (t.price || 0), 0);
  const suggestedAlbumPrice = Math.round(totalTrackPrice * 0.8);

  const handleMint = () => {
    setMinting(true);
    setTimeout(() => {
      setMinting(false);
      onClose();
      // Reset form
      setStep(1);
      setTitle('');
      setDescription('');
      setQuantity(100);
      setPrice(25);
      setTracks([{ id: 1, title: '', price: 25, file: null }]);
    }, 3000);
  };

  const totalSteps = releaseType === 'album' ? 4 : 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden my-8 animate-slide-up">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />

        {/* Header */}
        <div className="relative p-6 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Create & Mint to XRPL</h2>
            <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Progress bar */}
          <div className="flex gap-2 mt-4">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1 rounded-full transition-colors ${step >= i + 1 ? 'bg-emerald-500' : 'bg-zinc-800'}`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="relative p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Step 1: Release & Media Type */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Release Type</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setReleaseType('single')}
                    className={`flex-1 p-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                      releaseType === 'single'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                        : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    <Music size={24} />
                    <span className="text-sm font-medium">Single Track</span>
                  </button>
                  <button
                    onClick={() => setReleaseType('album')}
                    className={`flex-1 p-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                      releaseType === 'album'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                        : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    <Disc size={24} />
                    <span className="text-sm font-medium">Album / EP</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Media Type</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setMediaType('audio')}
                    className={`flex-1 p-3 rounded-xl border transition-all flex items-center justify-center gap-2 ${
                      mediaType === 'audio'
                        ? 'bg-purple-500/10 border-purple-500 text-purple-400'
                        : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    <Music size={18} />
                    <span className="text-sm font-medium">Audio (MP3)</span>
                  </button>
                  <button
                    onClick={() => setMediaType('video')}
                    className={`flex-1 p-3 rounded-xl border transition-all flex items-center justify-center gap-2 ${
                      mediaType === 'video'
                        ? 'bg-purple-500/10 border-purple-500 text-purple-400'
                        : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    <Video size={18} />
                    <span className="text-sm font-medium">Video (MP4)</span>
                  </button>
                </div>
              </div>

              {releaseType === 'album' && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <TrendingUp size={20} className="text-amber-400 mt-0.5" />
                    <div>
                      <h4 className="text-amber-400 font-semibold text-sm">Shared Inventory Pool</h4>
                      <p className="text-zinc-400 text-xs mt-1">
                        All tracks will share the same edition limit. Buying any individual track reduces complete album availability. This creates scarcity pressure!
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Step 2: Details */}
          {step === 2 && (
            <>
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  {releaseType === 'album' ? 'Album' : 'Track'} Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={releaseType === 'album' ? 'Enter album title' : 'Enter track title'}
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell listeners about this release..."
                  rows={3}
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                />
              </div>

              <div className="border-2 border-dashed border-zinc-700 rounded-xl p-6 text-center hover:border-emerald-500/50 transition-colors cursor-pointer">
                <div className="flex items-center justify-center gap-3">
                  <ImageIcon size={24} className="text-zinc-500" />
                  <div className="text-left">
                    <p className="text-white font-medium">Cover Art</p>
                    <p className="text-zinc-500 text-sm">PNG or JPG, 1:1 ratio</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Step 3: Tracks (Album only) */}
          {step === 3 && releaseType === 'album' && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Album Tracks</h3>
                <button
                  onClick={addTrack}
                  className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-white transition-colors"
                >
                  <Plus size={16} />
                  Add Track
                </button>
              </div>

              <div className="space-y-3">
                {tracks.map((track, index) => (
                  <div key={track.id} className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-700">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400 text-sm font-medium">
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        value={track.title}
                        onChange={(e) => updateTrack(track.id, 'title', e.target.value)}
                        placeholder="Track title"
                        className="flex-1 px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                      />
                      <div className="relative w-28">
                        <input
                          type="number"
                          value={track.price}
                          onChange={(e) => updateTrack(track.id, 'price', Number(e.target.value))}
                          className="w-full px-3 py-2 pr-12 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition-colors text-sm text-right"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">XRP</span>
                      </div>
                      {tracks.length > 1 && (
                        <button
                          onClick={() => removeTrack(track.id)}
                          className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    <div className="border-2 border-dashed border-zinc-700 rounded-lg p-3 text-center hover:border-emerald-500/50 transition-colors cursor-pointer">
                      <p className="text-zinc-500 text-sm flex items-center justify-center gap-2">
                        <Upload size={14} />
                        Upload {mediaType === 'audio' ? 'MP3' : 'MP4'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-zinc-800/50 rounded-xl">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-zinc-400">Individual tracks total</span>
                  <span className="text-white">{totalTrackPrice} XRP</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Suggested album price (20% off)</span>
                  <span className="text-emerald-400 font-medium">{suggestedAlbumPrice} XRP</span>
                </div>
              </div>
            </>
          )}

          {/* Step 3 for singles / Step 4 for albums: Upload & Pricing */}
          {((step === 3 && releaseType === 'single') || (step === 4 && releaseType === 'album')) && (
            <>
              {releaseType === 'single' && (
                <div className="border-2 border-dashed border-zinc-700 rounded-xl p-8 text-center hover:border-emerald-500/50 transition-colors cursor-pointer group">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors">
                    <Upload size={28} className="text-zinc-500 group-hover:text-emerald-400 transition-colors" />
                  </div>
                  <p className="text-white font-medium mb-1">Drop your {mediaType === 'audio' ? 'MP3' : 'MP4'} here</p>
                  <p className="text-zinc-500 text-sm">or click to browse</p>
                </div>
              )}

              <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-700">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
                    {releaseType === 'album' ? <Disc size={28} className="text-black" /> : <Music size={28} className="text-black" />}
                  </div>
                  <div>
                    <p className="text-white font-medium">{title || 'Untitled'}</p>
                    <p className="text-zinc-500 text-sm">
                      {releaseType === 'album' ? `${tracks.length} tracks` : 'Single track'} • Ready to mint on XRPL
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Edition Size (Quantity)</label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="1000"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="flex-1"
                  />
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-24 px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white text-center focus:outline-none focus:border-emerald-500"
                  />
                </div>
                {releaseType === 'album' && (
                  <p className="text-amber-400 text-xs mt-2 flex items-center gap-1">
                    <TrendingUp size={12} />
                    This creates {quantity} complete albums. Each track will also have {quantity} individual copies (shared pool).
                  </p>
                )}
              </div>

              {releaseType === 'single' && (
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Price per NFT (XRP)</label>
                  <div className="relative">
                    <DollarSign size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      className="w-full pl-12 pr-16 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">XRP</span>
                  </div>
                </div>
              )}

              {releaseType === 'album' && (
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Album Bundle Price (XRP)</label>
                  <div className="relative">
                    <DollarSign size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="number"
                      value={albumPrice || suggestedAlbumPrice}
                      onChange={(e) => setAlbumPrice(Number(e.target.value))}
                      className="w-full pl-12 pr-16 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">XRP</span>
                  </div>
                  <p className="text-zinc-500 text-xs mt-2">
                    Individual tracks total: {totalTrackPrice} XRP • Savings: {totalTrackPrice - (albumPrice || suggestedAlbumPrice)} XRP
                  </p>
                </div>
              )}

              <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-zinc-400">Platform Fee (2%)</span>
                  <span className="text-white">
                    {releaseType === 'single'
                      ? `${(price * 0.02).toFixed(2)} XRP per sale`
                      : '2% on all track & album sales'
                    }
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">You Receive</span>
                  <span className="text-emerald-400 font-medium">98% of each sale</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="relative p-6 border-t border-zinc-800 flex gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl transition-colors"
            >
              Back
            </button>
          )}

          {step < totalSteps ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 2 && !title}
              className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleMint}
              disabled={minting}
              className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {minting ? (
                <>
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Minting {releaseType === 'album' ? `${tracks.length + 1} NFTs` : '1 NFT'} to XRPL...
                </>
              ) : (
                <>
                  <Check size={18} />
                  Mint & List for Sale
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
