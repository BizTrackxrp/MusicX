import { NextRequest, NextResponse } from 'next/server';
import { searchReleases } from '@/lib/db';

// GET /api/search?q=xxx
export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get('q');
    
    if (!query || query.trim().length < 2) {
      return NextResponse.json({ success: true, releases: [], message: 'Query too short' });
    }
    
    const releases = await searchReleases(query.trim());
    
    return NextResponse.json({ success: true, releases });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ success: false, error: 'Search failed' }, { status: 500 });
  }
}
