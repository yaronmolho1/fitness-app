import Link from 'next/link'
import { MesocycleForm } from '@/components/mesocycle-form'

export default function NewMesocyclePage() {
  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <div className="space-y-1">
        <Link href="/mesocycles" className="text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline">
          Mesocycles
        </Link>
        <h1 className="text-2xl font-bold">New Mesocycle</h1>
      </div>

      <MesocycleForm />
    </div>
  )
}
