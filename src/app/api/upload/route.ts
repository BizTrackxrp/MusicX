import { NextRequest, NextResponse } from 'next/server';

const LIGHTHOUSE_API_KEY = process.env.LIGHTHOUSE_API_KEY;

export async function POST(request: NextRequest) {
  try {
    console.log('=== Upload API Called ===');
    console.log('API Key exists:', !!LIGHTHOUSE_API_KEY);

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

    console.log('File received:', file.name, 'Size:', file.size);

    // Convert to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Use FormData with node-style append
    const uploadFormData = new FormData();
    const blob = new Blob([buffer], { type: file.type });
    uploadFormData.append('file', blob, file.name);

    console.log('Uploading to Lighthouse...');
    
    const response = await fetch('https://upload.lighthouse.storage/api/v0/add', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LIGHTHOUSE_API_KEY}`,
      },
      body: uploadFormData,
    });

    const responseText = await response.text();
    console.log('Lighthouse status:', response.status);
    console.log('Lighthouse response:', responseText);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upload failed: ${responseText}` },
        { status: response.status }
      );
    }

    const data = JSON.parse(responseText);
    
    return NextResponse.json({
      success: true,
      cid: data.Hash,
      url: `https://gateway.lighthouse.storage/ipfs/${data.Hash}`,
      name: data.Name,
      size: data.Size,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
