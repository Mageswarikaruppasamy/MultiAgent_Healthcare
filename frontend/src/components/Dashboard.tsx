import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CGMChart } from './CGMChart';
import { MoodChart } from './MoodChart';
import { healthcareApi, UserSummary } from '@/services/api';
import { MapPin, Heart, AlertCircle, Droplet } from 'lucide-react';

interface DashboardProps {
  userId: number;
  userName: string;
}

interface UserProfile {
  id: number;
  first_name: string;
  last_name: string;
  city: string;
  dietary_preference: string;
  medical_conditions: string[];
}

export const Dashboard = ({ userId, userName }: DashboardProps) => {
  const [summary, setSummary] = useState<UserSummary | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      // Fetch user profile data
      const profileResponse = await healthcareApi.greetUser(userId);
      if (profileResponse.success && profileResponse.user) {
        setUserProfile(profileResponse.user);
      }
      
      // Fetch health summary data
      const summaryData = await healthcareApi.getUserSummary(userId);
      setSummary(summaryData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Set up interval to refresh data every 30 seconds
    const interval = setInterval(() => {
      fetchData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [userId]);

  const getGlucoseStatus = (glucose?: number) => {
    if (!glucose) return { status: 'Unknown', color: 'text-muted-foreground' };
    if (glucose < 70) return { status: 'Low', color: 'text-destructive' };
    if (glucose > 140) return { status: 'High', color: 'text-orange-500' };
    return { status: 'Normal', color: 'text-primary' };
  };

  // Make sure we're getting the latest glucose reading
  const data = summary?.cgm_summary?.data;
  const latestGlucose = data?.length
    ? data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)).at(-1)?.glucose
    : undefined;
  const glucoseStatus = getGlucoseStatus(latestGlucose);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Profile Section */}
      <Card className="shadow-elegant" style={{ borderRadius: '16px' }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            Health Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="text-lg font-semibold">
                {userProfile?.first_name} {userProfile?.last_name}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Location
              </p>
              <p className="text-lg font-semibold">{userProfile?.city || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <UtensilsCrossed className="h-3 w-3" />
                Dietary Preferences
              </p>
              <p className="text-lg font-semibold">{userProfile?.dietary_preference || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Medical Conditions
              </p>
              <p className="text-lg font-semibold">
                {userProfile?.medical_conditions && userProfile.medical_conditions.length > 0 
                  ? userProfile.medical_conditions.join(', ') 
                  : 'None reported'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Droplet className="h-3 w-3" />
                Latest Glucose
              </p>
              <p className={`text-lg font-semibold ${glucoseStatus.color}`}>
                {latestGlucose ? `${latestGlucose} mg/dL` : 'No data'} 
                {latestGlucose && <span className="text-sm ml-2">({glucoseStatus.status})</span>}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CGMChart userId={userId} />
        <MoodChart userId={userId} />
      </div>
    </div>
  );
};

const UtensilsCrossed = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8" />
    <path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7" />
    <path d="m2.1 21.8 6.4-6.3" />
    <path d="m19 5-7 7" />
  </svg>
);