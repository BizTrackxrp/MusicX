/**
 * XRP Music - Upload API
 * Upload files to IPFS via Lighthouse
 */

export const config = {
  api: {
    bodyParser: false, // Required for file uploads
  },
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Parse multipart form data
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    
    // Extract boundary from content-type
    const contentType = req.headers['content-type'];
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    if (!boundaryMatch) {
      return res.status(400).json({ error: 'Invalid content type' });
    }
    
    const boundary = boundaryMatch[1];
    const parts = parseMultipart(buffer, boundary);
    
    const filePart = parts.find(p => p.name === 'file');
    if (!filePart) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    // Upload to Lighthouse
    const lighthouseApiKey = process.env.LIGHTHOUSE_API_KEY;
    if (!lighthouseApiKey) {
      return res.status(500).json({ error: 'Lighthouse not configured' });
    }
    
    // Create form data for Lighthouse
    const formData = new FormData();
    const blob = new Blob([filePart.data], { type: filePart.contentType });
    formData.append('file', blob, filePart.filename);
    
    const lighthouseResponse = await fetch('https://node.lighthouse.storage/api/v0/add', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lighthouseApiKey}`,
      },
      body: formData,
    });
    
    if (!lighthouseResponse.ok) {
      const error = await lighthouseResponse.text();
      console.error('Lighthouse error:', error);
      return res.status(500).json({ error: 'Failed to upload to IPFS' });
    }
    
    const lighthouseData = await lighthouseResponse.json();
    
    // Lighthouse returns { Name, Hash, Size }
    const cid = lighthouseData.Hash;
    
    return res.json({
      success: true,
      cid: cid,
      url: `https://gateway.lighthouse.storage/ipfs/${cid}`,
      ipfsUrl: `ipfs://${cid}`,
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Upload failed' });
  }
}

/**
 * Parse multipart form data
 */
function parseMultipart(buffer, boundary) {
  const parts = [];
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const endBoundary = Buffer.from(`--${boundary}--`);
  
  let start = buffer.indexOf(boundaryBuffer) + boundaryBuffer.length + 2; // Skip \r\n
  
  while (start < buffer.length) {
    let end = buffer.indexOf(boundaryBuffer, start);
    if (end === -1) break;
    
    const partBuffer = buffer.slice(start, end - 2); // Remove trailing \r\n
    
    // Find headers end
    const headerEnd = partBuffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) {
      start = end + boundaryBuffer.length + 2;
      continue;
    }
    
    const headerStr = partBuffer.slice(0, headerEnd).toString();
    const data = partBuffer.slice(headerEnd + 4);
    
    // Parse headers
    const headers = {};
    headerStr.split('\r\n').forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length) {
        headers[key.toLowerCase().trim()] = valueParts.join(':').trim();
      }
    });
    
    // Extract name and filename from Content-Disposition
    const disposition = headers['content-disposition'] || '';
    const nameMatch = disposition.match(/name="([^"]+)"/);
    const filenameMatch = disposition.match(/filename="([^"]+)"/);
    
    parts.push({
      name: nameMatch ? nameMatch[1] : null,
      filename: filenameMatch ? filenameMatch[1] : null,
      contentType: headers['content-type'] || 'application/octet-stream',
      data: data,
    });
    
    start = end + boundaryBuffer.length + 2;
    
    // Check for end boundary
    if (buffer.slice(end, end + endBoundary.length).equals(endBoundary)) {
      break;
    }
  }
  
  return parts;
}
