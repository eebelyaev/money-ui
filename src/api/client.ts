import { authHeaders } from '../auth/storage'

const API_PREFIX = '/api/v1/calculations'

export type ApiErrorBody = { error?: string }

export async function api<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T | null> {
  const headers: Record<string, string> = { ...authHeaders() }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  const opt: RequestInit = { method, headers }
  if (body !== undefined) {
    opt.body = JSON.stringify(body)
  }
  const res = await fetch(API_PREFIX + path, opt)
  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text) as unknown
    } catch {
      data = { raw: text }
    }
  }
  if (!res.ok) {
    const errBody = data as ApiErrorBody
    const err = new Error(errBody?.error ?? res.statusText ?? 'request failed') as Error & {
      status: number
      body: unknown
    }
    err.status = res.status
    err.body = data
    throw err
  }
  return data as T | null
}
