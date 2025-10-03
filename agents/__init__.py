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

# Simple imports without trying to import from agno_workspace
__all__ = []

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