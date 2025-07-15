import { useState } from 'react';
import { Box, Button } from '@mui/material';
import Card from './Card';

export default function SwipeController() {
  const [currentCard, setCurrentCard] = useState(null);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {currentCard && <Card {...currentCard} />}
      <Box sx={{ mt: 2 }}>
        <Button variant="contained" color="error" sx={{ mr: 1 }}>
          Reject
        </Button>
        <Button variant="contained" color="success">
          Accept
        </Button>
      </Box>
    </Box>
  );
}
