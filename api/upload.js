/**
 * XRP Music - Upload API
 * Upload files to IPFS via Lighthouse (with optional Filecoin backing)
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
    const form = formidable({ 
      maxFileSize: 50 * 1024 * 1024,
      keepExtensions: true,
    });
    
    const [fields, files] = await form.parse(req);
    const file = files.file?.[0];
    
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    // ← THIS IS THE ONLY NEW LOGIC
    const contentType = fields.contentType?.[0] || '';
    const useFilecoin = ['audiobook', 'podcast', 'film'].includes(contentType);
    // ← END NEW LOGIC
    
    console.log('Uploading:', file.originalFilename, Math.round(file.size / 1024), 'KB', useFilecoin ? '(Filecoin)' : '(IPFS)');
    
    const lighthouseApiKey = process.env.LIGHTHOUSE_API_KEY;
    if (!lighthouseApiKey) {
      return res.status(500).json({ error: 'Lighthouse not configured' });
    }
    
    const fileBuffer = fs.readFileSync(file.filepath);
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: file.mimetype });
    formData.append('file', blob, file.originalFilename);
    
    // ← THIS IS THE ONLY OTHER CHANGE
    let uploadUrl = 'https://upload.lighthouse.storage/api/v0/add';
    if (useFilecoin) {
      uploadUrl += '?network=filecoin';
    }
    // ← END CHANGE
    
    const lighthouseResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lighthouseApiKey}`,
      },
      body: formData,
    });
    
    fs.unlink(file.filepath, () => {});
    
    if (!lighthouseResponse.ok) {
      const error = await lighthouseResponse.text();
      console.error('Lighthouse error:', error);
      return res.status(500).json({ error: 'Failed to upload' });
    }
    
    const lighthouseData = await lighthouseResponse.json();
    const cid = lighthouseData.Hash;
    
    return res.json({
      success: true,
      cid: cid,
      url: `https://gateway.lighthouse.storage/ipfs/${cid}`,
      ipfsUrl: `ipfs://${cid}`,
      storage: useFilecoin ? 'filecoin' : 'ipfs',  // ← Just for logging
      filecoinDeal: lighthouseData.dealId || null,
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message || 'Upload failed' });
  }
}
