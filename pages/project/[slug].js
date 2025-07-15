import { useRouter } from 'next/router';

export default function ProjectPage() {
  const router = useRouter();
  const { slug } = router.query;

  return (
    <div>
      <h1>Project: {slug}</h1>
    </div>
  );
}
