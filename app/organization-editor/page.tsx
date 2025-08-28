'use client'
import { useState, useEffect } from 'react'

interface Organization {
  uuid: string
  slug: string
  name: string
}

export default function OrganizationEditor() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null)
  const [formData, setFormData] = useState({ name: '', slug: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrganizations()
  }, [])

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/v1/organizations')
      if (response.ok) {
        const data = await response.json()
        setOrganizations(data.organizations || [])
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const method = editingOrg ? 'PUT' : 'POST'
    const url = editingOrg 
      ? `/api/v1/organizations/${editingOrg.slug}`
      : '/api/v1/organizations'
    
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (response.ok) {
        await fetchOrganizations()
        setFormData({ name: '', slug: '' })
        setEditingOrg(null)
      }
    } catch (error) {
      console.error('Failed to save organization:', error)
    }
  }

  const handleEdit = (org: Organization) => {
    setEditingOrg(org)
    setFormData({ name: org.name, slug: org.slug })
  }

  const handleDelete = async (slug: string) => {
    try {
      const response = await fetch(`/api/v1/organizations/${slug}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        await fetchOrganizations()
      }
    } catch (error) {
      console.error('Failed to delete organization:', error)
    }
  }

  const cancelEdit = () => {
    setEditingOrg(null)
    setFormData({ name: '', slug: '' })
  }

  if (loading) {
    return <div className="container text-center">Loading...</div>
  }

  return (
    <div className="container">
      <h1 className="mb-20">Organizations</h1>
      
      <form onSubmit={handleSubmit} className="form mb-20">
        <input
          type="text"
          placeholder="Name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          required
        />
        <input
          type="text"
          placeholder="Slug"
          value={formData.slug}
          onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
          required
        />
        <div className="form-row">
          <button type="submit">
            {editingOrg ? 'Update' : 'Create'}
          </button>
          {editingOrg && (
            <button type="button" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <ul className="list">
        {organizations.map((org) => (
          <li key={org.uuid} className="list-item">
            <div>
              <strong>{org.name}</strong>
              <div>/{org.slug}</div>
            </div>
            <div className="actions">
              <button onClick={() => window.location.href = `/organization/${org.slug}`}>
                Open
              </button>
              <button onClick={() => handleEdit(org)}>
                Edit
              </button>
              <button onClick={() => handleDelete(org.slug)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
