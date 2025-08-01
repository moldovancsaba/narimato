'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { generateCardSVG, svgToDataUrl, optimizeFontSize, DEFAULT_CARD_CONFIG, SVGCardConfig } from '../lib/utils/svgGenerator';
import PageLayout from '../components/PageLayout'; // Import PageLayout

// Types for presets
interface FontPreset {
  _id?: string;
  name: string;
  value: string;
  url: string;
  isSystem?: boolean;
}

interface BackgroundPreset {
  _id?: string;
  name: string;
  value: string;
  isSystem?: boolean;
}

export default function CardEditorPage() {
  const [config, setConfig] = useState<SVGCardConfig>({
    ...DEFAULT_CARD_CONFIG,
    text: 'Sample Card Text',
  });

  const [backgroundPresets, setBackgroundPresets] = useState<BackgroundPreset[]>([]);
  const [fontPresets, setFontPresets] = useState<FontPreset[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(true);

  const [googleFontUrl, setGoogleFontUrl] = useState('');
  const [testFontName, setTestFontName] = useState('');
  const [isTestingFont, setIsTestingFont] = useState(false);

  // Load presets from database on component mount
  const loadPresets = useCallback(async () => {
    try {
      setIsLoadingPresets(true);
      
      // Initialize system presets if needed
      await fetch('/api/v1/presets/init', { method: 'POST' });
      
      // Load font presets
      const fontResponse = await fetch('/api/v1/presets/fonts');
      if (fontResponse.ok) {
        const fontData = await fontResponse.json();
        if (fontData.success) {
          setFontPresets(fontData.data);
        }
      }
      
      // Load background presets
      const backgroundResponse = await fetch('/api/v1/presets/backgrounds');
      if (backgroundResponse.ok) {
        const backgroundData = await backgroundResponse.json();
        if (backgroundData.success) {
          setBackgroundPresets(backgroundData.data);
        }
      }
    } catch (error) {
      console.error('Error loading presets:', error);
      setError('Failed to load presets from database');
    } finally {
      setIsLoadingPresets(false);
    }
  }, []);

  // Fix the setError dependency issue
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [isLoadingFont, setIsLoadingFont] = useState(false);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  const addBackgroundPreset = useCallback(async () => {
    try {
      const name = `Custom ${Date.now()}`;
      const value = config.backgroundColor || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      
      const response = await fetch('/api/v1/presets/backgrounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, value })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setBackgroundPresets(prev => [...prev, result.data]);
          setSuccess('Background preset saved successfully!');
        } else {
          setError(result.error || 'Failed to save background preset');
        }
      }
    } catch (error) {
      setError('Failed to save background preset');
    }
  }, [config.backgroundColor]);

  const removeBackgroundPreset = useCallback(async (name: string) => {
    try {
      const response = await fetch(`/api/v1/presets/backgrounds?name=${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setBackgroundPresets(prev => prev.filter(preset => preset.name !== name));
        setSuccess('Background preset deleted successfully!');
      } else {
        const result = await response.json();
        setError(result.error || 'Failed to delete background preset');
      }
    } catch (error) {
      setError('Failed to delete background preset');
    }
  }, []);

  const addFontPreset = useCallback(async () => {
    try {
      let name, value, url;
      
      if (testFontName) {
        name = testFontName;
        value = `\"${testFontName}\", sans-serif`;
        url = googleFontUrl;
      } else {
        name = `Custom ${Date.now()}`;
        value = config.fontFamily || 'Arial, sans-serif';
        url = '';
      }
      
      const response = await fetch('/api/v1/presets/fonts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, value, url })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setFontPresets(prev => [...prev, result.data]);
          setSuccess('Font preset saved successfully!');
          if (testFontName) {
            setTestFontName('');
            setGoogleFontUrl('');
          }
        } else {
          setError(result.error || 'Failed to save font preset');
        }
      }
    } catch (error) {
      setError('Failed to save font preset');
    }
  }, [config.fontFamily, testFontName, googleFontUrl]);

  const removeFontPreset = useCallback(async (name: string) => {
    try {
      setError('');
      const response = await fetch(`/api/v1/presets/fonts?name=${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        const currentPreset = fontPresets.find(p => p.value === config.fontFamily);
        if (currentPreset && currentPreset.name === name) {
          setConfig(prevConfig => ({ ...prevConfig, fontFamily: 'Arial, sans-serif' }));
        }
        setFontPresets(prev => prev.filter(preset => preset.name !== name));
        setSuccess('Font preset deleted successfully!');
      } else {
        setError(result.error || 'Failed to delete font preset');
      }
    } catch (error) {
      console.error('Delete font preset error:', error);
      setError('Failed to delete font preset');
    }
  }, [config.fontFamily, fontPresets]);
  
  const [pngDataUrl, setPngDataUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string>('');

  // Generate PNG preview using Canvas API with proper font loading
  const generatePngPreview = useCallback(async () => {
    try {
      setError('');
      
      if (!config.text.trim()) {
        setPngDataUrl('');
        return;
      }

      // Extract font name and load Google Font if needed
      const fontName = config.fontFamily?.split(',')[0].trim().replace(/[\"\']/g, '') || 'Arial';
      const currentFontPreset = fontPresets.find(preset => preset.value === config.fontFamily);
      const fontUrl = currentFontPreset?.url || '';
      
      // Load the font first if it's a Google Font
      if (fontUrl) {
        try {
          const existingLink = document.querySelector(`link[href=\"${fontUrl}\"]`);
          if (!existingLink) {
            const linkElement = document.createElement('link');
            linkElement.rel = 'preconnect';
            linkElement.href = 'https://fonts.googleapis.com';
            document.head.appendChild(linkElement);
            
            const linkElement2 = document.createElement('link');
            linkElement2.rel = 'preconnect';
            linkElement2.href = 'https://fonts.gstatic.com';
            linkElement2.crossOrigin = 'anonymous';
            document.head.appendChild(linkElement2);
            
            const fontLinkElement = document.createElement('link');
            fontLinkElement.rel = 'stylesheet';
            fontLinkElement.href = fontUrl;
            document.head.appendChild(fontLinkElement);
            
            // Wait for font to load using FontFace API
            await new Promise((resolve) => {
              if ('fonts' in document) {
                document.fonts.ready.then(() => {
                  // Additional delay to ensure font is available for canvas
                  setTimeout(resolve, 500);
                });
              } else {
                // Fallback for older browsers
                setTimeout(resolve, 2000);
              }
            });
          } else {
            // Font already loaded, small delay to ensure it's ready
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (fontError) {
          console.warn('Font loading failed for PNG, using fallback:', fontError);
        }
      } else if (!['Arial', 'Helvetica', 'Times', 'Georgia', 'Verdana'].includes(fontName)) {
        // Try to load as Google Font
        try {
          await loadGoogleFont(fontName);
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (fontError) {
          console.warn('Google Font loading failed for PNG, using fallback:', fontError);
        }
      }

      // Create canvas  
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('Failed to create canvas context');
        return;
      }

      // Set canvas size
      canvas.width = config.width || 300;
      canvas.height = config.height || 400;

      // Handle gradient background
      const backgroundColor = config.backgroundColor || '#ffffff';
      if (backgroundColor.includes('gradient')) {
        // Extract colors from gradient for simple rendering
        const colorMatches = backgroundColor.match(/#[a-fA-F0-9]{6}|#[a-fA-F0-9]{3}/g);
        if (colorMatches && colorMatches.length >= 2) {
          // Create a linear gradient
          const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
          gradient.addColorStop(0, colorMatches[0]);
          gradient.addColorStop(1, colorMatches[1]);
          ctx.fillStyle = gradient;
        } else {
          // Fallback to first color or default
          ctx.fillStyle = colorMatches ? colorMatches[0] : '#667eea';
        }
      } else {
        ctx.fillStyle = backgroundColor;
      }
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Set text properties
      const fontSize = config.fontSize || 24;
      const fontFamily = config.fontFamily || 'Arial, sans-serif';
      
      // Use a more specific font specification for Canvas
      const canvasFontFamily = fontUrl ? `\"${fontName}\", ${fontFamily}` : fontFamily;
      ctx.font = `${fontSize}px ${canvasFontFamily}`;
      ctx.fillStyle = config.textColor || '#000000';
      ctx.textAlign = (config.textAlign as CanvasTextAlign) || 'center';
      ctx.textBaseline = 'middle';

      // Calculate text position
      let x = canvas.width / 2;
      if (config.textAlign === 'left') {
        x = config.padding || 20;
        ctx.textAlign = 'left';
      } else if (config.textAlign === 'right') {
        x = canvas.width - (config.padding || 20);
        ctx.textAlign = 'right';
      }

      let y = canvas.height / 2;
      if (config.verticalAlign === 'top') {
        y = (config.padding || 20) + fontSize;
        ctx.textBaseline = 'top';
      } else if (config.verticalAlign === 'bottom') {
        y = canvas.height - (config.padding || 20);
        ctx.textBaseline = 'bottom';
      }

      // Draw text with proper line wrapping and containment
      const maxWidth = canvas.width - (2 * (config.padding || 20));
      const lines: string[] = [];
      
      // Split by manual line breaks first
      const manualLines = config.text.split('\\n');
      
      // For each manual line, check if it needs word wrapping
      manualLines.forEach(line => {
        if (ctx.measureText(line).width <= maxWidth) {
          lines.push(line);
        } else {
          // Word wrap this line
          const words = line.split(' ');
          let currentLine = '';
          
          words.forEach(word => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            if (ctx.measureText(testLine).width <= maxWidth) {
              currentLine = testLine;
            } else {
              if (currentLine) {
                lines.push(currentLine);
              }
              currentLine = word;
            }
          });
          
          if (currentLine) {
            lines.push(currentLine);
          }
        }
      });
      
      const lineHeight = fontSize * 1.2;
      const totalHeight = lines.length * lineHeight;
      
      // Adjust y position for multiple lines
      if (config.verticalAlign === 'middle') {
        y = (canvas.height - totalHeight) / 2 + fontSize / 2;
      } else if (config.verticalAlign === 'top') {
        y = (config.padding || 20) + fontSize;
      } else if (config.verticalAlign === 'bottom') {
        y = canvas.height - (config.padding || 20) - totalHeight + fontSize;
      }

      lines.forEach((line, index) => {
        ctx.fillText(line, x, y + (index * lineHeight));
      });

      // Convert to PNG data URL
      const dataUrl = canvas.toDataURL('image/png');
      setPngDataUrl(dataUrl);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PNG preview');
    }
  }, [config, fontPresets]);

  // Move declaration above useEffect to avoid using before declaration
  const loadGoogleFont = useCallback(async (fontName: string): Promise<void> => {
    // Clean up font name
    const cleanFontName = fontName.trim();
    
    // If already loaded, return immediately
    if (loadedFontsRef.current.has(cleanFontName)) {
      return Promise.resolve();
    }

    // If currently loading, return existing promise
    if (loadingPromisesRef.current.has(cleanFontName)) {
      return loadingPromisesRef.current.get(cleanFontName)!;
    }

    // Check if it's a system font
    const systemFonts = [
      'Arial', 'Helvetica', 'Times', 'Times New Roman', 'Courier', 'Courier New',
      'Verdana', 'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS',
      'Trebuchet MS', 'Arial Black', 'Impact', 'sans-serif', 'serif', 'monospace',
      'cursive', 'fantasy'
    ];
    
    if (systemFonts.includes(cleanFontName)) {
      loadedFontsRef.current.add(cleanFontName);
      return Promise.resolve();
    }

    // Check if link already exists in document
    const existingLink = document.querySelector(`link[href*="family=${cleanFontName.replace(/\s+/g, '+')}"]`);
    if (existingLink) {
      loadedFontsRef.current.add(cleanFontName);
      return Promise.resolve();
    }

    // Create new loading promise
    const loadingPromise = new Promise<void>((resolve, reject) => {
      setIsLoadingFont(true);
      
      const fontLink = document.createElement('link');
      fontLink.rel = 'stylesheet';
      fontLink.href = `https://fonts.googleapis.com/css2?family=${cleanFontName.replace(/\s+/g, '+')}:wght@300;400;500;600;700&display=swap`;
      
      const cleanup = () => {
        loadingPromisesRef.current.delete(cleanFontName);
        setIsLoadingFont(false);
      };
      
      fontLink.onload = () => {
        loadedFontsRef.current.add(cleanFontName);
        cleanup();
        resolve();
      };
      
      fontLink.onerror = () => {
        cleanup();
        reject(new Error(`Failed to load font: ${cleanFontName}`));
      };

      // Add timeout to prevent hanging
      setTimeout(() => {
        if (loadingPromisesRef.current.has(cleanFontName)) {
          cleanup();
          reject(new Error(`Font loading timeout: ${cleanFontName}`));
        }
      }, 10000);

      document.head.appendChild(fontLink);
    });

    // Store the promise
    loadingPromisesRef.current.set(cleanFontName, loadingPromise);
    
    return loadingPromise;
  }, []);

  // Ref to track loaded fonts and loading promises without causing re-render
  const loadedFontsRef = useRef(new Set<string>());
  const loadingPromisesRef = useRef(new Map<string, Promise<void>>());


  useEffect(() => {
    generatePngPreview();
  }, [generatePngPreview]);

  const handleUploadToImgBB = async () => {
    if (!pngDataUrl) {
      setError('No content to upload');
      return;
    }

    setIsUploading(true);
    setError('');
    setSuccess('');

    try {
      // Convert data URL to blob directly
      const response = await fetch(pngDataUrl);
      const blob = await response.blob();
      
      const formData = new FormData();
      formData.append('image', blob, `card-${Date.now()}.png`);
      formData.append('filename', `card-${Date.now()}`);

      const uploadResponse = await fetch('/api/v1/upload/imgbb', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const result = await uploadResponse.json();
      if (result.success) {
        setUploadedUrl(result.imageUrl);
        // Auto-fill the URL input field when upload is successful
        setConfig(prev => ({ ...prev, imageUrl: result.imageUrl }));
        setSuccess('Successfully uploaded to Imgbb!');
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload PNG');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveAsCard = async () => {
    // Use uploadedUrl if available, otherwise use the URL from config.imageUrl
    const imageUrl = uploadedUrl || config.imageUrl?.trim();
    
    if (!imageUrl) {
      setError('Please either upload an image or enter an image URL');
      return;
    }

    try {
      setError('');
      
      const response = await fetch('/api/v1/cards/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'media',
          content: { mediaUrl: imageUrl },
          title: config.text.substring(0, 50) + (config.text.length > 50 ? '...' : '') || 'Card from URL',
          tags: uploadedUrl ? ['svg-generated'] : ['url-generated'],
        }),
      });

      if (!response.ok) throw new Error('Failed to save card');
      
      setSuccess('Card saved successfully!');
      
      // Reset form
      setConfig({ ...DEFAULT_CARD_CONFIG, text: '', imageUrl: '' });
      setUploadedUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save card');
    }
  };

  const handleSaveCardFromUrl = async () => {
    if (!config.imageUrl || !config.imageUrl.trim()) {
      setError('Please enter an image URL');
      return;
    }

    try {
      setError('');
      
      const response = await fetch('/api/v1/cards/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'media',
          content: { mediaUrl: config.imageUrl },
          title: config.text.substring(0, 50) + (config.text.length > 50 ? '...' : '') || 'Card from URL',
          tags: ['url-generated'],
        }),
      });

      if (!response.ok) throw new Error('Failed to save card');
      
      setSuccess('Card saved successfully from URL!');
      
      // Reset form
      setConfig({ ...DEFAULT_CARD_CONFIG, text: '', imageUrl: '' });
      setUploadedUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save card');
    }
  };

  // Extract font name from Google Font URL
  const extractFontNameFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const familyParam = urlObj.searchParams.get('family');
      if (familyParam) {
        // Handle both simple and complex font families
        // e.g., "Space+Grotesk:wght@300..700" becomes "Space Grotesk"
        return familyParam.split(':')[0].replace(/\+/g, ' ');
      }
      return '';
    } catch {
      return '';
    }
  };

  // Load Google Font from URL and apply to preview
  const handleTestGoogleFont = useCallback(async () => {
    if (!googleFontUrl.trim()) {
      setError('Please enter a Google Font URL');
      return;
    }

    setIsTestingFont(true);
    setError('');

    try {
      // Extract font name from URL
      const fontName = extractFontNameFromUrl(googleFontUrl);
      if (!fontName) {
        throw new Error('Could not extract font name from URL. Please check the URL format.');
      }

      setTestFontName(fontName);

      // Create link element to load the font
      const linkElement = document.createElement('link');
      linkElement.rel = 'stylesheet';
      linkElement.href = googleFontUrl;

      // Remove existing test font links
      const existingTestLinks = document.querySelectorAll('link[data-test-font="true"]');
      existingTestLinks.forEach(link => link.remove());

      linkElement.setAttribute('data-test-font', 'true');
      
      linkElement.onload = () => {
        // Apply the font to the config for preview
        setConfig(prev => ({ ...prev, fontFamily: `\"${fontName}\", sans-serif` }));
        setIsTestingFont(false);
        setSuccess(`Font \"${fontName}\" loaded successfully! You can now save it as a preset.`);
      };
      
      linkElement.onerror = () => {
        setIsTestingFont(false);
        setError('Failed to load font from the provided URL. Please check if the URL is correct.');
      };

      document.head.appendChild(linkElement);

      // Timeout for loading
      setTimeout(() => {
        if (isTestingFont) {
          setIsTestingFont(false);
          setError('Font loading timeout. Please try again or check the URL.');
        }
      }, 10000);

    } catch (err) {
      setIsTestingFont(false);
      setError(err instanceof Error ? err.message : 'Failed to test font');
    }
  }, [googleFontUrl, isTestingFont]);


  return (
    <PageLayout title="Card Editor">
      <a 
        href="/cards" 
        className="btn btn-secondary mb-6"
      >
        Back to Cards
      </a>

      {error && (
        <div className="status-error p-4 mb-4 rounded-lg">{error}</div>
      )}

      {success && (
        <div className="status-success p-4 mb-4 rounded-lg">{success}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Editor Panel */}
        <div className="space-y-6">
          <div className="content-card">
            <h2 className="text-xl font-semibold mb-4">Card Content</h2>
            
            <div className="space-y-4">
              <div>
                <label className="form-label">Card Text</label>
                <textarea
                  value={config.text}
                  onChange={(e) => setConfig({ ...config, text: e.target.value })}
                  onFocus={(e) => {
                    if (e.target.value === 'Sample Card Text') {
                      setConfig({ ...config, text: '' });
                    }
                  }}
                  className="form-input"
                  rows={4}
                  placeholder="Enter your card text here..."
                />
              </div>
              <div>
                <label className="form-label">Card Image URL</label>
                <input
                  type="text"
                  value={config.imageUrl}
                  onChange={(e) => setConfig({ ...config, imageUrl: e.target.value })}
                  className="form-input"
                  placeholder="Enter image URL here..."
                />
              </div>
            </div>
          </div>

          <div className="content-card">
            <h2 className="text-xl font-semibold mb-4">Styling Options</h2>
            
            <div className="space-y-4">
              <div>
                <label className="form-label">Background</label>
                <select
                  value={config.backgroundColor}
                  onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
                  className="form-input"
                >
                  {backgroundPresets.map((preset) => (
                    <option key={preset.name} value={preset.value}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Font Family</label>
                <select
                  value={config.fontFamily}
                  onChange={(e) => setConfig({ ...config, fontFamily: e.target.value })}
                  className="form-input"
                  style={{ fontFamily: config.fontFamily }}
                >
                  {fontPresets.map((preset) => (
                    <option key={preset.name} value={preset.value} style={{ fontFamily: preset.value }}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </div>


              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Text Color</label>
                  <input
                    type="color"
                    value={config.textColor}
                    onChange={(e) => setConfig({ ...config, textColor: e.target.value })}
                    className="w-full h-10 border rounded form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Font Size ({config.fontSize === 0 ? 'Auto' : config.fontSize + 'px'})</label>
                  <input
                    type="range"
                    min="0"
                    max="96"
                    value={config.fontSize}
                    onChange={(e) => setConfig({ ...config, fontSize: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Text Alignment</label>
                  <select
                    value={config.textAlign}
                    onChange={(e) => setConfig({ ...config, textAlign: e.target.value as 'left' | 'center' | 'right' })}
                    className="form-input"
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Vertical Alignment</label>
                  <select
                    value={config.verticalAlign}
                    onChange={(e) => setConfig({ ...config, verticalAlign: e.target.value as 'top' | 'middle' | 'bottom' })}
                    className="form-input"
                  >
                    <option value="top">Top</option>
                    <option value="middle">Middle</option>
                    <option value="bottom">Bottom</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Card Width</label>
                  <input
                    type="number"
                    value={config.width}
                    onChange={(e) => setConfig({ ...config, width: parseInt(e.target.value) || 300 })}
                    className="form-input"
                    min="200"
                    max="600"
                  />
                </div>

                <div>
                  <label className="form-label">Card Height</label>
                  <input
                    type="number"
                    value={config.height}
                    onChange={(e) => setConfig({ ...config, height: parseInt(e.target.value) || 400 })}
                    className="form-input"
                    min="200"
                    max="800"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Padding</label>
                <input
                  type="range"
                  min="10"
                  max="50"
                  value={config.padding}
                  onChange={(e) => setConfig({ ...config, padding: parseInt(e.target.value) })}
                  className="w-full"
                />
                <span className="text-sm text-muted">{config.padding}px</span>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="space-y-6">
          <div className="content-card overflow-hidden">
            <h2 className="text-xl font-semibold mb-4">Live Preview</h2>
            
            <div className="flex justify-center items-center min-h-[400px] bg-gray-50 dark:bg-gray-800 rounded-lg p-4 overflow-hidden">
              {isLoadingFont ? (
                <div className="text-center">
                  <div className="loading-spinner mx-auto mb-2"></div>
                  <p>Loading font...</p>
                </div>
              ) : pngDataUrl ? (
                <div className="w-full h-full flex items-center justify-center">
                  <img 
                    src={pngDataUrl} 
                    alt="PNG Card Preview" 
                    className="max-w-full max-h-full object-contain shadow-lg rounded-lg"
                    style={{
                      maxWidth: 'min(100%, 300px)',
                      maxHeight: 'min(100%, 380px)',
                      width: 'auto',
                      height: 'auto'
                    }}
                  />
                </div>
              ) : (
                <div className="text-muted text-center">
                  <p>Enter text to see preview</p>
                </div>
              )}
            </div>
          </div>

          <div className="content-card">
            <h2 className="text-xl font-semibold mb-4">Actions (Reordered)</h2>

            <div className="space-y-4">
              <button
                onClick={handleUploadToImgBB}
                disabled={!pngDataUrl || isUploading}
                className="btn btn-primary w-full"
              >
                {isUploading ? 'Uploading...' : 'Upload to ImgBB'}
              </button>

              <div>
                <p className="text-sm text-muted mb-2">URL:</p>
                <input
                  type="text"
                  value={config.imageUrl}
                  onChange={(e) => setConfig({ ...config, imageUrl: e.target.value })}
                  className="form-input"
                  placeholder="Enter image URL or upload to fill this..."
                />
              </div>

              <button
                onClick={handleSaveAsCard}
                disabled={(!uploadedUrl && (!config.imageUrl || !config.imageUrl.trim()))}
                className="btn btn-success w-full"
              >
                {uploadedUrl ? 'Save Uploaded Card' : 'Save Card from URL'}
              </button>

              {pngDataUrl && (
                <div className="space-y-2">
                  <p className="text-sm text-muted">Download PNG:</p>
                  <a
                    href={pngDataUrl}
                    download={`card-${Date.now()}.png`}
                    className="btn btn-secondary w-full text-center"
                  >
                    Download PNG File
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Background Management */}
          <div className="content-card">
            <h2 className="text-xl font-semibold mb-4">Manage Backgrounds</h2>
            
            <div>
              <input
                type="text"
                value={config.backgroundColor}
                onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
                className="form-input"
                placeholder="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
              />
              <p className="text-xs text-muted mt-1">
                Example gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={addBackgroundPreset}
                  className="btn btn-sm btn-primary"
                >
                  Save Background
                </button>
              </div>
              <div className="mt-2 max-h-20 overflow-y-auto">
                {backgroundPresets.map((preset) => (
                  <div
                    key={preset.name}
                    className="flex justify-between items-center py-1 text-sm"
                  >
                    <span className="truncate mr-2">{preset.name}</span>
                    <button
                      onClick={() => removeBackgroundPreset(preset.name)}
                      className="btn btn-sm btn-danger"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Font Management */}
          <div className="content-card">
            <h2 className="text-xl font-semibold mb-4">Manage Fonts</h2>
            
            <div className="space-y-3">
              <div>
                <label className="form-label">Google Font URL:</label>
                <input
                  type="text"
                  value={googleFontUrl}
                  onChange={(e) => setGoogleFontUrl(e.target.value)}
                  className="form-input"
                  placeholder="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap"
                />
                <p className="text-xs text-muted mt-1">
                  Example: https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap
                </p>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={handleTestGoogleFont}
                  disabled={!googleFontUrl.trim() || isTestingFont}
                  className="btn btn-sm btn-accent"
                >
                  {isTestingFont ? 'Testing...' : 'Test Font'}
                </button>
                {testFontName && (
                  <button
                    onClick={addFontPreset}
                    className="btn btn-sm btn-success"
                  >
                    Save "{testFontName}" as Preset
                  </button>
                )}
              </div>
              
              {testFontName && (
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm">
                  <strong>Testing:</strong> {testFontName}
                  <div
                    className="mt-1 text-lg"
                    style={{ fontFamily: `\"${testFontName}\", sans-serif` }}
                  >
                    Sample text in {testFontName}
                  </div>
                </div>
              )}

              <div className="mt-4 max-h-20 overflow-y-auto">
                {fontPresets.map((preset) => (
                  <div key={preset.name} className="flex justify-between items-center py-1 text-sm">
                    <span className="truncate mr-2">{preset.name}</span>
                    <button
                      onClick={() => removeFontPreset(preset.name)}
                      className="btn btn-sm btn-danger"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Database Section */}
      <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
        <div className="content-card">
          <h2 className="text-xl font-semibold mb-4 text-red-600 dark:text-red-400">Danger Zone</h2>
          <p className="text-sm text-muted mb-4">
            This will permanently delete ALL cards, sessions, and progress data. This action cannot be undone.
          </p>
          <button
            onClick={async () => {
              if (!confirm('Are you sure you want to reset the database? This will delete ALL cards, sessions, and progress data.')) return;
              try {
                const response = await fetch('/api/v1/reset', { method: 'POST' });
                if (!response.ok) throw new Error('Failed to reset database');
                setSuccess('Database reset successfully!');
                setError('');
                // Reload presets after reset
                loadPresets();
              } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
                setError(errorMessage);
              }
            }}
            className="btn btn-danger"
          >
            Reset Database
          </button>
        </div>
      </div>
    </PageLayout>
  );
}
