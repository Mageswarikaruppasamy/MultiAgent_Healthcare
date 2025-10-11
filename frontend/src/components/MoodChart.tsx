import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { healthcareApi, MoodData } from '@/services/api';
import { Card } from '@/components/ui/card';
import { Smile } from 'lucide-react';

interface MoodChartProps {
  userId: number;
}

export const MoodChart = ({ userId }: MoodChartProps) => {
  const [data, setData] = useState<MoodData[]>([]);
  const [loading, setLoading] = useState(true);
  const [average, setAverage] = useState<number>(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await healthcareApi.getMoodStats(userId);
        if (response.success && response.data) {
          const sortedData = [...response.data].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          setData(sortedData);
          setAverage(response.average || 0);
        }
      } catch (error) {
        console.error('Error fetching mood data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId]);

  const last7Moods = data.slice(-7);

  const moodCounts: Record<string, number> = {};
  const moodColors: Record<string, string> = {
    happy: '#22c55e',
    calm: '#8b5cf6',
    energetic: '#3b82f6',
    tired: '#9ca3af',
    sad: '#60a5fa',
    anxious: '#f59e0b',
    angry: '#ef4444'
  };

  last7Moods.forEach((item) => {
    const mood = item.mood.toLowerCase();
    moodCounts[mood] = (moodCounts[mood] || 0) + 1;
  });

  const barChartData = Object.entries(moodCounts).map(([mood, count]) => ({
    mood: mood.charAt(0).toUpperCase() + mood.slice(1),
    count,
    fill: moodColors[mood] || '#6b7280'
  }));

  if (loading) {
    return (
      <Card className="p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center justify-center h-[300px]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6" style={{ boxShadow: 'var(--shadow-card)', background: 'linear-gradient(180deg, rgba(230, 255, 240, 0.8), rgba(255,255,255,1))'}}>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h3 className="text-xl font-semibold mb-1">Mood Overview</h3>
          <p className="text-sm text-muted-foreground">Last 7 mood entries</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-secondary/10 px-4 py-2">
          <Smile className="h-5 w-5 text-secondary" />
          <div>
            <p className="text-xs text-muted-foreground">Average</p>
            <p className="text-lg font-bold text-secondary">{average.toFixed(1)}/5</p>
          </div>
        </div>
      </div>

      {barChartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={barChartData}>
            {/* Remove CartesianGrid for cleaner look */}
            <XAxis
              dataKey="mood"
              stroke="hsl(var(--muted-foreground))"
              tickLine={false}
              axisLine={false}
              style={{ fontSize: '12px' }}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              tickLine={false}
              axisLine={false}
              style={{ fontSize: '12px' }}
              domain={[0, Math.max(...Object.values(moodCounts)) + 1]}
            />
            <Tooltip
              cursor={{ fill: 'rgba(0,0,0,0.05)' }}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '10px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}
              labelStyle={{ fontWeight: 600 }}
              formatter={(value) => [`${value}`, 'Count']}
            />
            <Legend />
            <Bar dataKey="count" radius={[10, 10, 0, 0]} name="Mood Count">
              {barChartData.map((entry, index) => (
                <defs key={`gradient-${index}`}>
                  <linearGradient id={`colorGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={entry.fill} stopOpacity={0.9} />
                    <stop offset="95%" stopColor={entry.fill} stopOpacity={0.4} />
                  </linearGradient>
                </defs>
              ))}
              {barChartData.map((entry, index) => (
                <Bar key={index} dataKey="count" fill={`url(#colorGradient-${index})`} radius={[10, 10, 0, 0]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-[300px] text-muted-foreground">
          No mood data available yet
        </div>
      )}
    </Card>
  );
};
