import { useState } from 'react';
import { Login } from '@/components/Login';
import { Navigation } from '@/components/Navigation';
import { Dashboard } from '@/components/Dashboard';
import { MoodTracker } from '@/components/MoodTracker';
import { GlucoseMonitor } from '@/components/GlucoseMonitor';
import { FoodLogger } from '@/components/FoodLogger';
import { MealPlanGenerator } from '@/components/MealPlanGenerator';
import { AIAssistant } from '@/components/AIAssistant';
import { Button } from '@/components/ui/button';
import { MessageCircle, X } from 'lucide-react';
import { useMediaQuery } from 'react-responsive';

const Index = () => {
  const [userId, setUserId] = useState<number | null>(null);
  const [userName, setUserName] = useState('User');
  const [activeSection, setActiveSection] = useState('dashboard');
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  
  // Check if the device is mobile
  const isMobile = useMediaQuery({ maxWidth: 768 });

  const handleLogin = async (id: number) => {
    setUserId(id);
    setUserName(`User ${id}`);
    
    // Optionally fetch user profile to get actual name
    try {
      const { healthcareApi } = await import('@/services/api');
      const response = await healthcareApi.greetUser(id);
      if (response.success && response.user) {
        setUserName(response.user.first_name || `User ${id}`);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const handleLogout = () => {
    setUserId(null);
    setUserName('User');
    setActiveSection('dashboard');
  };

  if (!userId) {
    return <Login onLogin={handleLogin} />;
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <Dashboard userId={userId} userName={userName} />;
      case 'mood':
        return <MoodTracker userId={userId} />;
      case 'glucose':
        return <GlucoseMonitor userId={userId} />;
      case 'food':
        return <FoodLogger userId={userId} />;
      case 'meal':
        return <MealPlanGenerator userId={userId} />;
      // Note: We're removing the chat section since AI Assistant will be always available
      default:
        return <Dashboard userId={userId} userName={userName} />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Show full screen AI Assistant when open on mobile */}
      {isMobile && isAIAssistantOpen ? (
        <div className="flex flex-col h-screen">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-xl font-semibold">Healthcare Assistant</h2>
            <Button variant="ghost" size="icon" onClick={() => setIsAIAssistantOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            <AIAssistant userId={userId} />
          </div>
        </div>
      ) : (
        <>
          <Navigation
            userName={userName}
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            onLogout={handleLogout}
          />
          <div className="flex flex-1 overflow-hidden">
            {/* Main content area */}
            <div className="flex-1 overflow-auto">
              <div className="container mx-auto px-4 py-8">
                {renderSection()}
              </div>
            </div>
            
            {/* Desktop: Always visible sidebar */}
            {!isMobile && (
              <div className="w-96 border-l bg-card/50 backdrop-blur-sm p-4 hidden md:block">
                <div className="h-full overflow-hidden">
                  <AIAssistant userId={userId} />
                </div>
              </div>
            )}
          </div>
          
          {/* Mobile: Floating AI Assistant Button */}
          {isMobile && !isAIAssistantOpen && (
            <Button
              className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
              onClick={() => setIsAIAssistantOpen(true)}
            >
              <MessageCircle className="h-6 w-6" />
            </Button>
          )}
        </>
      )}
    </div>
  );
};

export default Index;