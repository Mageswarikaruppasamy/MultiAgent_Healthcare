import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { healthcareApi } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { Smile, Frown, Angry, Wind, Coffee, AlertCircle } from 'lucide-react';

interface MoodTrackerProps {
  userId: number;
  onMoodLogged?: () => void;
}

export const MoodTracker = ({ userId, onMoodLogged }: MoodTrackerProps) => {
  const [moodText, setMoodText] = useState('');
  const [loading, setLoading] = useState(false);

  const moods = [
    { name: 'Happy', icon: Smile, color: 'bg-green-500/10 text-green-500 hover:bg-green-500/20' },
    { name: 'Sad', icon: Frown, color: 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20' },
    { name: 'Angry', icon: Angry, color: 'bg-red-500/10 text-red-500 hover:bg-red-500/20' },
    { name: 'Calm', icon: Wind, color: 'bg-purple-500/10 text-purple-500 hover:bg-purple-500/20' },
    { name: 'Tired', icon: Coffee, color: 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20' },
    { name: 'Anxious', icon: AlertCircle, color: 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20' },
  ];

  const handleMoodSubmit = async (mood: string, isQuickSelect: boolean = false) => {
    setLoading(true);
    try {
      const response = await healthcareApi.logMood(
        userId,
        mood.toLowerCase(),
        isQuickSelect ? undefined : moodText
      );
      
      if (response.success) {
        toast({
          title: "Mood Logged",
          description: response.message || `Your mood has been recorded successfully.`
        });
        setMoodText('');
        onMoodLogged?.();
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to log mood.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "Unable to log mood. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-elegant">
      <CardHeader>
        <CardTitle>How are you feeling today?</CardTitle>
        <CardDescription>Select a mood or describe how you're feeling</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quick Select Moods */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {moods.map((mood) => {
            const Icon = mood.icon;
            return (
              <Button
                key={mood.name}
                variant="outline"
                className={`h-24 flex flex-col gap-2 ${mood.color} transition-all`}
                onClick={() => handleMoodSubmit(mood.name, true)}
                disabled={loading}
              >
                <Icon className="h-8 w-8" />
                <span className="font-medium">{mood.name}</span>
              </Button>
            );
          })}
        </div>

        {/* Text Input */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Describe your mood</label>
          <Textarea
            value={moodText}
            onChange={(e) => setMoodText(e.target.value)}
            placeholder="I'm feeling..."
            className="min-h-[100px]"
            disabled={loading}
          />
          <Button
            onClick={() => handleMoodSubmit(moodText)}
            disabled={loading || !moodText.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                Logging...
              </>
            ) : (
              'Log Mood'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
