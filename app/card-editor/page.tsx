'use client';

import React, { useState, useCallback, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { useOrganization } from '@/app/components/OrganizationProvider';
import PageLayout from '../components/PageLayout';
import HashtagSelector from '../components/HashtagSelector';

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

// Card interface for new hashtag-based model
interface Card {
  uuid: string;
  name: string; // #HASHTAG
  body: {
    imageUrl?: string;
    textContent?: string;
    background?: {
      type: 'color' | 'gradient' | 'pattern';
      value: string;
      textColor?: string;
    };
  };
  cardSize?: string; // Card size in "width:height" format (e.g., "300:400")
  hashtags: string[]; // Parent relationships
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function CardEditor() {
  const router = useRouter();
  const { currentOrganization, isLoading: orgLoading } = useOrganization();
  const searchParams = useSearchParams();
  const cardUuid = searchParams.get('uuid');
  const isEditing = Boolean(cardUuid);
  
  // Show organization info prominently
  const orgDisplayName = currentOrganization?.OrganizationName || 'Loading...';
  const orgUuid = currentOrganization?.OrganizationUUID || 'Unknown';
  
  // 1st Column - General Information
  const [cardName, setCardName] = useState(''); // #hashtag - required
  const [cardUUID, setCardUUID] = useState(cardUuid || uuidv4()); // UUID - immediately generated
  const [cardHashtags, setCardHashtags] = useState<string[]>([]); // list of #hashtags
  const [hashtagSuggestions, setHashtagSuggestions] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');
  
  // Body fields
  const [imageUrl, setImageUrl] = useState(''); // img url - not required
  const [textContent, setTextContent] = useState(''); // text - not required
  const [cssBackground, setCssBackground] = useState('linear-gradient(135deg, #667eea 0%, #764ba2 100%)'); // css bg - default
  const [cardSize, setCardSize] = useState('300:400'); // card size - width:height format
  const [imageWidth, setImageWidth] = useState(0);
  const [imageHeight, setImageHeight] = useState(0);
  
  // Typography
  const [selectedFont, setSelectedFont] = useState('Arial, sans-serif');
  const [fontSize, setFontSize] = useState(24); // max 192px
  const [padding, setPadding] = useState(20); // max 192px
  const [textColor, setTextColor] = useState('#000000'); // hex with transparency
  const [horizontalAlign, setHorizontalAlign] = useState<'left' | 'center' | 'right'>('center');
  const [verticalAlign, setVerticalAlign] = useState<'top' | 'middle' | 'bottom'>('middle');
  
  // 2nd Column - Live Preview & Actions
  const [pngDataUrl, setPngDataUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState('');
  
  // 3rd Column - Management
  const [backgroundPresets, setBackgroundPresets] = useState<BackgroundPreset[]>([]);
  const [fontPresets, setFontPresets] = useState<FontPreset[]>([]);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [childrenCards, setChildrenCards] = useState<Card[]>([]);
  
  // CSS Background Management
  const [cssInput, setCssInput] = useState('');
  const [cssBgName, setCssBgName] = useState('');
  
  // Font Management
  const [fontInput, setFontInput] = useState(''); // Google font URL
  const [fontName, setFontName] = useState('');
  
  // Children Cards Management
  const [cardSearchQuery, setCardSearchQuery] = useState('');
  const [cardSearchSuggestions, setCardSearchSuggestions] = useState<Card[]>([]);
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

// Load initial data and handle URL change
  useEffect(() => {
    // Only load initial data when organization is ready
    if (!orgLoading && currentOrganization) {
      loadInitialData();
    }
  }, [cardUuid, currentOrganization, orgLoading]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Load presets
      if (!currentOrganization) {
        setError('Please select an organization');
        setLoading(false);
        return;
      }

      await fetch('/api/v1/presets/init', {
        method: 'POST',
        headers: {
          'X-Organization-UUID': currentOrganization.OrganizationUUID
        }
      });
      
      const [fontResponse, backgroundResponse, cardsResponse] = await Promise.all([
        fetch('/api/v1/presets/fonts', {
          headers: {
            'X-Organization-UUID': currentOrganization.OrganizationUUID
          }
        }),
        fetch('/api/v1/presets/backgrounds', {
          headers: {
            'X-Organization-UUID': currentOrganization.OrganizationUUID
          }
        }),
        fetch('/api/v1/cards', {
          headers: {
            'X-Organization-UUID': currentOrganization.OrganizationUUID
          }
        })
      ]);
      
      if (fontResponse.ok) {
        const fontData = await fontResponse.json();
        if (fontData.success) {
          setFontPresets(fontData.data);
        }
      }
      
      if (backgroundResponse.ok) {
        const backgroundData = await backgroundResponse.json();
        if (backgroundData.success) {
          setBackgroundPresets(backgroundData.data);
        }
      }
      
      if (cardsResponse.ok) {
        const cardsData = await cardsResponse.json();
        if (cardsData.success) {
          setAllCards(cardsData.cards);
        }
      }
      
      // If editing, load card data
      if (isEditing && cardUuid) {
        const cardResponse = await fetch(`/api/v1/cards/${cardUuid}`, {
          headers: {
            'X-Organization-UUID': currentOrganization.OrganizationUUID
          }
        });
        if (cardResponse.ok) {
          const cardData = await cardResponse.json();
          if (cardData.success && cardData.card) {
            const card = cardData.card;
            setCardName(card.name || '');
            setCardHashtags(card.hashtags || []);
            setImageUrl(card.body?.imageUrl || '');
            setTextContent(card.body?.textContent || '');
            setCssBackground(card.body?.background?.value || cssBackground);
            setCardSize(card.cardSize || '300:400'); // Load saved card size from database
            
            // Find children cards
            const children = allCards.filter(c => c.hashtags.includes(card.name));
            setChildrenCards(children);
          }
        }
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

// Generate SVG and PNG preview
const generatePreview = useCallback(async () => {
    try {
      const [width, height] = cardSize.split(':').map(n => parseInt(n) || 300);
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw background
      if (imageUrl && imageUrl.trim()) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          await new Promise((resolve, reject) => {
img.onload = () => {
  setImageWidth(img.naturalWidth);
  setImageHeight(img.naturalHeight);
  setCardSize(`${img.naturalWidth}:${img.naturalHeight}`);
  resolve(img);
};
            img.onerror = reject;
            img.src = imageUrl;
          });
          
          // Draw image with cover behavior
          const imgAspect = img.width / img.height;
          const canvasAspect = canvas.width / canvas.height;
          
          let drawWidth, drawHeight, drawX, drawY;
          
          if (imgAspect > canvasAspect) {
            drawHeight = canvas.height;
            drawWidth = drawHeight * imgAspect;
            drawX = (canvas.width - drawWidth) / 2;
            drawY = 0;
          } else {
            drawWidth = canvas.width;
            drawHeight = drawWidth / imgAspect;
            drawX = 0;
            drawY = (canvas.height - drawHeight) / 2;
          }
          
          ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        } catch {
          // Fallback to CSS background
          drawCssBackground();
        }
      } else {
        drawCssBackground();
      }
      
      function drawCssBackground() {
        if (!ctx) return;
        
        if (cssBackground.includes('gradient')) {
          const colorMatches = cssBackground.match(/#[a-fA-F0-9]{6}|#[a-fA-F0-9]{3}/g);
          if (colorMatches && colorMatches.length >= 2) {
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, colorMatches[0]);
            gradient.addColorStop(1, colorMatches[1]);
            ctx.fillStyle = gradient;
          } else {
            ctx.fillStyle = colorMatches ? colorMatches[0] : '#667eea';
          }
        } else {
          ctx.fillStyle = cssBackground;
        }
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      // Draw text if provided
      if (textContent && textContent.trim()) {
        ctx.font = `${fontSize}px ${selectedFont}`;
        ctx.fillStyle = textColor;
        ctx.textAlign = horizontalAlign as CanvasTextAlign;
        ctx.textBaseline = verticalAlign === 'top' ? 'top' : verticalAlign === 'bottom' ? 'bottom' : 'middle';
        
        let x = canvas.width / 2;
        if (horizontalAlign === 'left') {
          x = padding;
          ctx.textAlign = 'left';
        } else if (horizontalAlign === 'right') {
          x = canvas.width - padding;
          ctx.textAlign = 'right';
        }
        
        let y = canvas.height / 2;
        if (verticalAlign === 'top') {
          y = padding + fontSize;
        } else if (verticalAlign === 'bottom') {
          y = canvas.height - padding;
        }
        
        // Word wrap
        const maxWidth = canvas.width - (2 * padding);
        const words = textContent.split(' ');
        const lines: string[] = [];
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
        
        const lineHeight = fontSize * 1.2;
        
        if (verticalAlign === 'middle') {
          y = (canvas.height - lines.length * lineHeight) / 2 + fontSize / 2;
        }
        
        lines.forEach((line, index) => {
          ctx.fillText(line, x, y + (index * lineHeight));
        });
      }
      
      const dataUrl = canvas.toDataURL('image/png');
      setPngDataUrl(dataUrl);
      
    } catch (err) {
      console.error('Failed to generate preview:', err);
    }
  }, [cardSize, imageUrl, cssBackground, textContent, selectedFont, fontSize, textColor, horizontalAlign, verticalAlign, padding]);

  useEffect(() => {
    generatePreview();
  }, [generatePreview]);

  // Detect image dimensions when image URL changes
  useEffect(() => {
    if (!imageUrl || !imageUrl.trim()) {
      setImageWidth(0);
      setImageHeight(0);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImageWidth(img.naturalWidth);
      setImageHeight(img.naturalHeight);
      // Only update cardSize if we're not editing (to preserve saved aspect ratios)
      if (!isEditing) {
        setCardSize(`${img.naturalWidth}:${img.naturalHeight}`);
      }
    };
    img.onerror = () => {
      console.error('Failed to load image for dimension detection:', imageUrl);
      setImageWidth(0);
      setImageHeight(0);
    };
    img.src = imageUrl;
  }, [imageUrl, isEditing]);

  // Get hashtag suggestions
  const getHashtagSuggestions = useCallback((query: string) => {
    if (!query.trim()) return [];
    const suggestions = allCards
      .map(card => card.name)
      .filter(name => name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 10);
    return suggestions;
  }, [allCards]);

  // Handle hashtag input change
  const handleHashtagInputChange = (value: string) => {
    setHashtagInput(value);
    setHashtagSuggestions(getHashtagSuggestions(value));
  };

  // Add hashtag
  const addHashtag = (hashtag: string) => {
    if (!cardHashtags.includes(hashtag)) {
      setCardHashtags(prev => [...prev, hashtag]);
    }
    setHashtagInput('');
    setHashtagSuggestions([]);
  };

  // Remove hashtag
  const removeHashtag = (hashtag: string) => {
    setCardHashtags(prev => prev.filter(h => h !== hashtag));
  };

  // Generate action - export PNG, upload to imgbb, create card
  const handleGenerate = async () => {
    if (!pngDataUrl || !cardName.trim()) {
      setError('Card name is required');
      return;
    }

    setIsUploading(true);
    setError('');
    setSuccess('');

    try {
      // Convert PNG to blob and upload to ImgBB
      const response = await fetch(pngDataUrl);
      const blob = await response.blob();
      
      const formData = new FormData();
      formData.append('image', blob, `card-${Date.now()}.png`);

      const uploadResponse = await fetch('/api/v1/upload/imgbb', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const uploadResult = await uploadResponse.json();
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      setUploadedUrl(uploadResult.imageUrl);

      // Create card with all data
      const cardResponse = await fetch('/api/v1/cards/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-UUID': currentOrganization?.OrganizationUUID || 'default'
        },
        body: JSON.stringify({
          name: cardName.startsWith('#') ? cardName : `#${cardName}`,
          uuid: cardUUID,
          body: {
            imageUrl: uploadResult.imageUrl,
            textContent: textContent || undefined,
            background: {
              type: 'gradient',
              value: cssBackground,
              textColor: textColor
            }
          },
          hashtags: cardHashtags,
          cardSize: cardSize, // Include cardSize for persistence
          isActive: true
        }),
      });

      if (!cardResponse.ok) {
        throw new Error('Failed to create card');
      }

      const cardResult = await cardResponse.json();
      if (cardResult.success) {
        setSuccess('Card generated and saved successfully!');
        if (!isEditing) {
          // Reset form for new card
          setCardName('');
          setTextContent('');
          setImageUrl('');
          setCardHashtags([]);
          setCardUUID(uuidv4());
        }
      } else {
        throw new Error(cardResult.error || 'Failed to create card');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate card');
    } finally {
      setIsUploading(false);
    }
  };

  // Save card size changes
  const handleSaveCardSize = async () => {
    if (!isEditing || !cardUuid) {
      setError('Cannot save card size - not in editing mode');
      return;
    }

    try {
      setError('');
      
      const response = await fetch(`/api/v1/cards/${cardUuid}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-UUID': currentOrganization?.OrganizationUUID || 'default'
        },
        body: JSON.stringify({
          cardSize: cardSize // Save only card size
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save card size');
      }

      const result = await response.json();
      if (result.success) {
        setSuccess('Card size saved successfully!');
      } else {
        throw new Error(result.error || 'Failed to save card size');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save card size');
    }
  };

  // Update action - modify only name and hashtags
  const handleUpdate = async () => {
    if (!isEditing || !cardUuid || !cardName.trim()) {
      setError('Card name is required');
      return;
    }

    try {
      setError('');
      
      const response = await fetch(`/api/v1/cards/${cardUuid}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-UUID': currentOrganization?.OrganizationUUID || 'default'
        },
        body: JSON.stringify({
          name: cardName.startsWith('#') ? cardName : `#${cardName}`,
          hashtags: cardHashtags,
          cardSize: cardSize // Include cardSize for persistence
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update card');
      }

      const result = await response.json();
      if (result.success) {
        setSuccess('Card updated successfully!');
      } else {
        throw new Error(result.error || 'Failed to update card');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update card');
    }
  };

  // ImgOnly action - use image URL directly
  const handleImgOnly = async () => {
    if (!imageUrl.trim() || !cardName.trim()) {
      setError('Card name and image URL are required');
      return;
    }

    try {
      setError('');
      
      const endpoint = isEditing ? `/api/v1/cards/${cardUuid}` : '/api/v1/cards/add';
      const method = isEditing ? 'PATCH' : 'POST';
      
      const requestBody: any = {
        name: cardName.startsWith('#') ? cardName : `#${cardName}`,
        body: {
          imageUrl: imageUrl,
          textContent: textContent || undefined,
          background: {
            type: 'gradient',
            value: cssBackground,
            textColor: textColor
          }
        },
        hashtags: cardHashtags,
        cardSize: cardSize, // Include cardSize for persistence
        isActive: true
      };
      
      if (!isEditing) {
        requestBody.uuid = cardUUID;
      }
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-UUID': currentOrganization?.OrganizationUUID || 'default'
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${isEditing ? 'update' : 'save'} card`);
      }

      const result = await response.json();
      if (result.success) {
        setSuccess(`Card ${isEditing ? 'updated' : 'saved'} successfully!`);
        if (!isEditing) {
          // Reset form for new card
          setCardName('');
          setTextContent('');
          setImageUrl('');
          setCardHashtags([]);
          setCardUUID(uuidv4());
        }
      } else {
        throw new Error(result.error || `Failed to ${isEditing ? 'update' : 'save'} card`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEditing ? 'update' : 'save'} card`);
    }
  };

  // Save CSS background
  const handleSaveCssBackground = async () => {
    if (!cssBgName.trim()) {
      setError('CSS background name is required');
      return;
    }

    try {
      const response = await fetch('/api/v1/presets/backgrounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: cssBgName, 
          value: cssInput || cssBackground 
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setBackgroundPresets(prev => [...prev, result.data]);
          setSuccess('CSS background saved successfully!');
          setCssBgName('');
          setCssInput('');
        } else {
          setError(result.error || 'Failed to save CSS background');
        }
      }
    } catch (error) {
      setError('Failed to save CSS background');
    }
  };

  // Delete CSS background
  const handleDeleteCssBackground = async (name: string) => {
    try {
      const response = await fetch(`/api/v1/presets/backgrounds?name=${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setBackgroundPresets(prev => prev.filter(preset => preset.name !== name));
        setSuccess('CSS background deleted successfully!');
      } else {
        const result = await response.json();
        setError(result.error || 'Failed to delete CSS background');
      }
    } catch (error) {
      setError('Failed to delete CSS background');
    }
  };

  // Save font
  const handleSaveFont = async () => {
    if (!fontName.trim() || !fontInput.trim()) {
      setError('Font name and URL are required');
      return;
    }

    try {
      const response = await fetch('/api/v1/presets/fonts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: fontName, 
          value: `"${fontName}", sans-serif`,
          url: fontInput 
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setFontPresets(prev => [...prev, result.data]);
          setSuccess('Font saved successfully!');
          setFontName('');
          setFontInput('');
        } else {
          setError(result.error || 'Failed to save font');
        }
      }
    } catch (error) {
      setError('Failed to save font');
    }
  };

  // Delete font
  const handleDeleteFont = async (name: string) => {
    try {
      const response = await fetch(`/api/v1/presets/fonts?name=${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setFontPresets(prev => prev.filter(preset => preset.name !== name));
        setSuccess('Font deleted successfully!');
      } else {
        const result = await response.json();
        setError(result.error || 'Failed to delete font');
      }
    } catch (error) {
      setError('Failed to delete font');
    }
  };

  const handleBack = () => {
    router.push('/cards');
  };
  
  // Show loading while organization context or editor are loading
  if (orgLoading || loading) {
    return (
      <div className="flex items-center justify-center page-height">
        <div className="loading-spinner"></div>
        <span className="ml-2 text-lg">
          {orgLoading ? 'Loading organization...' : 'Loading card editor...'}
        </span>
      </div>
    );
  }

  // Show error if no organization is available
  if (!currentOrganization) {
    return (
      <PageLayout title="Card Editor">
        <div className="status-error p-4 mb-4 rounded-lg">
          No organization selected. Please select an organization to use the card editor.
        </div>
      </PageLayout>
    );
  }
  
  return (
    <PageLayout title={isEditing ? `Edit Card - ${cardUUID}` : "Card Editor"}>
      <button 
        onClick={handleBack}
        className="btn btn-secondary mb-6"
      >
        Back to Cards
      </button>

      {error && (
        <div className="status-error p-4 mb-4 rounded-lg">{error}</div>
      )}

      {success && (
        <div className="status-success p-4 mb-4 rounded-lg">{success}</div>
      )}

      {/* Display current organization */}
      <div className="bg-gray-100 dark:bg-gray-800 text-lg font-medium mb-6 p-4 rounded-lg shadow-sm">
        Currently editing for organization: <span className="font-bold">{orgDisplayName}</span> ({orgUuid})
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1st Column: General Information & Typography */}
        <div className="space-y-6">
        {/* General */}
        <div className="content-card">
          <h2 className="text-xl font-semibold mb-4">General</h2>
          
            <div className="space-y-4">
              {/* Card Name #hashtag (required) */}
              <div>
                <label className="form-label">Name (required)</label>
                <input
                  type="text"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  className="form-input"
                  placeholder="#my-card-name"
                />
                <p className="text-xs text-muted mt-1">Must start with # to be a hashtag</p>
              </div>

              {/* Card UUID (auto-generated, required) */}
              <div>
                <label className="form-label">Card UUID (automatically generated)</label>
                <input
                  type="text"
                  value={cardUUID}
                  readOnly
                  className="form-input cursor-not-allowed"
                />
              </div>

              {/* Hashtags with unified component */}
              <HashtagSelector
                availableHashtags={allCards.map(card => card.name)}
                selectedHashtags={cardHashtags}
                onHashtagsChange={setCardHashtags}
                label="Hashtags (top 10 suggestions)"
                placeholder="Search for hashtags..."
                maxSuggestions={10}
                excludeSelected={true}
              />
            </div>
          </div>

          {/* Body */}
          <div className="content-card">
            <h2 className="text-xl font-semibold mb-4">Body</h2>
            
            <div className="space-y-4">
              {/* Image URL (optional) */}
              <div>
                <label className="form-label">Img URL (optional)</label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="form-input"
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              {/* Text (optional) */}
              <div>
                <label className="form-label">Text (optional)</label>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  className="form-input"
                  rows={3}
                  placeholder="Enter text content..."
                />
              </div>

              {/* CSS Background (optional with default) */}
              <div>
                <label className="form-label">CSS BG (optional, default selected)</label>
                <select
                  value={cssBackground}
                  onChange={(e) => setCssBackground(e.target.value)}
                  className="form-input"
                >
                  {backgroundPresets.map((preset) => (
                    <option key={preset.name} value={preset.value}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Card Size (width:height format) with save button */}
              <div>
                <label className="form-label">Card Size (width:height)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={cardSize}
                    onChange={(e) => setCardSize(e.target.value)}
                    className="form-input flex-1"
                    placeholder="300:400"
                  />
                  {isEditing && (
                    <button
                      onClick={handleSaveCardSize}
                      className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm whitespace-nowrap"
                      title="Save card size to database"
                    >
                      Save Size
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted mt-1">
                  Format: width:height (e.g., 300:400). {isEditing ? 'Click "Save Size" to persist changes.' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Typography */}
          <div className="content-card">
            <h2 className="text-xl font-semibold mb-4">Typography</h2>
            
            <div className="space-y-4">
              {/* Font selection */}
              <div>
                <label className="form-label">Font</label>
                <select
                  value={selectedFont}
                  onChange={(e) => setSelectedFont(e.target.value)}
                  className="form-input"
                  style={{ fontFamily: selectedFont }}
                >
                  {fontPresets.map((preset) => (
                    <option key={preset.name} value={preset.value} style={{ fontFamily: preset.value }}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Font size slider (max 192px) */}
              <div>
                <label className="form-label">Font Size ({fontSize}px)</label>
                <input
                  type="range"
                  min="8"
                  max="192"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Padding slider (max 192px) */}
              <div>
                <label className="form-label">Padding ({padding}px)</label>
                <input
                  type="range"
                  min="0"
                  max="192"
                  value={padding}
                  onChange={(e) => setPadding(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Text color with transparency */}
              <div>
                <label className="form-label">Text Color</label>
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-full h-10 border rounded form-input"
                />
              </div>

              {/* Horizontal alignment */}
              <div>
                <label className="form-label">Text Horizontal Alignment</label>
                <select
                  value={horizontalAlign}
                  onChange={(e) => setHorizontalAlign(e.target.value as 'left' | 'center' | 'right')}
                  className="form-input"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>

              {/* Vertical alignment */}
              <div>
                <label className="form-label">Text Vertical Alignment</label>
                <select
                  value={verticalAlign}
                  onChange={(e) => setVerticalAlign(e.target.value as 'top' | 'middle' | 'bottom')}
                  className="form-input"
                >
                  <option value="top">Top</option>
                  <option value="middle">Middle</option>
                  <option value="bottom">Bottom</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* 2nd Column: Live Preview & Record Actions */}
        <div className="space-y-6">
          {/* Live Preview */}
          <div className="content-card">
            <h2 className="text-xl font-semibold mb-4">Live Preview</h2>
            
            <div className="preview-container min-h-[400px] flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
              {pngDataUrl ? (
                <img 
                  src={pngDataUrl} 
                  alt="Card Preview" 
                  className="max-w-full max-h-full object-contain shadow-lg rounded-lg"
                />
              ) : (
                <div className="text-muted text-center">
                  <p>Preview will appear here</p>
                </div>
              )}
            </div>
          </div>

          {/* Record Actions */}
          <div className="content-card">
            <h2 className="text-xl font-semibold mb-4">Record</h2>

            <div className="space-y-3">
              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={!cardName.trim() || isUploading}
                className="btn btn-primary w-full"
              >
                🎨 {isUploading ? 'Generating...' : 'Generate'}
              </button>
              <p className="text-xs text-muted">Exports live preview to PNG, uploads to imgbb.com, creates card with all data</p>

              {/* Update Button (only for editing) */}
              {isEditing && (
                <>
                  <button
                    onClick={handleUpdate}
                    disabled={!cardName.trim()}
                    className="btn btn-accent w-full"
                  >
                    ✏️ Update
                  </button>
                  <p className="text-xs text-muted">Modifies only card name and hashtags, does not change visual</p>
                </>
              )}

              {/* ImgOnly Button */}
              <button
                onClick={handleImgOnly}
                disabled={!cardName.trim() || !imageUrl.trim()}
                className="btn btn-success w-full"
              >
                🔗 ImgOnly
              </button>
              <p className="text-xs text-muted">Uses image URL directly as card visual and creates card with info</p>

              {/* Generated URL Display */}
              {uploadedUrl && (
                <div className="mt-4">
                  <p className="text-sm text-muted mb-2">Generated Image URL:</p>
                  <input
                    type="text"
                    value={uploadedUrl}
                    readOnly
                    className="form-input cursor-not-allowed"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3rd Column: Management Features */}
        <div className="space-y-6">
          {/* Manage CSS BG */}
          <div className="content-card">
            <h2 className="text-xl font-semibold mb-4">Manage CSS BG</h2>
            
            <div className="space-y-3">
              <div>
                <label className="form-label">CSS Input</label>
                <input
                  type="text"
                  value={cssInput}
                  onChange={(e) => setCssInput(e.target.value)}
                  className="form-input"
                  placeholder="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                />
              </div>
              
              <div>
                <label className="form-label">CSS BG Name</label>
                <input
                  type="text"
                  value={cssBgName}
                  onChange={(e) => setCssBgName(e.target.value)}
                  className="form-input"
                  placeholder="My Background"
                />
              </div>
              
              <button
                onClick={handleSaveCssBackground}
                disabled={!cssBgName.trim()}
                className="btn btn-primary w-full"
              >
                Save to List
              </button>
              
              {/* CSS List */}
              <div className="max-h-32 overflow-y-auto">
                <h3 className="text-sm font-medium mb-2">CSS List</h3>
                {backgroundPresets.map((preset) => (
                  <div key={preset.name} className="flex justify-between items-center py-1 text-sm">
                    <span className="truncate mr-2">{preset.name}</span>
                    <button
                      onClick={() => handleDeleteCssBackground(preset.name)}
                      className="btn btn-sm btn-danger"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Manage Fonts */}
          <div className="content-card">
            <h2 className="text-xl font-semibold mb-4">Manage Fonts</h2>
            
            <div className="space-y-3">
              <div>
                <label className="form-label">Font Input (Google Font URL)</label>
                <input
                  type="text"
                  value={fontInput}
                  onChange={(e) => setFontInput(e.target.value)}
                  className="form-input"
                  placeholder="https://fonts.googleapis.com/css2?family=..."
                />
              </div>
              
              <div>
                <label className="form-label">Font Name</label>
                <input
                  type="text"
                  value={fontName}
                  onChange={(e) => setFontName(e.target.value)}
                  className="form-input"
                  placeholder="Space Grotesk"
                />
              </div>
              
              <button
                onClick={handleSaveFont}
                disabled={!fontName.trim() || !fontInput.trim()}
                className="btn btn-primary w-full"
              >
                Save to List
              </button>
              
              {/* Font List */}
              <div className="max-h-32 overflow-y-auto">
                <h3 className="text-sm font-medium mb-2">Font List</h3>
                {fontPresets.map((preset) => (
                  <div key={preset.name} className="flex justify-between items-center py-1 text-sm">
                    <span className="truncate mr-2">{preset.name}</span>
                    <button
                      onClick={() => handleDeleteFont(preset.name)}
                      className="btn btn-sm btn-danger"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Manage Children Cards */}
          <div className="content-card">
            <h2 className="text-xl font-semibold mb-4">Manage Children Cards</h2>
            
            <div className="space-y-3">
              {/* List of cards */}
              <div className="max-h-32 overflow-y-auto">
                <h3 className="text-sm font-medium mb-2">Cards containing "{cardName}"</h3>
                {childrenCards.length > 0 ? (
                  childrenCards.map((card) => (
                    <div key={card.uuid} className="flex justify-between items-center py-1 text-sm">
                      <span className="truncate mr-2">{card.name}</span>
                      <button
                        onClick={() => {
                          // Logic to remove current card's hashtag from this child card
                        }}
                        className="btn btn-sm btn-danger"
                      >
                        ×
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted">No children cards found</p>
                )}
              </div>
              
              {/* Search cards - use unified HashtagSelector for management */}
              <HashtagSelector
                availableHashtags={allCards.map(card => card.name).filter(name => name !== cardName)}
                selectedHashtags={childrenCards.map(card => card.name)}
                onHashtagsChange={(selectedNames) => {
                  // Update children cards based on selected hashtags
                  const newChildren = allCards.filter(card => selectedNames.includes(card.name));
                  setChildrenCards(newChildren);
                }}
                label="Add Card Relationships"
                placeholder="Search cards to add relationships..."
                maxSuggestions={10}
                excludeSelected={true}
                className="mt-2"
              />
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

export default function CardEditorPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center page-height">
        <div className="loading-spinner"></div>
        <span className="ml-2 text-lg">Loading editor...</span>
      </div>
    }>
      <CardEditor />
    </Suspense>
  );
}
