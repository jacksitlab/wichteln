import type {
  AdminGroupView, Assignee, CreateGroupResponse, JoinResponse,
  MeResponse, PersonalLinkResponse, Wish,
} from './types'
import { ApiError, type ApiErrorBody, type Exclusion } from './types'

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const resp = await fetch(path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!resp.ok) {
    let errBody: ApiErrorBody = { code: 'UNKNOWN', message: 'Etwas ist schiefgelaufen.' }
    try {
      errBody = await resp.json()
    } catch {
      // nicht-JSON-Fehler (z.B. Server nicht erreichbar) — Defaultmeldung behalten
    }
    throw new ApiError(resp.status, errBody)
  }
  if (resp.status === 204) return undefined as T
  return (await resp.json()) as T
}

export const postGroup = (data: { title: string; description?: string; drawDate?: string }) =>
  request<CreateGroupResponse>('POST', '/api/groups', data)

export const getAdminGroup = (adminToken: string) =>
  request<AdminGroupView>('GET', `/api/groups/${adminToken}`)

export const patchGroup = (
  adminToken: string,
  data: { title?: string; description?: string; drawDate?: string },
) => request<AdminGroupView>('PATCH', `/api/groups/${adminToken}`, data)

export const removeParticipant = (adminToken: string, participantId: string) =>
  request<void>('DELETE', `/api/groups/${adminToken}/participants/${participantId}`)

export const regenerateLink = (adminToken: string, participantId: string) =>
  request<PersonalLinkResponse>(
    'POST', `/api/groups/${adminToken}/participants/${participantId}/link`)

export const postDraw = (adminToken: string) =>
  request<{ drawnAt: string; assignmentCount: number }>(
    'POST', `/api/groups/${adminToken}/draw`)

export const getExclusions = (adminToken: string) =>
  request<Exclusion[]>('GET', `/api/groups/${adminToken}/exclusions`)

export const putExclusions = (
  adminToken: string,
  exclusions: { giverId: string; receiverId: string }[],
) => request<Exclusion[]>(
  'PUT', `/api/groups/${adminToken}/exclusions`, exclusions)

export const postJoin = (joinToken: string, name: string) =>
  request<JoinResponse>('POST', `/api/join/${joinToken}`, { name })

export const getMe = (personalToken: string) =>
  request<MeResponse>('GET', `/api/me/${personalToken}`)

export const leaveGroup = (personalToken: string) =>
  request<void>('DELETE', `/api/me/${personalToken}`)

export const addWish = (personalToken: string, text: string) =>
  request<Wish>('POST', `/api/me/${personalToken}/wishes`, { text })

export const updateWish = (personalToken: string, wishId: string, text: string) =>
  request<Wish>('PUT', `/api/me/${personalToken}/wishes/${wishId}`, { text })

export const deleteWish = (personalToken: string, wishId: string) =>
  request<void>('DELETE', `/api/me/${personalToken}/wishes/${wishId}`)

export const getAssignee = (personalToken: string) =>
  request<Assignee>('GET', `/api/me/${personalToken}/assignee`)
