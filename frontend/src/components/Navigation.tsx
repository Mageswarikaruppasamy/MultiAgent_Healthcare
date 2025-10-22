import { Button } from '@/components/ui/button';
import { Activity, Heart, Droplet, UtensilsCrossed, CalendarDays } from 'lucide-react';

interface NavigationProps {
  userName: string;
  activeSection: string;
  onSectionChange: (section: string) => void;
  onLogout: () => void;
}

export const Navigation = ({ userName, activeSection, onSectionChange, onLogout }: NavigationProps) => {
  const sections = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'mood', label: 'Mood Tracker', icon: Heart },
    { id: 'glucose', label: 'Glucose Monitor', icon: Droplet },
    { id: 'food', label: 'Food Logger', icon: UtensilsCrossed },
    { id: 'meal', label: 'Meal Planner', icon: CalendarDays },
    // Removed chat section since AI Assistant is always available
  ];

  return (
    <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-4">
          <h2 className="text-lg font-semibold">Welcome, {userName}!</h2>
          <Button variant="outline" size="sm" onClick={onLogout} className="gap-2">
            Logout
          </Button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-4 -mb-px">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <Button
                key={section.id}
                variant={isActive ? "default" : "ghost"}
                size="sm"
                onClick={() => onSectionChange(section.id)}
                className="gap-2 whitespace-nowrap"
              >
                <Icon className="h-4 w-4" />
                {section.label}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
};