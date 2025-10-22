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
import { MessageCircle } from 'lucide-react';
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
    <div className="min-h-screen bg-background">
      <Navigation
        userName={userName}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onLogout={handleLogout}
      />
      <div className="flex flex-col md:flex-row">
        {/* Main content area */}
        <div className={`flex-1 ${isMobile && isAIAssistantOpen ? 'hidden' : 'block'}`}>
          <div className="container mx-auto px-4 py-8">
            {renderSection()}
          </div>
        </div>
        
        {/* AI Assistant - Sidebar on desktop, Bottom panel on mobile */}
        {!isMobile ? (
          // Desktop: Always visible sidebar
          <div className="w-96 border-l bg-card/50 backdrop-blur-sm p-4 hidden md:block">
            <AIAssistant userId={userId} />
          </div>
        ) : (
          // Mobile: Toggleable bottom panel
          <>
            {isAIAssistantOpen && (
              <div className="fixed inset-0 z-50 bg-background md:hidden">
                <div className="flex h-full flex-col">
                  <div className="border-b p-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Healthcare Assistant</h3>
                    <Button variant="ghost" size="icon" onClick={() => setIsAIAssistantOpen(false)}>
                      ✕
                    </Button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <AIAssistant userId={userId} />
                  </div>
                </div>
              </div>
            )}
            {/* Floating button to open AI Assistant on mobile */}
            {!isAIAssistantOpen && (
              <div className="fixed bottom-4 right-4 z-40 md:hidden">
                <Button 
                  size="icon" 
                  className="h-14 w-14 rounded-full shadow-lg"
                  onClick={() => setIsAIAssistantOpen(true)}
                >
                  <MessageCircle className="h-6 w-6" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Index;