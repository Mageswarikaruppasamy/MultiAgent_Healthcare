import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { healthcareApi, CGMData } from '@/services/api';
import { Card } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

interface CGMChartProps {
  userId: number;
}

export const CGMChart = ({ userId }: CGMChartProps) => {
  const [data, setData] = useState<CGMData[]>([]);
  const [loading, setLoading] = useState(true);
  const [average, setAverage] = useState<number>(0);

  const fetchData = async () => {
    try {
      const response = await healthcareApi.getCGMStats(userId);
      if (response.success && response.data) {
        const sortedData = [...response.data].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        setData(sortedData);
        setAverage(response.average || 0);
      }
    } catch (error) {
      console.error('Error fetching CGM data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userId]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const chartData = data.map(item => ({
    date: formatTimestamp(item.timestamp),
    glucose: item.glucose,
    color:
      item.glucose < 80
        ? '#3b82f6' // Blue for low
        : item.glucose <= 140
        ? '#22c55e' // Green for normal
        : '#ef4444', // Red for high
  }));

  if (loading) {
    return (
      <Card className="p-6" style={{ 
        boxShadow: 'var(--shadow-card)', 
        background: 'linear-gradient(180deg, rgba(230,245,255,0.8), rgba(255,255,255,1))', 
        borderRadius: '16px' 
      }}>
        <div className="flex items-center justify-center h-[300px]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </Card>
    );
  }

  return (
    <Card
      className="p-6"
      style={{
        boxShadow: 'var(--shadow-card)',
        background: 'linear-gradient(180deg, rgba(230,245,255,0.8), rgba(255,255,255,1))',
        borderRadius: '16px'
      }}
    >
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h3 className="text-xl font-semibold mb-1">Glucose Readings</h3>
          <p className="text-sm text-muted-foreground">Last 7 days</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Avg</p>
            <p className="text-lg font-bold text-primary">{average.toFixed(0)} mg/dL</p>
          </div>
        </div>
      </div>

      {chartData.length > 0 ? (
        <div className="w-full">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 20, left: -30, bottom: 10 }}
            >
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: '12px' }}
                domain={[60, 180]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '10px',
                }}
              />
              <Line
                type="monotone"
                dataKey="glucose"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ r: 6, strokeWidth: 2, fill: '#fff' }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex items-center justify-center h-[300px] text-muted-foreground">
          No glucose data available yet
        </div>
      )}
    </Card>
  );
};
