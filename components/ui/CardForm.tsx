'use client';

import { useState } from 'react';
import { TextField, Button, Select, MenuItem, FormControl, InputLabel, Chip, Box, SelectChangeEvent } from '@mui/material';
import { useRouter } from 'next/navigation';

interface CardFormProps {
  onSubmit?: (data: any) => void;
}

export default function CardForm({ onSubmit }: CardFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    type: 'text',
    hashtags: [] as string[],
    imageAlt: '',
  });
  const [currentHashtag, setCurrentHashtag] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (e: SelectChangeEvent) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleHashtagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && currentHashtag) {
      e.preventDefault();
      if (!formData.hashtags.includes(currentHashtag)) {
        setFormData((prev) => ({
          ...prev,
          hashtags: [...prev.hashtags, currentHashtag],
        }));
      }
      setCurrentHashtag('');
    }
  };

  const handleDeleteHashtag = (tagToDelete: string) => {
    setFormData((prev) => ({
      ...prev,
      hashtags: prev.hashtags.filter((tag) => tag !== tagToDelete),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const response = await fetch('/api/cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create card');
      }

      const data = await response.json();
      
      if (onSubmit) {
        onSubmit(data);
      }
      
      router.push(`/cards/${data.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto p-6">
      <FormControl fullWidth>
        <InputLabel id="type-label">Type</InputLabel>
        <Select
          labelId="type-label"
          name="type"
          value={formData.type}
          label="Type"
          onChange={handleSelectChange}
        >
          <MenuItem value="text">Text</MenuItem>
          <MenuItem value="image">Image</MenuItem>
        </Select>
      </FormControl>

      <TextField
        fullWidth
        label="Title"
        name="title"
        value={formData.title}
        onChange={handleInputChange}
        required
      />

      <TextField
        fullWidth
        label="Description"
        name="description"
        value={formData.description}
        onChange={handleInputChange}
        multiline
        rows={2}
      />

      <TextField
        fullWidth
        label={formData.type === 'image' ? 'Image URL' : 'Content'}
        name="content"
        value={formData.content}
        onChange={handleInputChange}
        required
        multiline={formData.type === 'text'}
        rows={formData.type === 'text' ? 4 : 1}
      />

      {formData.type === 'image' && (
        <TextField
          fullWidth
          label="Image Alt Text"
          name="imageAlt"
          value={formData.imageAlt}
          onChange={handleInputChange}
        />
      )}

      <div>
        <TextField
          fullWidth
          label="Add Hashtags"
          value={currentHashtag}
          onChange={(e) => setCurrentHashtag(e.target.value)}
          onKeyPress={handleHashtagKeyPress}
          placeholder="Press Enter to add hashtag"
        />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
          {formData.hashtags.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              onDelete={() => handleDeleteHashtag(tag)}
            />
          ))}
        </Box>
      </div>

      {error && (
        <div className="text-red-500 text-sm mt-2">{error}</div>
      )}

      <Button
        type="submit"
        variant="contained"
        color="primary"
        fullWidth
        size="large"
      >
        Create Card
      </Button>
    </form>
  );
}
