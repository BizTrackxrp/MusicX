# Music X 🎵

A decentralized music platform built on the XRP Ledger (XRPL), enabling artists to mint, sell, and stream music as NFTs.

## Features

### 🎧 Three Main Pages
- **Stream** - Discover and play music, view featured drops and trending tracks
- **Marketplace** - Browse and purchase albums, singles, and individual tracks as NFTs
- **Profile** - Manage your posted content, owned NFTs, and sales history

### 🔐 Authentication
- Wallet connect (Xaman/XUMM & Bifrost)
- Email/password authentication
- Password reset flow

### 🎨 Create & Mint
- Upload MP3 or MP4 (music videos)
- Single track or full album releases
- Set edition size and pricing
- **Shared Inventory Pool** - Album and individual tracks share the same edition limit

### 💰 Shared Inventory Scarcity System
The killer feature: When you mint an album with 100 editions:
- 100 complete albums available
- Each track has 100 individual copies
- **BUT** they share the same inventory pool

**Example:**
- Someone buys the full album → Complete albums: 100 → 99, ALL tracks: 100 → 99
- Someone buys just Track 3 → Track 3: 100 → 99, Complete albums: 100 → 99

This creates FOMO pressure from both directions!

### 💬 Messaging
- Direct messages with any platform user
- Block/mute functionality
- Notification controls

### 📊 2% DAO Fee
All sales include a 2% platform fee that supports the Music X DAO.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Blockchain:** XRPL (XLS-20 NFTs)

## Getting Started

```bash
npm install
npm run dev
```

## Next Steps

1. **XRPL Integration** - Connect actual wallet signing and NFT minting
2. **IPFS Storage** - Store media files on IPFS via Pinata
3. **Database** - Add Supabase/Firebase for user data, messages, listings
4. **Payment Flow** - Implement XRP transfers with 2% DAO fee routing
5. **Audio Player** - Add actual audio playback with Web Audio API
