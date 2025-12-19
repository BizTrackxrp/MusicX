/**
 * XRP Music - Upload JSON API
 * Upload JSON metadata to IPFS via Lighthouse
 */

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
    const { data, name } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'No data provided' });
    }
    
    const lighthouseApiKey = process.env.LIGHTHOUSE_API_KEY;
    if (!lighthouseApiKey) {
      return res.status(500).json({ error: 'Lighthouse not configured' });
    }
    
    // Create JSON file as blob and upload to Lighthouse
    const jsonString = JSON.stringify(data);
    const formData = new FormData();
    const blob = new Blob([jsonString], { type: 'application/json' });
    formData.append('file', blob, name || 'metadata.json');
    
    const lighthouseResponse = await fetch('https://upload.lighthouse.storage/api/v0/add', {
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
    console.error('Upload JSON error:', error);
    return res.status(500).json({ error: 'Upload failed' });
  }
}
