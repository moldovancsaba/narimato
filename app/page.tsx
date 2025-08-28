'use client'
import { useEffect } from 'react'
import './styles/minimal.css'

export default function Home() {
  useEffect(() => {
    window.location.href = '/organization-editor'
  }, [])

  return null
}
