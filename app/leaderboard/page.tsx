import { Typography, Paper, Tabs, Tab, Box } from '@mui/material';
import { Card } from '@/models/Card';

export default function LeaderboardPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <Typography variant="h4" component="h1" gutterBottom>
        Leaderboard
      </Typography>

      <Paper className="p-4">
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={0}>
            <Tab label="Global" />
            <Tab label="By Project" disabled />
          </Tabs>
        </Box>

        <div className="space-y-4">
          <Typography variant="body1" color="text.secondary" className="text-center py-8">
            Coming soon! Cards will be ranked based on their performance in voting rounds.
          </Typography>
        </div>
      </Paper>
    </div>
  );
}
