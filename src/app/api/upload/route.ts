import { NextRequest, NextResponse } from 'next/server';

const LIGHTHOUSE_API_KEY = process.env.LIGHTHOUSE_API_KEY;
const LIGHTHOUSE_UPLOAD_URL = 'https://node.lighthouse.storage/api/v0/add';

export async function POST(request: NextRequest) {
  try {
    if (!LIGHTHOUSE_API_KEY) {
      return NextResponse.json(
        { error: 'Lighthouse API key not configured' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const lighthouseFormData = new FormData();
    lighthouseFormData.append('file', file);

    const response = await fetch(LIGHTHOUSE_UPLOAD_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LIGHTHOUSE_API_KEY}`,
      },
      body: lighthouseFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lighthouse upload error:', errorText);
      return NextResponse.json(
        { error: `Upload failed: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      cid: data.Hash,
      url: `https://gateway.lighthouse.storage/ipfs/${data.Hash}`,
      name: data.Name,
      size: data.Size,
    });

  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
