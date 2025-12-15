import { NextRequest, NextResponse } from 'next/server';

const LIGHTHOUSE_API_KEY = process.env.LIGHTHOUSE_API_KEY;

export async function POST(request: NextRequest) {
  try {
    console.log('=== Upload JSON API Called ===');
    console.log('API Key exists:', !!LIGHTHOUSE_API_KEY);

    if (!LIGHTHOUSE_API_KEY) {
      console.error('LIGHTHOUSE_API_KEY not found in environment');
      return NextResponse.json(
        { error: 'Lighthouse API key not configured. Check your environment variables.' },
        { status: 500 }
      );
    }

    const json = await request.json();
    const { data, name } = json;

    if (!data) {
      console.error('No data in request');
      return NextResponse.json(
        { error: 'No data provided' },
        { status: 400 }
      );
    }

    console.log('JSON data received, name:', name);

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    const lighthouseFormData = new FormData();
    lighthouseFormData.append('file', blob, name || 'metadata.json');

    console.log('Calling Lighthouse API...');
    
    const response = await fetch('https://upload.lighthouse.storage/api/v0/add', {
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

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      console.error('Failed to parse response:', responseText);
      return NextResponse.json(
        { error: 'Invalid response from Lighthouse' },
        { status: 500 }
      );
    }

    console.log('JSON upload successful! CID:', responseData.Hash);
    
    return NextResponse.json({
      success: true,
      cid: responseData.Hash,
      url: `https://gateway.lighthouse.storage/ipfs/${responseData.Hash}`,
      name: responseData.Name,
      size: responseData.Size,
    });

  } catch (error) {
    console.error('Upload JSON API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
