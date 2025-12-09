import { Album, Single, Conversation } from '@/types';

// Albums with shared inventory pool
export const mockAlbums: Album[] = [
  {
    id: 1,
    title: "Digital Horizons",
    artist: "CryptoBeats",
    cover: "https://picsum.photos/seed/album1/300/300",
    releaseDate: "2025-01-15",
    description: "A journey through the digital soundscape",
    genre: "Electronic",
    totalMinted: 100,
    completeAlbumsAvailable: 67,
    albumPrice: 150,
    creatorAddress: "rN7n3473SaZBCG4dFL83w7a1RXtXtbk2D9",
    tracks: [
      { id: 101, title: "Neon Dreams", duration: "3:42", price: 25, available: 67, plays: 12450, mediaType: 'audio' },
      { id: 102, title: "Midnight Protocol", duration: "4:01", price: 25, available: 67, plays: 8920, mediaType: 'audio' },
      { id: 103, title: "Data Streams", duration: "3:18", price: 25, available: 70, plays: 6540, mediaType: 'audio' },
      { id: 104, title: "Binary Sunset", duration: "5:22", price: 30, available: 67, plays: 15230, mediaType: 'audio' },
      { id: 105, title: "Quantum State", duration: "3:55", price: 25, available: 68, plays: 9100, mediaType: 'audio' },
    ]
  },
  {
    id: 2,
    title: "Consensus",
    artist: "The Validators",
    cover: "https://picsum.photos/seed/album2/300/300",
    releaseDate: "2025-02-01",
    description: "Blockchain-inspired electronic beats",
    genre: "Electronic",
    totalMinted: 50,
    completeAlbumsAvailable: 23,
    albumPrice: 200,
    creatorAddress: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
    tracks: [
      { id: 201, title: "Blockchain Symphony", duration: "4:15", price: 50, available: 23, plays: 8920, mediaType: 'audio' },
      { id: 202, title: "Proof of Work", duration: "3:48", price: 40, available: 31, plays: 7650, mediaType: 'audio' },
      { id: 203, title: "Fork in the Road", duration: "4:32", price: 45, available: 28, plays: 5430, mediaType: 'audio' },
      { id: 204, title: "51% Attack", duration: "3:21", price: 35, available: 23, plays: 11200, mediaType: 'audio' },
    ]
  },
  {
    id: 3,
    title: "Fast Settlement",
    artist: "Ledger Lords",
    cover: "https://picsum.photos/seed/album3/300/300",
    releaseDate: "2025-03-10",
    description: "Speed and efficiency in sound",
    genre: "Hip Hop",
    totalMinted: 500,
    completeAlbumsAvailable: 412,
    albumPrice: 100,
    creatorAddress: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
    tracks: [
      { id: 301, title: "XRP Flow", duration: "3:28", price: 15, available: 412, plays: 15670, mediaType: 'audio' },
      { id: 302, title: "Three Seconds", duration: "3:03", price: 15, available: 420, plays: 12340, mediaType: 'audio' },
      { id: 303, title: "Ripple Effect", duration: "4:11", price: 20, available: 415, plays: 9870, mediaType: 'audio' },
      { id: 304, title: "No Gas Fees", duration: "3:45", price: 15, available: 412, plays: 18900, mediaType: 'audio' },
      { id: 305, title: "Validator Node", duration: "4:28", price: 20, available: 418, plays: 7650, mediaType: 'audio' },
      { id: 306, title: "Escrow Dreams", duration: "5:02", price: 25, available: 412, plays: 6230, mediaType: 'audio' },
    ]
  },
  {
    id: 4,
    title: "Trustless",
    artist: "Node Runner",
    cover: "https://picsum.photos/seed/album4/300/300",
    releaseDate: "2024-12-20",
    description: "No intermediaries, just pure sound",
    genre: "Ambient",
    totalMinted: 25,
    completeAlbumsAvailable: 8,
    albumPrice: 350,
    creatorAddress: "rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh",
    tracks: [
      { id: 401, title: "Decentralized Love", duration: "5:01", price: 100, available: 8, plays: 6340, mediaType: 'audio' },
      { id: 402, title: "Smart Contract", duration: "4:22", price: 80, available: 12, plays: 4520, mediaType: 'audio' },
      { id: 403, title: "Immutable", duration: "3:58", price: 90, available: 8, plays: 5670, mediaType: 'audio' },
    ]
  },
];

// Flatten tracks for streaming page (with album reference)
export const getAllTracks = () => {
  return mockAlbums.flatMap(album =>
    album.tracks.map(track => ({
      ...track,
      artist: album.artist,
      album: album.title,
      albumId: album.id,
      cover: album.cover,
      owner: album.creatorAddress.slice(0, 6) + '...' + album.creatorAddress.slice(-4)
    }))
  );
};

// Singles (tracks not part of albums)
export const mockSingles: Single[] = [
  {
    id: 501,
    title: "Gas Free",
    artist: "XRPL Collective",
    cover: "https://picsum.photos/seed/single1/300/300",
    duration: "3:55",
    price: 30,
    quantity: 200,
    available: 156,
    plays: 21000,
    isSingle: true,
    mediaType: 'audio'
  },
  {
    id: 502,
    title: "Memo Field",
    artist: "Hex Wizard",
    cover: "https://picsum.photos/seed/single2/300/300",
    duration: "4:12",
    price: 45,
    quantity: 75,
    available: 62,
    plays: 8430,
    isSingle: true,
    mediaType: 'audio'
  },
  {
    id: 503,
    title: "Payment Channel",
    artist: "Escrow Eddie",
    cover: "https://picsum.photos/seed/single3/300/300",
    duration: "3:33",
    price: 20,
    quantity: 300,
    available: 245,
    plays: 14200,
    isSingle: true,
    mediaType: 'audio'
  },
];

// Mock conversations
export const mockConversations: Conversation[] = [
  {
    id: 1,
    participantId: "user1",
    participantName: "CryptoBeats",
    participantAvatar: "https://picsum.photos/seed/user1/100/100",
    lastMessage: "Thanks for the purchase!",
    lastMessageTime: "2m",
    unreadCount: 2,
    muted: false,
    blocked: false
  },
  {
    id: 2,
    participantId: "user2",
    participantName: "The Validators",
    participantAvatar: "https://picsum.photos/seed/user2/100/100",
    lastMessage: "New drop coming soon 🔥",
    lastMessageTime: "1h",
    unreadCount: 0,
    muted: false,
    blocked: false
  },
  {
    id: 3,
    participantId: "user3",
    participantName: "Ledger Lords",
    participantAvatar: "https://picsum.photos/seed/user3/100/100",
    lastMessage: "Collab?",
    lastMessageTime: "3h",
    unreadCount: 1,
    muted: false,
    blocked: false
  },
];

// Get featured albums (for homepage)
export const getFeaturedAlbums = () => {
  return mockAlbums.slice(0, 3);
};

// Get trending tracks (sorted by plays)
export const getTrendingTracks = (limit = 10) => {
  return getAllTracks()
    .sort((a, b) => b.plays - a.plays)
    .slice(0, limit);
};

// Get low stock albums (for urgency)
export const getLowStockAlbums = () => {
  return mockAlbums.filter(album => album.completeAlbumsAvailable < 30);
};
