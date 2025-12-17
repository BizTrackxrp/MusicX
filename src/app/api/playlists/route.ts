import { NextRequest, NextResponse } from 'next/server';
import { 
  createPlaylist, 
  updatePlaylist, 
  deletePlaylist, 
  getPlaylistsByUser, 
  getPlaylistById,
  getPlaylistWithTracks,
  getPublicPlaylists,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  reorderPlaylistTracks,
  likePlaylist,
  unlikePlaylist,
  hasUserLikedPlaylist
} from '@/lib/db';

// GET /api/playlists?user=xxx or ?id=xxx or ?public=true&sort=newest|popular
export async function GET(request: NextRequest) {
  try {
    const userAddress = request.nextUrl.searchParams.get('user');
    const playlistId = request.nextUrl.searchParams.get('id');
    const isPublic = request.nextUrl.searchParams.get('public');
    const sort = request.nextUrl.searchParams.get('sort') as 'newest' | 'popular' || 'newest';
    const withTracks = request.nextUrl.searchParams.get('withTracks') === 'true';
    const checkLiked = request.nextUrl.searchParams.get('checkLiked');
    
    // Get single playlist by ID
    if (playlistId) {
      const playlist = withTracks 
        ? await getPlaylistWithTracks(playlistId)
        : await getPlaylistById(playlistId);
      
      if (!playlist) {
        return NextResponse.json({ success: false, error: 'Playlist not found' }, { status: 404 });
      }
      
      // Check if user has liked this playlist
      let hasLiked = false;
      if (checkLiked) {
        hasLiked = await hasUserLikedPlaylist(playlistId, checkLiked);
      }
      
      return NextResponse.json({ success: true, playlist, hasLiked });
    }
    
    // Get public playlists
    if (isPublic === 'true') {
      const playlists = await getPublicPlaylists(sort);
      return NextResponse.json({ success: true, playlists });
    }
    
    // Get user's playlists
    if (userAddress) {
      const playlists = await getPlaylistsByUser(userAddress);
      return NextResponse.json({ success: true, playlists });
    }
    
    return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
  } catch (error) {
    console.error('Get playlists error:', error);
    return NextResponse.json({ success: false, error: 'Failed to get playlists' }, { status: 500 });
  }
}

// POST /api/playlists - Create playlist or add track to playlist
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action || 'create';
    
    switch (action) {
      case 'create': {
        if (!body.name || !body.ownerAddress) {
          return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }
        
        const id = Math.random().toString(36).substr(2, 9);
        await createPlaylist({
          id,
          name: body.name,
          description: body.description,
          ownerAddress: body.ownerAddress,
          coverUrl: body.coverUrl,
          isPublic: body.isPublic || false,
        });
        
        return NextResponse.json({ success: true, playlistId: id });
      }
      
      case 'addTrack': {
        if (!body.playlistId || !body.ownerAddress || !body.trackId || !body.releaseId) {
          return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }
        
        await addTrackToPlaylist(body.playlistId, body.ownerAddress, body.trackId, body.releaseId);
        return NextResponse.json({ success: true });
      }
      
      case 'removeTrack': {
        if (!body.playlistId || !body.ownerAddress || !body.playlistTrackId) {
          return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }
        
        await removeTrackFromPlaylist(body.playlistId, body.ownerAddress, body.playlistTrackId);
        return NextResponse.json({ success: true });
      }
      
      case 'reorder': {
        if (!body.playlistId || !body.ownerAddress || !body.trackIds) {
          return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }
        
        await reorderPlaylistTracks(body.playlistId, body.ownerAddress, body.trackIds);
        return NextResponse.json({ success: true });
      }
      
      case 'like': {
        if (!body.playlistId || !body.userAddress) {
          return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }
        
        await likePlaylist(body.playlistId, body.userAddress);
        return NextResponse.json({ success: true });
      }
      
      case 'unlike': {
        if (!body.playlistId || !body.userAddress) {
          return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }
        
        await unlikePlaylist(body.playlistId, body.userAddress);
        return NextResponse.json({ success: true });
      }
      
      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Playlist action error:', error);
    return NextResponse.json({ success: false, error: 'Failed to perform action' }, { status: 500 });
  }
}

// PUT /api/playlists - Update playlist
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.playlistId || !body.ownerAddress) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    
    await updatePlaylist(body.playlistId, body.ownerAddress, {
      name: body.name,
      description: body.description,
      coverUrl: body.coverUrl,
      isPublic: body.isPublic,
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update playlist error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update playlist' }, { status: 500 });
  }
}

// DELETE /api/playlists?id=xxx&owner=xxx
export async function DELETE(request: NextRequest) {
  try {
    const playlistId = request.nextUrl.searchParams.get('id');
    const ownerAddress = request.nextUrl.searchParams.get('owner');
    
    if (!playlistId || !ownerAddress) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    
    await deletePlaylist(playlistId, ownerAddress);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete playlist error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete playlist' }, { status: 500 });
  }
}
