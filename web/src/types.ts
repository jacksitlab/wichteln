export interface Participant {
  id: string
  name: string
  joinedAt: string
}

export interface Wish {
  id: string
  position: number
  text: string
}

export interface AdminGroupView {
  id: string
  title: string
  description: string | null
  drawDate: string | null
  drawnAt: string | null
  joinUrl: string
  participants: Participant[]
}

export interface CreateGroupResponse {
  group: AdminGroupView
  adminToken: string
  adminUrl: string
  joinToken: string
  joinUrl: string
}

export interface JoinResponse {
  participant: Participant
  personalToken: string
  personalUrl: string
}

export interface MeResponse {
  groupTitle: string
  groupDescription: string | null
  drawDate: string | null
  drawn: boolean
  drawnAt: string | null
  participant: Participant
  wishes: Wish[]
}

export interface Assignee {
  name: string
  wishes: Wish[]
}

export interface PersonalLinkResponse {
  participantId: string
  personalToken: string
  personalUrl: string
}

export interface ApiErrorBody {
  code: string
  message: string
}

import type { TranslationKey } from './i18n/de'

export class ApiError extends Error {
  constructor(public status: number, public body: ApiErrorBody) {
    super(body.message)
  }

  /**
   * Localized message for display. Maps the backend's machine-readable error
   * code to a translated string; unknown codes fall back to the raw backend
   * message. The backend messages are English (developer-facing).
   */
  localizedMessage(t: (key: TranslationKey, vars?: Record<string, string | number>) => string): string {
    const key = `err_${this.body.code}` as TranslationKey
    const localized = t(key)
    if (localized === key) return this.body.message // unknown code -> raw backend text
    return localized
  }
}
