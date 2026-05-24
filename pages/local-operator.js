import { OperatorApp } from '../components/operator/OperatorApp';

export async function getServerSideProps() {
  if (process.env.VERCEL) {
    return { redirect: { destination: '/', permanent: false } };
  }
  return { props: {} };
}

/** Dev convenience mirror of the local operator console. Production management runs on :10006. */
export default function LocalOperatorPage() {
  return <OperatorApp embedded apiBase="http://127.0.0.1:10006" />;
}
