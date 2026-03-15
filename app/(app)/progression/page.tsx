import { getExercises } from '@/lib/exercises/queries'
import { ProgressionChart } from '@/components/progression-chart'

export default async function ProgressionPage() {
  const exercises = await getExercises()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Progression</h1>
      <ProgressionChart exercises={exercises} />
    </div>
  )
}
