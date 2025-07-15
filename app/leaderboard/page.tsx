'use client';

import { useState, useEffect } from 'react';
import { 
  Typography, 
  Paper, 
  Tabs, 
  Tab, 
  Box,
  CircularProgress,
  Pagination,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import LeaderboardCard from '@/components/ui/LeaderboardCard';
import type { LeaderboardEntry } from '@/lib/services/leaderboardService';

type LeaderboardType = 'global' | 'project' | 'personal';

interface LeaderboardData {
  entries: LeaderboardEntry[];
  total: number;
  pages: number;
}

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<LeaderboardType>('global');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string>('default-project'); // Add your actual default project ID
  const [sessionId, setSessionId] = useState<string>('');
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);

  // Fetch leaderboard data
  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        type: activeTab,
        page: page.toString(),
        limit: '10',
      });

      // Add projectId for project rankings
      if (activeTab === 'project') {
        params.append('projectId', projectId);
      }

      const headers: HeadersInit = {};
      // Add session-id header for personal rankings
      if (activeTab === 'personal') {
        headers['session-id'] = sessionId;
        if (projectId) {
          params.append('projectId', projectId);
        }
      }

      const response = await fetch(`/api/leaderboard?${params}`, { headers });
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Fetch projects on mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch('/api/projects');
        if (!response.ok) throw new Error('Failed to fetch projects');
        const data = await response.json();
        setProjects(data);
        if (data.length > 0) {
          setProjectId(data[0].id); // Set first project as default
        }
      } catch (err) {
        console.error('Error fetching projects:', err);
      }
    };
    fetchProjects();
  }, []);

  // Get session ID on mount
  useEffect(() => {
    // Get session ID from localStorage or generate a new one
    const storedSessionId = localStorage.getItem('sessionId');
    if (storedSessionId) {
      setSessionId(storedSessionId);
    } else {
      const newSessionId = `session_${Date.now()}`;
      localStorage.setItem('sessionId', newSessionId);
      setSessionId(newSessionId);
    }
  }, []);

  // Fetch data when tab, page, or sessionId changes
  useEffect(() => {
    fetchLeaderboard();
  }, [activeTab, page, sessionId, projectId]);

  // Handle tab change
  const handleTabChange = (_: React.SyntheticEvent, newValue: LeaderboardType) => {
    setActiveTab(newValue);
    setPage(1); // Reset to first page when changing tabs
  };

  // Handle pagination
  const handlePageChange = (_: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Typography variant="h4" component="h1" gutterBottom>Leaderboard</Typography>
      <Paper className="p-4">
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={activeTab} onChange={handleTabChange} aria-label="leaderboard-tabs">
            <Tab value="global" label="Global Rankings" aria-label="global-rankings-tab" />
            <Tab value="project" label="By Project" aria-label="project-rankings-tab" />
            <Tab value="personal" label="Personal Rankings" aria-label="personal-rankings-tab" />
          </Tabs>
        </Box>

        {(activeTab === 'project' || activeTab === 'personal') && (
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel id="project-select-label">Project</InputLabel>
            <Select
              labelId="project-select-label"
              value={projectId}
              label="Project"
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.map((project) => (
                <MenuItem key={project.id} value={project.id}>{project.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
        )}

        <div className="space-y-4">
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : data?.entries.length === 0 ? (
            <Typography variant="body1" color="text.secondary" className="text-center py-8">
              No cards found in the leaderboard yet.
            </Typography>
          ) : (
            <>
              {data?.entries.map((entry) => (
                <LeaderboardCard key={entry.slug} entry={entry} showRank={true} />
              ))}
              {data && data.pages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                  <Pagination
                    count={data.pages}
                    page={page}
                    onChange={handlePageChange}
                    color="primary"
                    showFirstButton
                    showLastButton
                  />
                </Box>
              )}
            </>
          )}
        </div>
      </Paper>
    </div>
  );
}
