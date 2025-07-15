export function safeDate(dateString?: string): string {
  return dateString ? new Date(dateString).toISOString() : new Date().toISOString();
}

