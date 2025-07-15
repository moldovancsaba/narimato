import { Container, Grid } from '@mui/material';
import Card from './Card';

export default function CardContainer({ cards }) {
  return (
    <Container>
      <Grid container spacing={2}>
        {cards?.map((card, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card {...card} />
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
