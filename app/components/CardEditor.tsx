import React, { useState } from 'react';
import { generateCardSVG, svgToDataUrl, optimizeFontSize } from '../lib/utils/svgGenerator';
import { uploadPngToImgBBWithRetry } from '../lib/services/imgbbService';

const CardEditor = () => {
  const [text, setText] = useState('');
  const [svgUrl, setSvgUrl] = useState<string | null>(null);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const handleGenerateSVG = async () => {
    try {
      setError(null);

      // Generate SVG
      const fontSize = optimizeFontSize(text, 260, 360); // example sizes
      const svg = generateCardSVG({
        text,
        fontSize,
        width: 300,
        height: 400
      });
      const svgDataUrl = svgToDataUrl(svg);
      setSvgUrl(svgDataUrl);

      // Convert SVG to PNG and upload to ImgBB
      const canvas = document.createElement('canvas');
      const img = new Image();
      img.src = svgDataUrl;
      
      img.onload = async () => {
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        
        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              const uploadedUrl = await uploadPngToImgBBWithRetry(blob, `card-${Date.now()}`);
              setUploadUrl(uploadedUrl);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to upload PNG');
            }
          }
        }, 'image/png');
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <div>
      <h1>Card Editor</h1>
      <div>
        <textarea
          rows={5}
          value={text}
          onChange={handleTextChange}
          placeholder="Enter your card text here..."
        />
        <button onClick={handleGenerateSVG}>Generate SVG</button>
      </div>
      {svgUrl && (
        <div>
          <h2>Preview</h2>
          <img src={svgUrl} alt="Card Preview" />
        </div>
      )}

      {uploadUrl && (
        <div>
          <h2>Upload URL</h2>
          <a href={uploadUrl} target="_blank" rel="noopener noreferrer">
            {uploadUrl}
          </a>
        </div>
      )}

      {error && (
        <div style={{ color: 'red' }}>
          Error: {error}
        </div>
      )}
    </div>
  );
};

export default CardEditor;
