'use client';

import { useState } from 'react';
import { CardSelector } from '@/components/Project/CardSelector';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface CardManagerProps {
  projectSlug: string;
  onCardAdded: () => void;
}

/**
 * CardManager Component
 * 
 * Manages the addition of cards to a project through a modal interface.
 * Provides search and selection functionality for adding existing cards.
 */
export default function CardManager({ projectSlug, onCardAdded }: CardManagerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleCardAdded = () => {
    onCardAdded();
    // Keep the modal open to allow adding multiple cards
  };

  const handleError = (error: Error) => {
    console.error('Error in CardManager:', error);
    // You might want to show a toast or error message here
  };

  return (
    <>
      <Button 
        onClick={() => setIsOpen(true)}
        className="mb-4"
      >
        Add Cards
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Cards to Project</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <CardSelector
              projectSlug={projectSlug}
              onCardAdded={handleCardAdded}
              onError={handleError}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
