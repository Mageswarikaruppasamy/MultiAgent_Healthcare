import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Activity, Heart, Droplet, UtensilsCrossed, CalendarDays, Menu, X } from 'lucide-react';

interface NavigationProps {
  userName: string;
  activeSection: string;
  onSectionChange: (section: string) => void;
  onLogout: () => void;
}

export const Navigation = ({ userName, activeSection, onSectionChange, onLogout }: NavigationProps) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const sections = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'mood', label: 'Mood Tracker', icon: Heart },
    { id: 'glucose', label: 'Glucose Monitor', icon: Droplet },
    { id: 'food', label: 'Food Logger', icon: UtensilsCrossed },
    { id: 'meal', label: 'Meal Planner', icon: CalendarDays },
  ];

  return (
    <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-20">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        {/* User greeting */}
        <h2 className="text-base sm:text-lg font-semibold truncate">
          Welcome, {userName}!
        </h2>

        {/* Mobile menu toggle */}
        <button
          className="sm:hidden p-2 rounded-md border hover:bg-gray-100"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* Logout button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onLogout}
          className="ml-2 hidden sm:flex gap-2"
        >
          Logout
        </Button>
      </div>

      {/* Navigation sections */}
      {/* Horizontal menu for larger screens */}
      <div className="hidden sm:flex container mx-auto px-4 pb-2 gap-2">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          return (
            <Button
              key={section.id}
              variant={isActive ? 'default' : 'ghost'}
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

      {/* Mobile vertical menu */}
      {menuOpen && (
        <div className="sm:hidden bg-card/90 backdrop-blur-md border-t px-4 py-2 flex flex-col gap-2">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <Button
                key={section.id}
                variant={isActive ? 'default' : 'ghost'}
                size="sm"
                onClick={() => {
                  onSectionChange(section.id);
                  setMenuOpen(false); // close menu on selection
                }}
                className="gap-2 justify-start w-full"
              >
                <Icon className="h-4 w-4" />
                {section.label}
              </Button>
            );
          })}
          <Button
            variant="outline"
            size="sm"
            onClick={onLogout}
            className="gap-2 w-full mt-2"
          >
            Logout
          </Button>
        </div>
      )}
    </div>
  );
};
