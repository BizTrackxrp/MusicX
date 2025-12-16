import { NextRequest, NextResponse } from 'next/server';
import { getAllReleases, getReleasesByArtist, saveRelease } from '@/lib/db';

// GET /api/releases?artist=xxx (optional artist filter)
export async function GET(request: NextRequest) {
  try {
    const artistAddress = request.nextUrl.searchParams.get('artist');
    
    let releases;
    if (artistAddress) {
      releases = await getReleasesByArtist(artistAddress);
    } else {
      releases = await getAllReleases();
    }
    
    return NextResponse.json({ success: true, releases });
  } catch (error) {
    console.error('Get releases error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get releases' },
      { status: 500 }
    );
  }
}

// POST /api/releases
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.id || !body.type || !body.title || !body.artistAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    await saveRelease({
      id: body.id,
      type: body.type,
      title: body.title,
      description: body.description,
      artistAddress: body.artistAddress,
      artistName: body.artistName,
      coverUrl: body.coverUrl,
      coverCid: body.coverCid,
      songPrice: body.songPrice,
      albumPrice: body.albumPrice,
      totalEditions: body.totalEditions,
      soldEditions: body.soldEditions,
      metadataCid: body.metadataCid,
      txHash: body.txHash,
      tracks: body.tracks || [],
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save release error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save release' },
      { status: 500 }
    );
  }
}
