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

    const json = await request.json();
    const { data, name } = json;

    if (!data) {
      return NextResponse.json(
        { error: 'No data provided' },
        { status: 400 }
      );
    }

    const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const file = new File([jsonBlob], name || 'metadata.json', { type: 'application/json' });

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
      console.error('Lighthouse JSON upload error:', errorText);
      return NextResponse.json(
        { error: `Upload failed: ${errorText}` },
        { status: response.status }
      );
    }

    const responseData = await response.json();
    
    return NextResponse.json({
      success: true,
      cid: responseData.Hash,
      url: `https://gateway.lighthouse.storage/ipfs/${responseData.Hash}`,
      name: responseData.Name,
      size: responseData.Size,
    });

  } catch (error) {
    console.error('JSON Upload API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
