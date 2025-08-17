'use client';

import React, { useState, useCallback, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { useOrgFromUrl } from '@/app/hooks/useOrgFromUrl';
import PageLayout from '@/app/components/PageLayout';
import HashtagSelector from '@/app/components/HashtagSelector';
import LoadingSpinner from '@/app/components/LoadingSpinner';

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
  const { organization, isLoading: orgLoading, error: orgError, slug } = useOrgFromUrl();
  const searchParams = useSearchParams();
  const cardUuid = searchParams.get('uuid') || searchParams.get('edit');
  const isEditing = Boolean(cardUuid);
  
  // Show organization info prominently
  const orgDisplayName = organization?.OrganizationName || 'Loading...';
  const orgUuid = organization?.OrganizationUUID || 'Unknown';
  
  // 1st Column - General Information
  const [cardName, setCardName] = useState(''); // #hashtag - required
  const [cardUUID, setCardUUID] = useState(cardUuid || uuidv4()); // UUID - immediately generated
  const [cardHashtags, setCardHashtags] = useState<string[]>([]); // list of #hashtags
  const [hashtagSuggestions, setHashtagSuggestions] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const [cardNameError, setCardNameError] = useState('');
  const [isCheckingName, setIsCheckingName] = useState(false);
  
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
    if (!orgLoading && organization) {
      loadInitialData();
    }
  }, [cardUuid, organization, orgLoading]);

  // Handler functions
  const handleSaveCard = async () => {
    if (!cardName || !organization) {
      setError('Card name and organization are required');
      return;
    }
    
    if (cardNameError) {
      setError('Please fix the card name error before saving');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const cardData = {
        uuid: cardUUID,
        name: cardName,
        body: {
          textContent: textContent || undefined,
          imageUrl: imageUrl || undefined,
          background: {
            type: 'gradient' as const,
            value: cssBackground,
            textColor: textColor
          }
        },
        cardSize: cardSize,
        hashtags: cardHashtags,
        isActive: true
      };

      const method = isEditing ? 'PUT' : 'POST';
      const url = isEditing ? `/api/v1/cards/${cardUUID}` : '/api/v1/cards/add';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-UUID': organization.OrganizationUUID
        },
        body: JSON.stringify(cardData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${isEditing ? 'update' : 'create'} card`);
      }

      const result = await response.json();
      
      if (result.success) {
        setSuccess(`Card ${isEditing ? 'updated' : 'created'} successfully!`);
        
        // If creating a new card, reset the form
        if (!isEditing) {
          setCardName('');
          setTextContent('');
          setImageUrl('');
          setCardHashtags([]);
          setCardUUID(uuidv4());
        }
        
        // Redirect after a short delay
        setTimeout(() => {
          router.push(`/organization/${slug}/cards`);
        }, 2000);
      } else {
        setError(result.error || 'Failed to save card');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save card');
      console.error('Card save error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddHashtag = (hashtag: string) => {
    const cleanHashtag = hashtag.startsWith('#') ? hashtag : `#${hashtag}`;
    // Prevent self-reference
    if (cleanHashtag === cardName) {
      setError('Card cannot reference itself as a parent hashtag');
      return;
    }
    if (!cardHashtags.includes(cleanHashtag)) {
      setCardHashtags([...cardHashtags, cleanHashtag]);
    }
    setHashtagInput('');
  };

  const handleRemoveHashtag = (hashtag: string) => {
    setCardHashtags(cardHashtags.filter(h => h !== hashtag));
  };

  // Check card name uniqueness
  const checkCardNameUniqueness = async (name: string) => {
    if (!name || !organization) return;
    
    setIsCheckingName(true);
    setCardNameError('');
    
    try {
      const response = await fetch(`/api/v1/cards?search=${encodeURIComponent(name)}`, {
        headers: {
          'X-Organization-UUID': organization.OrganizationUUID
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const existingCard = data.cards?.find((card: any) => card.name === name);
        
        if (existingCard && (!isEditing || existingCard.uuid !== cardUUID)) {
          setCardNameError('This hashtag name is already taken');
        }
      }
    } catch (err) {
      console.error('Error checking card name:', err);
    } finally {
      setIsCheckingName(false);
    }
  };

  // Debounced name checking
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (cardName) {
        checkCardNameUniqueness(cardName);
      }
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [cardName, organization]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Load presets
      if (!organization) {
        setError('Organization not available');
        setLoading(false);
        return;
      }

      await fetch('/api/v1/presets/init', {
        method: 'POST',
        headers: {
          'X-Organization-UUID': organization.OrganizationUUID
        }
      });
      
      const [fontResponse, backgroundResponse, cardsResponse, lastCardResponse] = await Promise.all([
        fetch('/api/v1/presets/fonts', {
          headers: {
            'X-Organization-UUID': organization.OrganizationUUID
          }
        }),
        fetch('/api/v1/presets/backgrounds', {
          headers: {
            'X-Organization-UUID': organization.OrganizationUUID
          }
        }),
        fetch('/api/v1/cards', {
          headers: {
            'X-Organization-UUID': organization.OrganizationUUID
          }
        }),
        fetch('/api/v1/cards?last=true', {
            headers: {
                'X-Organization-UUID': organization.OrganizationUUID
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
          // All existing card names are potential hashtags for other cards
          setHashtagSuggestions(cardsData.cards.map(c => c.name).filter(name => name.startsWith('#')));
        }
      }

      if (lastCardResponse.ok) {
          const lastCardData = await lastCardResponse.json();
          if (lastCardData.success && lastCardData.card) {
              const lastCard = lastCardData.card;
              setCardSize(lastCard.cardSize || '300:400');
              setFontSize(lastCard.body?.fontSize || 24);
              setPadding(lastCard.body?.padding || 20);
              setCssBackground(lastCard.body?.background?.value || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
              setTextColor(lastCard.body?.background?.textColor || '#000000');
          }
      }
      
      // If editing, load card data
      if (isEditing && cardUuid) {
        const cardResponse = await fetch(`/api/v1/cards/${cardUuid}`, {
          headers: {
            'X-Organization-UUID': organization.OrganizationUUID
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

  // Show loading while organization is loading
  if (orgLoading) {
    return (
      <PageLayout title="Card Editor">
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner size="lg" message="Loading organization..." />
        </div>
      </PageLayout>
    );
  }

  // Show organization error
  if (orgError || !organization) {
    return (
      <PageLayout title="Card Editor">
        <div className="status-error p-4 rounded-lg max-w-md mx-auto mt-8">
          <h3 className="font-semibold mb-2">Organization Not Found</h3>
          <p>{orgError || 'The requested organization could not be found or is inactive.'}</p>
          {slug && (
            <p className="text-sm mt-2 opacity-75">
              Slug: <code>{slug}</code>
            </p>
          )}
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Card Editor">
      <div className="w-full h-full flex flex-col gap-6 p-6">
        
        {/* Organization Header */}
        <div className="content-background p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Card Editor</h1>
              <p className="text-muted">{organization.OrganizationName}</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => router.push(`/organization/${slug}/cards`)}
                className="btn btn-secondary btn-sm"
              >
                🎮 View Cards
              </button>
              <button 
                onClick={() => router.push(`/organization/${slug}/ranks`)}
                className="btn btn-outline btn-sm"
              >
                🏆 View Rankings
              </button>
            </div>
          </div>
          
          <div className="text-with-background">
            <h2 className="text-xl font-semibold mb-2">
              {isEditing ? 'Edit Card' : 'Create New Card'}
            </h2>
            <p className="text-sm text-muted">
              {isEditing 
                ? `Editing card in ${organization.OrganizationName}. Changes will be saved to your organization's database.`
                : `Create new cards for ${organization.OrganizationName}. Use hashtags to organize cards into decks.`
              }
            </p>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 content-background p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <LoadingSpinner size="lg" message="Loading card editor..." />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column - Card Details */}
              <div className="lg:col-span-1 space-y-6">
                
                {/* Basic Information */}
                <div className="content-background p-6">
                  <h3 className="text-lg font-semibold mb-4">🎯 Basic Information</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="form-label">Card Name (Hashtag)</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="#example"
                          value={cardName}
                          onChange={(e) => {
                            let value = e.target.value;
                            if (!value.startsWith('#') && value) {
                              value = '#' + value;
                            }
                            setCardName(value);
                            setCardNameError(''); // Clear error when typing
                          }}
                          list="hashtag-suggestions"
                          className={`form-input ${cardNameError ? 'border-red-500' : ''} ${isCheckingName ? 'pr-8' : ''}`}
                        />
                        {isCheckingName && (
                          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                          </div>
                        )}
                        <datalist id="hashtag-suggestions">
                          {hashtagSuggestions.map((suggestion, index) => (
                            <option key={index} value={suggestion} />
                          ))}
                        </datalist>
                      </div>
                      {cardNameError && (
                        <p className="text-xs text-red-500 mt-1">{cardNameError}</p>
                      )}
                      <p className="text-xs text-muted mt-1">Required. Must start with # and be unique</p>
                    </div>
                    
                    <div>
                      <label className="form-label">Text Content</label>
                      <textarea
                        placeholder="Card description or title..."
                        value={textContent}
                        onChange={(e) => setTextContent(e.target.value)}
                        className="form-input min-h-[80px]"
                      />
                      <p className="text-xs text-muted mt-1">Optional. Displayed on the card</p>
                    </div>
                    
                    <div>
                      <label className="form-label">Image URL</label>
                      <input
                        type="url"
                        placeholder="https://example.com/image.jpg"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="form-input"
                      />
                      <p className="text-xs text-muted mt-1">Optional. External image URL</p>
                    </div>
                  </div>
                </div>
                
                {/* Style Settings */}
                <div className="content-background p-6">
                  <h3 className="text-lg font-semibold mb-4">🎨 Style Settings</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="form-label">Background</label>
                      <input
                        type="text"
                        placeholder="CSS background value"
                        value={cssBackground}
                        onChange={(e) => setCssBackground(e.target.value)}
                        className="form-input"
                      />
                      <p className="text-xs text-muted mt-1">CSS background (color, gradient, etc.)</p>
                    </div>
                    
                    <div>
                      <label className="form-label">Text Color</label>
                      <input
                        type="color"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="form-input h-12"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="form-label">Font Size</label>
                        <input
                          type="number"
                          min="8"
                          max="192"
                          value={fontSize}
                          onChange={(e) => setFontSize(Number(e.target.value))}
                          className="form-input"
                        />
                      </div>
                      <div>
                        <label className="form-label">Padding</label>
                        <input
                          type="number"
                          min="0"
                          max="192"
                          value={padding}
                          onChange={(e) => setPadding(Number(e.target.value))}
                          className="form-input"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="form-label">Card Size</label>
                      <input
                        type="text"
                        placeholder="300:400"
                        value={cardSize}
                        onChange={(e) => setCardSize(e.target.value)}
                        className="form-input"
                      />
                      <p className="text-xs text-muted mt-1">Format: width:height (e.g., 300:400)</p>
                    </div>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="content-background p-6">
                  <h3 className="text-lg font-semibold mb-4">💾 Actions</h3>
                  
                  <div className="space-y-3">
                    <button
                      onClick={handleSaveCard}
                      disabled={!cardName || loading}
                      className="btn btn-primary w-full"
                    >
                      {loading ? 'Saving...' : isEditing ? 'Update Card' : 'Create Card'}
                    </button>
                    
                    {isEditing && (
                      <button
                        onClick={() => router.push(`/organization/${slug}/card-editor`)}
                        className="btn btn-secondary w-full"
                      >
                        Create New Card Instead
                      </button>
                    )}
                    
                    <button
                      onClick={() => router.push(`/organization/${slug}/cards`)}
                      className="btn btn-outline w-full"
                    >
                      ← Back to Cards
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Center Column - Live Preview */}
              <div className="lg:col-span-1">
                <div className="content-background p-6 sticky top-6">
                  <h3 className="text-lg font-semibold mb-4">👁️ Live Preview</h3>
                  
                  <div className="flex justify-center mb-4">
                    <div 
                      className="rounded-lg overflow-hidden shadow-lg"
                      style={{
                        width: cardSize.split(':')[0] ? `${Math.min(Number(cardSize.split(':')[0]), 300)}px` : '300px',
                        height: cardSize.split(':')[1] ? `${Math.min(Number(cardSize.split(':')[1]) * (300/Number(cardSize.split(':')[0] || 300)), 400)}px` : '400px',
                        background: cssBackground,
                        color: textColor,
                        fontSize: `${Math.min(fontSize, 32)}px`,
                        padding: `${Math.min(padding, 32)}px`,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: verticalAlign === 'top' ? 'flex-start' : verticalAlign === 'bottom' ? 'flex-end' : 'center',
                        alignItems: horizontalAlign === 'left' ? 'flex-start' : horizontalAlign === 'right' ? 'flex-end' : 'center',
                        textAlign: horizontalAlign as any,
                        fontFamily: selectedFont
                      }}
                    >
                      {imageUrl && (
                        <img 
                          src={imageUrl} 
                          alt={textContent || cardName}
                          className="max-w-full max-h-full object-contain mb-2"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      {textContent && (
                        <div className="text-center break-words">
                          {textContent}
                        </div>
                      )}
                      {!textContent && !imageUrl && (
                        <div className="text-center opacity-50">
                          {cardName || 'Preview'}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-xs text-muted text-center">
                    Actual size: {cardSize} | Preview scaled to fit
                  </div>
                </div>
              </div>
              
              {/* Right Column - Advanced */}
              <div className="lg:col-span-1 space-y-6">
                
                {/* Hashtags - Deck Membership */}
                <div className="content-background p-6">
                  <h3 className="text-lg font-semibold mb-4">🏷️ Deck Membership</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <HashtagSelector
                        availableHashtags={hashtagSuggestions.filter(tag => tag !== cardName)}
                        selectedHashtags={cardHashtags}
                        onHashtagsChange={setCardHashtags}
                        placeholder="Search existing deck hashtags..."
                        label="Add to Decks"
                        allowCustomHashtags={false}
                        excludeSelected={true}
                      />
                      <p className="text-xs text-muted mt-1">
                        This card will appear when playing these decks. If this card has children, it becomes a playable deck itself.
                      </p>
                    </div>
                    
                  </div>
                </div>
                
                {/* Background Presets */}
                {backgroundPresets.length > 0 && (
                  <div className="content-background p-6">
                    <h3 className="text-lg font-semibold mb-4">🎨 Background Presets</h3>
                    
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {backgroundPresets.map((preset) => (
                        <button
                          key={preset._id}
                          onClick={() => setCssBackground(preset.value)}
                          className="p-3 rounded border-2 border-transparent hover:border-blue-500 transition-colors"
                          style={{ background: preset.value }}
                          title={preset.name}
                        >
                          <div className="text-xs text-white bg-black bg-opacity-50 rounded px-1">
                            {preset.name}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Debug Info */}
                <div className="content-background p-6">
                  <h3 className="text-lg font-semibold mb-4">🔧 Debug Info</h3>
                  
                  <div className="text-xs space-y-2">
                    <div>
                      <strong>Organization:</strong> {organization.OrganizationName}
                    </div>
                    <div>
                      <strong>UUID:</strong> {cardUUID}
                    </div>
                    <div>
                      <strong>Mode:</strong> {isEditing ? 'Editing' : 'Creating'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Status Messages */}
          {error && (
            <div className="status-error p-4 rounded-lg mt-6">
              {error}
            </div>
          )}
          
          {success && (
            <div className="status-success p-4 rounded-lg mt-6">
              {success}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

export default function OrganizationCardEditorPage() {
  return (
    <Suspense fallback={
      <PageLayout title="Card Editor">
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner size="lg" message="Loading..." />
        </div>
      </PageLayout>
    }>
      <CardEditor />
    </Suspense>
  );
}
