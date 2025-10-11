import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { healthcareApi } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { Heart } from 'lucide-react';

interface LoginProps {
  onLogin: (userId: number) => void;
}

export const Login = ({ onLogin }: LoginProps) => {
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const id = parseInt(userId);
    if (!id || id < 1 || id > 100) {
      toast({
        title: "Invalid User ID",
        description: "Please enter a valid user ID between 1 and 100.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await healthcareApi.greetUser(id);
      if (response.success) {
        toast({
          title: "Login Successful",
          description: response.message || `Welcome, User ${id}!`
        });
        onLogin(id);
      } else {
        toast({
          title: "Login Failed",
          description: response.message || "User not found.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "Unable to connect to the server. Please ensure the backend is running.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-accent/20 p-4">
      <Card className="w-full max-w-md shadow-elegant">
        <CardHeader className="text-center space-y-4">
          {/* Blue Heart Icon */}
          <div className="mx-auto w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
            <Heart className="h-10 w-10 text-blue-600" />
          </div>
          <CardTitle className="text-3xl"><b>Healthcare Assistant</b></CardTitle>
          <CardDescription>Your AI Powered Health Companion</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="userId" className="text-sm font-medium"></label>
              <Input
                id="userId"
                type="number"
                min="1"
                max="100"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter your user ID (1 - 100)"
                disabled={loading}
                className="text-center text-lg"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
