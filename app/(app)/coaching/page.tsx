import { getAthleteProfile } from '@/lib/coaching/queries'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'

export const dynamic = 'force-dynamic'

export default async function CoachingPage() {
  const profile = await getAthleteProfile()

  return (
    <PageContainer variant="narrow">
      <div className="space-y-6">
        <PageHeader
          title="Coaching"
          description="Generate a training summary for LLM-assisted coaching"
        />
        <div data-testid="coaching-client" data-profile={JSON.stringify(profile)}>
          {/* T166-T169 will replace this with CoachingClient component */}
        </div>
      </div>
    </PageContainer>
  )
}
