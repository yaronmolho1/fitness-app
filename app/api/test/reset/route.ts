import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

export async function POST() {
  if (process.env.NODE_ENV !== 'test') {
    return NextResponse.json({ error: 'Not available' }, { status: 403 })
  }

  db.run(sql`DELETE FROM exercises`)

  return NextResponse.json({ success: true })
}
