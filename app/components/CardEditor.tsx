import React, { useState, useCallback } from 'react';
import { generateCardSVG, svgToDataUrl, optimizeFontSize } from '../lib/utils/svgGenerator';
import { uploadPngToImgBBWithRetry } from '../lib/services/imgbbService';

const CardEditor = () => {
  const [text, setText] = useState('');
  const [svgUrl, setSvgUrl] = useState<string | null>(null);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  }, []);

  const handleGenerateSVG = useCallback(async () => {
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
  }, [text]);

  return (
    <div className="bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 page-height-full">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">Card Editor</h1>
          
          <div className="space-y-6">
            <div>
              <label htmlFor="card-text" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Card Text
              </label>
              <textarea
                id="card-text"
                rows={5}
                value={text}
                onChange={handleTextChange}
                placeholder="Enter your card text here..."
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
              />
            </div>
            
            <button 
              onClick={handleGenerateSVG}
              className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              Generate SVG
            </button>
          </div>

          {svgUrl && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Preview</h2>
              <div className="flex justify-center p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <img 
                  src={svgUrl} 
                  alt="Card Preview" 
                  className="max-w-full max-h-96 object-contain rounded-lg shadow-md"
                />
              </div>
            </div>
          )}

          {uploadUrl && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Upload URL</h2>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <a 
                  href={uploadUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 break-all underline"
                >
                  {uploadUrl}
                </a>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center">
                <div className="text-red-700 dark:text-red-400">
                  <span className="font-medium">Error:</span> {error}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CardEditor;
