import { useEffect, useState } from 'react';
import { useAuth } from '@/context/useAuth';
import { useRiasecResult } from '@/hooks/useRiasec';
import { useSubjectStrengths } from '@/hooks/useSubjectStrengths';
import { useRecommendations } from '@/hooks/useRecommendations';
import { JourneyDashboard } from '@/components/dashboard/JourneyDashboard';

export function Dashboard() {
  const { user, profile } = useAuth();
  const interests = useRiasecResult();
  const academics = useSubjectStrengths();
  const recommendations = useRecommendations();
  const [justCompleted, setJustCompleted] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('nexus.justCompletedProfile') === '1') {
        setJustCompleted(true);
        sessionStorage.removeItem('nexus.justCompletedProfile');
      }
    } catch {
      // The dashboard still works when browser storage is unavailable.
    }
  }, []);

  const errors = [
    { area: 'interest profile', error: interests.error, reload: interests.reload },
    { area: 'academic strengths', error: academics.error, reload: academics.reload },
    { area: 'recommendations', error: recommendations.error, reload: recommendations.reload },
  ].filter((item) => item.error);

  return (
    <JourneyDashboard
      profile={profile}
      user={user}
      riasec={interests.result}
      strengths={academics.strengths}
      careers={recommendations.careers}
      courses={recommendations.courses}
      loading={interests.loading || academics.loading || recommendations.loading}
      errors={errors}
      justCompleted={justCompleted}
    />
  );
}

export default Dashboard;
