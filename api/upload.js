/**
 * XRP Music - Upload API
 * Upload files to IPFS via Lighthouse
 */

import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
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
    // Use formidable for proper multipart parsing (streams to disk, not memory)
    const form = formidable({ 
      maxFileSize: 50 * 1024 * 1024, // 50MB max
      keepExtensions: true,
    });
    
    const [fields, files] = await form.parse(req);
    const file = files.file?.[0];
    
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    console.log('Uploading:', file.originalFilename, Math.round(file.size / 1024), 'KB');
    
    // Upload to Lighthouse
    const lighthouseApiKey = process.env.LIGHTHOUSE_API_KEY;
    if (!lighthouseApiKey) {
      return res.status(500).json({ error: 'Lighthouse not configured' });
    }
    
    // Read file and create FormData for Lighthouse
    const fileBuffer = fs.readFileSync(file.filepath);
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: file.mimetype });
    formData.append('file', blob, file.originalFilename);
    
    const lighthouseResponse = await fetch('https://upload.lighthouse.storage/api/v0/add', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lighthouseApiKey}`,
      },
      body: formData,
    });
    
    // Clean up temp file
    fs.unlink(file.filepath, () => {});
    
    if (!lighthouseResponse.ok) {
      const error = await lighthouseResponse.text();
      console.error('Lighthouse error:', error);
      return res.status(500).json({ error: 'Failed to upload to IPFS' });
    }
    
    const lighthouseData = await lighthouseResponse.json();
    const cid = lighthouseData.Hash;
    
    return res.json({
      success: true,
      cid: cid,
      url: `https://gateway.lighthouse.storage/ipfs/${cid}`,
      ipfsUrl: `ipfs://${cid}`,
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message || 'Upload failed' });
  }
}
