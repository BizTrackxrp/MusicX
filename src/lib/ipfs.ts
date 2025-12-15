// IPFS Upload Helper - Calls our secure API routes

export interface UploadResult {
  success: boolean;
  cid?: string;
  url?: string;
  error?: string;
}

// Upload a file (audio or image) to IPFS via our API
export async function uploadFileToIPFS(file: File): Promise<UploadResult> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }

    return {
      success: true,
      cid: data.cid,
      url: data.url,
    };
  } catch (error) {
    console.error('IPFS upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

// Upload JSON metadata to IPFS via our API
export async function uploadJSONToIPFS(json: object, name: string): Promise<UploadResult> {
  try {
    const response = await fetch('/api/upload-json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: json, name }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }

    return {
      success: true,
      cid: data.cid,
      url: data.url,
    };
  } catch (error) {
    console.error('IPFS JSON upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

// Helper to get IPFS gateway URL
export function getIPFSUrl(cid: string): string {
  return `https://gateway.lighthouse.storage/ipfs/${cid}`;
}
