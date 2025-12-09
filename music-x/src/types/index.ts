// User types
export interface User {
  id: string;
  email?: string;
  wallet?: {
    type: 'xumm' | 'bifrost';
    address: string;
  };
  username?: string;
  avatar?: string;
  bio?: string;
  followers: number;
  following: number;
  createdAt: Date;
}

// Track types
export interface Track {
  id: number;
  title: string;
  duration: string;
  price: number;
  available: number;
  plays: number;
  artist?: string;
  album?: string;
  albumId?: number;
  cover?: string;
  owner?: string;
  mediaType: 'audio' | 'video';
  ipfsHash?: string;
  nftTokenId?: string;
}

// Album types with shared inventory pool
export interface Album {
  id: number;
  title: string;
  artist: string;
  cover: string;
  releaseDate: string;
  description?: string;
  genre?: string;
  totalMinted: number;
  completeAlbumsAvailable: number; // Decreases when ANY track or full album is bought
  albumPrice: number;
  tracks: Track[];
  creatorAddress: string;
}

// Single (standalone track not part of album)
export interface Single extends Track {
  isSingle: true;
  quantity: number;
}

// Message types
export interface Message {
  id: number;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: Date;
  read: boolean;
}

export interface Conversation {
  id: number;
  participantId: string;
  participantName: string;
  participantAvatar: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  muted: boolean;
  blocked: boolean;
}

// Purchase/Ownership types
export interface OwnedAsset {
  id: number;
  type: 'track' | 'album';
  assetId: number;
  title: string;
  artist: string;
  cover: string;
  purchasePrice: number;
  purchaseDate: Date;
  editionNumber: number;
  totalEditions: number;
  nftTokenId: string;
}

export interface SaleRecord {
  id: number;
  assetId: number;
  assetType: 'track' | 'album';
  title: string;
  buyerAddress: string;
  salePrice: number;
  platformFee: number; // 2%
  artistReceived: number; // 98%
  saleDate: Date;
  transactionHash: string;
}

// Minting types
export interface MintRequest {
  releaseType: 'single' | 'album';
  mediaType: 'audio' | 'video';
  title: string;
  description: string;
  genre: string;
  cover: File | null;
  quantity: number;
  price?: number; // for singles
  albumPrice?: number; // for albums
  tracks?: {
    title: string;
    price: number;
    file: File | null;
  }[];
}

// Wallet connection types
export interface WalletConnection {
  type: 'xumm' | 'bifrost';
  address: string;
  connected: boolean;
  balance?: number;
}

// App state types
export interface AppState {
  user: User | null;
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  currentPage: 'stream' | 'marketplace' | 'profile';
}
