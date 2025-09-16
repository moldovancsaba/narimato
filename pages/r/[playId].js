// FUNCTIONAL: Short shareable route for rankings by playId
// STRATEGIC: Provides a clean URL /r/{playId} that redirects to results with query

export default function ShareRanking() {
  return null;
}

export async function getServerSideProps(context) {
  const { playId } = context.params;
  return {
    redirect: {
      destination: `/results?playId=${encodeURIComponent(playId)}`,
      permanent: false,
    }
  };
}
