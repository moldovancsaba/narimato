import { useRouter } from 'next/router';

export default function CardPage() {
  const router = useRouter();
  const { slug } = router.query;

  return (
    <div>
      <h1>Card Details: {slug}</h1>
    </div>
  );
}
