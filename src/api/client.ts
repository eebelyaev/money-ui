import type { Role } from '../auth/storage'
import { authHeaders } from '../auth/storage'

const API_PREFIX = '/api/v1/calculations'

export type ApiErrorBody = { error?: string }

export type AuthLoginResponse = {
  access_token: string
  token_type: string
  expires_in: number
  person_id: number
  roles: string[]
  role: string
}

/** POST /auth/login без заголовков авторизации. `identifier` — телефон или username. */
export async function authLogin(identifier: string, password: string): Promise<AuthLoginResponse> {
  const res = await fetch(API_PREFIX + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: identifier.trim(),
      password,
    }),
  })
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
  return data as AuthLoginResponse
}

function isRole(s: string): s is Role {
  return s === 'banker' || s === 'client' || s === 'admin'
}

/** Проверка роли из ответа логина. */
export function roleFromLoginResponse(r: AuthLoginResponse): Role {
  if (!isRole(r.role)) {
    throw new Error('Неизвестная роль в ответе сервера')
  }
  return r.role
}

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
