import { Container } from '@mantine/core';
import { LocalAiDashboard } from '../components/intelligence/LocalAiDashboard';
import { LocalOperatorNotice } from '../components/LocalOperatorNotice';

export default function LocalAiPage() {
  return (
    <Container size="md" py="xl">
      <LocalOperatorNotice />
      <LocalAiDashboard />
    </Container>
  );
}
