import { Typography, Paper, Grid } from '@mui/material';

export default function DashboardPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <Typography variant="h4" component="h1" gutterBottom>
        Dashboard
      </Typography>
      
      <Grid container spacing={4}>
        <Grid item xs={12} md={6} lg={3}>
          <Paper className="p-4">
            <Typography variant="h6">MongoDB Status</Typography>
            <Typography variant="body2" color="text.secondary">
              Connected
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <Paper className="p-4">
            <Typography variant="h6">Active Users</Typography>
            <Typography variant="body2" color="text.secondary">
              Coming soon
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <Paper className="p-4">
            <Typography variant="h6">API Health</Typography>
            <Typography variant="body2" color="text.secondary">
              All systems operational
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <Paper className="p-4">
            <Typography variant="h6">Socket Status</Typography>
            <Typography variant="body2" color="text.secondary">
              Coming soon
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </div>
  );
}
