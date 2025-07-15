import CardForm from '@/components/ui/CardForm';

export default function CreateCardPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8 text-center">Create New Card</h1>
      <CardForm />
    </div>
  );
}
