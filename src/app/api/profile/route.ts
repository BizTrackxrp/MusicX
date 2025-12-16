import { NextRequest, NextResponse } from 'next/server';
import { getProfile, saveProfile } from '@/lib/db';

// GET /api/profile?address=xxx
export async function GET(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get('address');
    
    if (!address) {
      return NextResponse.json(
        { success: false, error: 'Address is required' },
        { status: 400 }
      );
    }
    
    const profile = await getProfile(address);
    
    if (!profile) {
      return NextResponse.json({ success: true, profile: null });
    }
    
    return NextResponse.json({
      success: true,
      profile: {
        walletAddress: profile.wallet_address,
        name: profile.name,
        bio: profile.bio,
        avatarUrl: profile.avatar_url,
        bannerUrl: profile.banner_url,
        pageTheme: profile.page_theme,
        accentColor: profile.accent_color,
        gradientStart: profile.gradient_start,
        gradientEnd: profile.gradient_end,
        gradientAngle: profile.gradient_angle,
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get profile' },
      { status: 500 }
    );
  }
}

// POST /api/profile
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Wallet address is required' },
        { status: 400 }
      );
    }
    
    await saveProfile({
      walletAddress: body.walletAddress,
      name: body.name,
      bio: body.bio,
      avatarUrl: body.avatarUrl,
      bannerUrl: body.bannerUrl,
      pageTheme: body.pageTheme,
      accentColor: body.accentColor,
      gradientStart: body.gradientStart,
      gradientEnd: body.gradientEnd,
      gradientAngle: body.gradientAngle,
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save profile error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save profile' },
      { status: 500 }
    );
  }
}
