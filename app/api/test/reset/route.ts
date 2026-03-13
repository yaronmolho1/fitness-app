import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { exercises } from '@/lib/db/schema'

export async function POST(request: Request) {
  if (process.env.E2E_TEST !== 'true') {
    return NextResponse.json({ error: 'Not available' }, { status: 403 })
  }

  let body: { seed?: { name: string; modality: string }[] } = {}
  try {
    body = await request.json()
  } catch {
    // no body = just reset
  }

  db.run(sql`DELETE FROM exercises`)

  if (body.seed?.length) {
    for (const ex of body.seed) {
      db.insert(exercises)
        .values({
          name: ex.name,
          modality: ex.modality as 'resistance' | 'running' | 'mma',
          created_at: new Date(),
        })
        .run()
    }
  }

  revalidatePath('/exercises')

  const count = db.select().from(exercises).all().length
  return NextResponse.json({ success: true, seeded: body.seed?.length ?? 0, count })
}
