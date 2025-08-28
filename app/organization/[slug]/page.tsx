'use client'
import { useState, useEffect } from 'react'

interface Props {
  params: { slug: string }
}

interface Organization {
  uuid: string
  name: string
  slug: string
}

export default function OrganizationPage({ params }: Props) {
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrganization()
  }, [params.slug])

  const fetchOrganization = async () => {
    try {
      const response = await fetch(`/api/v1/organizations/${params.slug}`)
      if (response.ok) {
        const data = await response.json()
        setOrganization(data.organization)
      }
    } catch (error) {
      console.error('Failed to fetch organization:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="container text-center">Loading...</div>
  }

  if (!organization) {
    return (
      <div className="container text-center">
        <div className="error mb-10">Organization Not Found</div>
        <div>/{params.slug}</div>
        <button onClick={() => window.location.href = '/organization-editor'}>
          Manage Organizations
        </button>
      </div>
    )
  }

  return (
    <div className="container">
      <h1 className="mb-20 text-center">{organization.name}</h1>
      
      <div className="form">
        <button onClick={() => window.location.href = `/organization/${params.slug}/card-editor`}>
          Cards
        </button>
        <button onClick={() => window.location.href = `/organization/${params.slug}/play`}>
          Play
        </button>
        <button onClick={() => window.location.href = `/organization/${params.slug}/ranks`}>
          Ranks
        </button>
      </div>
    </div>
  )
}
