'use client'

import CardForm from '@/components/ui/CardForm'

export default function CreateCardPage() {
  const handleSubmit = async (data: any) => {
    // Handle form submission
    console.log('Form submitted:', data)
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8 text-center">Create New Card</h1>
      <CardForm onSubmit={handleSubmit} />
    </div>
  )
}
