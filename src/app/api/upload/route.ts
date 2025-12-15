import { NextRequest, NextResponse } from 'next/server';

const LIGHTHOUSE_API_KEY = process.env.LIGHTHOUSE_API_KEY;

export async function POST(request: NextRequest) {
  try {
    console.log('=== Upload API Called ===');
    console.log('API Key exists:', !!LIGHTHOUSE_API_KEY);
    console.log('API Key length:', LIGHTHOUSE_API_KEY?.length);

    if (!LIGHTHOUSE_API_KEY) {
      console.error('LIGHTHOUSE_API_KEY not found in environment');
      return NextResponse.json(
        { error: 'Lighthouse API key not configured. Check your environment variables.' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      console.error('No file in request');
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log('File received:', file.name, 'Size:', file.size, 'Type:', file.type);

    // Convert File to Buffer for upload
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create form data for Lighthouse
    const lighthouseFormData = new FormData();
    const blob = new Blob([buffer], { type: file.type });
    lighthouseFormData.append('file', blob, file.name);

    console.log('Calling Lighthouse API...');
    
    const response = await fetch('https://node.lighthouse.storage/api/v0/add', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LIGHTHOUSE_API_KEY}`,
      },
      body: lighthouseFormData,
    });

    console.log('Lighthouse response status:', response.status);
    const responseText = await response.text();
    console.log('Lighthouse response body:', responseText);

    if (!response.ok) {
      console.error('Lighthouse error:', responseText);
      return NextResponse.json(
        { error: `Lighthouse upload failed: ${responseText}` },
        { status: response.status }
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('Failed to parse Lighthouse response:', responseText);
      return NextResponse.json(
        { error: 'Invalid response from Lighthouse' },
        { status: 500 }
      );
    }

    console.log('Upload successful! CID:', data.Hash);
    
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
