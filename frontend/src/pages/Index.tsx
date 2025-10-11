import { useState } from 'react';
import { Login } from '@/components/Login';
import { Navigation } from '@/components/Navigation';
import { Dashboard } from '@/components/Dashboard';
import { MoodTracker } from '@/components/MoodTracker';
import { GlucoseMonitor } from '@/components/GlucoseMonitor';
import { FoodLogger } from '@/components/FoodLogger';
import { MealPlanGenerator } from '@/components/MealPlanGenerator';
import { AIAssistant } from '@/components/AIAssistant';

const Index = () => {
  const [userId, setUserId] = useState<number | null>(null);
  const [userName, setUserName] = useState('User');
  const [activeSection, setActiveSection] = useState('dashboard');

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
      case 'chat':
        return <AIAssistant userId={userId} />;
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
      <div className="container mx-auto px-4 py-8">
        {renderSection()}
      </div>
    </div>
  );
};

export default Index;
