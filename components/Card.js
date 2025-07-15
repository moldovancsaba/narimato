import { Card as MUICard, CardContent, Typography } from '@mui/material';

export default function Card({ title, content }) {
  return (
    <MUICard>
      <CardContent>
        <Typography variant="h5" component="h2">
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {content}
        </Typography>
      </CardContent>
    </MUICard>
  );
}
