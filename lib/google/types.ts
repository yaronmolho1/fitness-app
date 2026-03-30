import type { calendar_v3 } from 'googleapis'

// Parameters for building a Google Calendar event body
export type GCalEventParams = {
  templateName: string
  modality: string
  date: string          // YYYY-MM-DD
  timeSlot: string      // HH:MM
  duration: number      // minutes
  weekNumber: number
  timezone: string      // IANA timezone
  appUrl: string
  mesocycleId: number
  templateId: number
  scheduleEntryId: number | null
  exercises?: string[]
  completed?: boolean
}

// Result of a sync operation
export type SyncResult = {
  created: number
  updated: number
  deleted: number
  failed: number
  errors: SyncError[]
}

export type SyncError = {
  operation: 'create' | 'update' | 'delete'
  date: string
  templateId: number
  message: string
}

// Schedule change actions that trigger sync
export type SyncAction = 'assign' | 'remove' | 'move' | 'reset'

// Google Calendar event body shape (subset for type safety)
export type GCalEventBody = calendar_v3.Schema$Event
