/**
 * Vote-only entry route. Redirects to the unified play UI with mode preselected.
 * ADR 001: vote-only is supported; the former 410 page was erroneous leftover text.
 */
export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/play?mode=vote-only',
      permanent: false,
    },
  };
}

export default function VoteOnlyRedirect() {
  return null;
}
