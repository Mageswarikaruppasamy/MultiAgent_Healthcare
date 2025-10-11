import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { healthcareApi } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { Clock } from 'lucide-react';

interface FoodLoggerProps {
  userId: number;
}

interface FoodLog {
  timestamp: string;
  meal_description: string;
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
}

export const FoodLogger = ({ userId }: FoodLoggerProps) => {
  const [mealDescription, setMealDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [recentLogs, setRecentLogs] = useState<FoodLog[]>([]);
  const [fetchingLogs, setFetchingLogs] = useState(true);

  useEffect(() => {
    fetchRecentLogs();
  }, [userId]);

  const fetchRecentLogs = async () => {
    try {
      const response = await healthcareApi.getFoodStats(userId);
      if (response.success && response.data) {
      setRecentLogs(response.data.slice(0, 5)); // shows the latest 5 at the top
    }
    } catch (error) {
      console.error('Error fetching food logs:', error);
      toast({
        title: "Error",
        description: "Failed to fetch food logs. Please try again.",
        variant: "destructive"
      });
    } finally {
      setFetchingLogs(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!mealDescription.trim()) {
      toast({
        title: "Validation Error",
        description: "Please describe your meal.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await healthcareApi.logFood(userId, mealDescription);
      
      if (response.success) {
        toast({
          title: "Food Logged",
          description: response.message || "Your meal has been logged successfully."
        });
        setMealDescription('');
        fetchRecentLogs(); // Refresh the logs
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to log food.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "Unable to log food. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Function to check if all nutrition values are 0 or undefined
  const hasValidNutritionData = (log: FoodLog) => {
    return log.calories !== undefined || log.protein !== undefined || 
           log.carbohydrates !== undefined || log.fat !== undefined;
  };

  // Function to check if all nutrition values are 0
  const hasZeroNutritionData = (log: FoodLog) => {
    return log.calories === 0 && log.protein === 0 && 
           log.carbohydrates === 0 && log.fat === 0;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Food Logging Form */}
      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-primary" />
            Log Your Meal
          </CardTitle>
          <CardDescription>Describe what you ate or drank</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              value={mealDescription}
              onChange={(e) => setMealDescription(e.target.value)}
              placeholder="E.g., Grilled chicken breast with steamed broccoli and brown rice"
              className="min-h-[150px]"
              disabled={loading}
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                  Logging...
                </>
              ) : (
                'Log Food'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Recent Logs */}
      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle>Recent Food Logs</CardTitle>
          <CardDescription>Your last 5 meals</CardDescription>
        </CardHeader>
        <CardContent>
          {fetchingLogs ? (
            <div className="flex items-center justify-center h-[200px]">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : recentLogs.length > 0 ? (
            <div className="space-y-4">
              {recentLogs.map((log, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <p className="font-medium">{log.meal_description}</p>
                    <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                  </div>
                  {/* Nutrition information */}
                  {hasValidNutritionData(log) ? (
                    hasZeroNutritionData(log) ? (
                      <div className="text-sm text-muted-foreground italic">
                        Nutrition analysis not available for this meal
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>Calories: {log.calories !== undefined ? log.calories : 'N/A'}</div>
                        <div>Protein: {log.protein !== undefined ? `${log.protein}g` : 'N/A'}</div>
                        <div>Carbs: {log.carbohydrates !== undefined ? `${log.carbohydrates}g` : 'N/A'}</div>
                        <div>Fat: {log.fat !== undefined ? `${log.fat}g` : 'N/A'}</div>
                      </div>
                    )
                  ) : (
                    <div className="text-sm text-muted-foreground italic">
                      No nutrition data available
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(log.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No food logs yet. Start logging your meals!
            </div>
          )}
        </CardContent>
      </Card>
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