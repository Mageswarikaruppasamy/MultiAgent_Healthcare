# agents/__init__.py
"""
Healthcare Multi-Agent Demo - Agents Module

This module contains the multi-agent system implementation using Agno framework.
It includes six specialized agents for healthcare tracking and management:

- GreetingAgent: User authentication and personalized welcome
- MoodTrackerAgent: Emotional state monitoring with trend analysis
- CGMAgent: Continuous glucose monitoring with intelligent alerts
- FoodIntakeAgent: Meal logging with AI-powered nutrition analysis
- MealPlannerAgent: Personalized meal recommendations
- InterruptAgent: General Q&A and contextual help system
"""

__version__ = "1.0.0"
__author__ = "Healthcare Multi-Agent Demo Team"

# Import agent classes from agno_workspace
try:
    from .agno_workspace.agents.greeting_agent import GreetingAgent
    from .agno_workspace.agents.mood_tracker_agent import MoodTrackerAgent
    from .agno_workspace.agents.cgm_agent import CGMAgent
    from .agno_workspace.agents.food_intake_agent import FoodIntakeAgent
    from .agno_workspace.agents.meal_planner_agent import MealPlannerAgent
    from .agno_workspace.agents.interrupt_agent import InterruptAgent
    
    __all__ = [
        'GreetingAgent',
        'MoodTrackerAgent', 
        'CGMAgent',
        'FoodIntakeAgent',
        'MealPlannerAgent',
        'InterruptAgent'
    ]
    
except ImportError as e:
    print(f"Warning: Could not import agents from agno_workspace: {e}")
    print("Make sure the agno_workspace is properly initialized")
    
    # Fallback - define empty classes for development
    class GreetingAgent:
        """Placeholder for GreetingAgent"""
        def __init__(self):
            pass
        def process(self, inputs):
            return {"success": False, "message": "Agent not properly initialized"}
    
    class MoodTrackerAgent:
        """Placeholder for MoodTrackerAgent"""
        def __init__(self):
            self.mood_values = {
                'happy': 5, 'excited': 5, 'energetic': 4, 'calm': 4,
                'content': 3, 'neutral': 3, 'tired': 2, 'anxious': 2,
                'stressed': 1, 'sad': 1, 'angry': 1
            }
        def process(self, inputs):
            return {"success": False, "message": "Agent not properly initialized"}
    
    class CGMAgent:
        """Placeholder for CGMAgent"""
        def __init__(self):
            pass
        def process(self, inputs):
            return {"success": False, "message": "Agent not properly initialized"}
    
    class FoodIntakeAgent:
        """Placeholder for FoodIntakeAgent"""
        def __init__(self):
            pass
        def process(self, inputs):
            return {"success": False, "message": "Agent not properly initialized"}
    
    class MealPlannerAgent:
        """Placeholder for MealPlannerAgent"""
        def __init__(self):
            pass
        def process(self, inputs):
            return {"success": False, "message": "Agent not properly initialized"}
    
    class InterruptAgent:
        """Placeholder for InterruptAgent"""
        def __init__(self):
            pass
        def process(self, inputs):
            return {"success": False, "message": "Agent not properly initialized"}
    
    __all__ = [
        'GreetingAgent',
        'MoodTrackerAgent', 
        'CGMAgent',
        'FoodIntakeAgent',
        'MealPlannerAgent',
        'InterruptAgent'
    ]

# Agent configuration
AGENT_CONFIG = {
    'greeting_agent': {
        'name': 'Greeting Agent',
        'description': 'Handles user authentication and personalized welcome',
        'entry_point': True
    },
    'mood_tracker_agent': {
        'name': 'Mood Tracker',
        'description': 'Tracks emotional state with trend analysis',
        'category': 'health_tracking'
    },
    'cgm_agent': {
        'name': 'CGM Monitor', 
        'description': 'Continuous glucose monitoring with alerts',
        'category': 'health_monitoring'
    },
    'food_intake_agent': {
        'name': 'Food Logger',
        'description': 'Meal logging with AI nutrition analysis', 
        'category': 'nutrition_tracking'
    },
    'meal_planner_agent': {
        'name': 'Meal Planner',
        'description': 'Personalized meal recommendations',
        'category': 'meal_planning'
    },
    'interrupt_agent': {
        'name': 'AI Assistant',
        'description': 'General Q&A and contextual help',
        'category': 'general_assistance',
        'interrupt_handler': True
    }
}

# Database tables used by agents
DATABASE_TABLES = [
    'users',
    'mood_logs', 
    'cgm_readings',
    'food_logs',
    'meal_plans'
]