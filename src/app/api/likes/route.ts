import { NextRequest, NextResponse } from 'next/server';
import { likeTrack, unlikeTrack, getLikedTracks, isTrackLiked, getUserLikedTrackIds } from '@/lib/db';

// GET /api/likes?user=xxx or ?user=xxx&trackId=xxx (check single) or ?user=xxx&ids=true (get all IDs)
export async function GET(request: NextRequest) {
  try {
    const userAddress = request.nextUrl.searchParams.get('user');
    const trackId = request.nextUrl.searchParams.get('trackId');
    const idsOnly = request.nextUrl.searchParams.get('ids') === 'true';
    
    if (!userAddress) {
      return NextResponse.json({ success: false, error: 'Missing user address' }, { status: 400 });
    }
    
    // Check if specific track is liked
    if (trackId) {
      const isLiked = await isTrackLiked(userAddress, trackId);
      return NextResponse.json({ success: true, isLiked });
    }
    
    // Get just the IDs (for quick UI checks)
    if (idsOnly) {
      const trackIds = await getUserLikedTrackIds(userAddress);
      return NextResponse.json({ success: true, trackIds });
    }
    
    // Get full liked tracks with details
    const tracks = await getLikedTracks(userAddress);
    return NextResponse.json({ success: true, tracks });
  } catch (error) {
    console.error('Get likes error:', error);
    return NextResponse.json({ success: false, error: 'Failed to get likes' }, { status: 500 });
  }
}

// POST /api/likes - Like or unlike a track
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userAddress, trackId, releaseId } = body;
    
    if (!userAddress || !trackId) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    
    if (action === 'unlike') {
      await unlikeTrack(userAddress, trackId);
    } else {
      if (!releaseId) {
        return NextResponse.json({ success: false, error: 'Missing releaseId for like' }, { status: 400 });
      }
      await likeTrack(userAddress, trackId, releaseId);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Like action error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update like' }, { status: 500 });
  }
}
