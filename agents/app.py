# agents/app.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
import sys
import os

# Set DATABASE_PATH environment variable to point to data directory
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.environ['DATABASE_PATH'] = os.path.join(project_root, 'data', 'healthcare_data.db')

# Add the agno_workspace to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'agno_workspace'))

# Import agents
from agents.greeting_agent import GreetingAgent
from agents.mood_tracker_agent import MoodTrackerAgent
from agents.cgm_agent import CGMAgent
from agents.food_intake_agent import FoodIntakeAgent
from agents.meal_planner_agent import MealPlannerAgent
from agents.interrupt_agent import InterruptAgent

app = FastAPI(title="Healthcare Multi-Agent API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:3001"],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize agents
greeting_agent = GreetingAgent()
mood_tracker_agent = MoodTrackerAgent()
cgm_agent = CGMAgent()
food_intake_agent = FoodIntakeAgent()
meal_planner_agent = MealPlannerAgent()
interrupt_agent = InterruptAgent()

# Pydantic models for request validation
class GreetingRequest(BaseModel):
    user_id: int

class MoodRequest(BaseModel):
    user_id: int
    mood: Optional[str] = None
    action: str = "log"

class CGMRequest(BaseModel):
    user_id: int
    glucose_reading: Optional[int] = None
    action: str = "log"

class FoodRequest(BaseModel):
    user_id: int
    meal_description: Optional[str] = None
    action: str = "log"

class MealPlanRequest(BaseModel):
    user_id: int
    special_requirements: Optional[str] = None
    action: str = "generate"

class InterruptRequest(BaseModel):
    user_id: Optional[int] = None
    query: str
    current_context: Optional[Dict[str, Any]] = None

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "Healthcare Multi-Agent API is running"}

# Agent endpoints
@app.post("/api/greet")
async def greet_user(request: GreetingRequest):
    """Greet user and validate user ID"""
    try:
        result = greeting_agent.process({
            'user_id': request.user_id
        })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Greeting agent error: {str(e)}")

@app.post("/api/mood")
async def track_mood(request: MoodRequest):
    """Track user mood or get mood statistics"""
    try:
        result = mood_tracker_agent.process({
            'user_id': request.user_id,
            'mood': request.mood,
            'action': request.action
        })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mood tracker error: {str(e)}")

@app.post("/api/cgm")
async def manage_cgm(request: CGMRequest):
    """Log CGM reading, generate reading, or get statistics"""
    try:
        result = cgm_agent.process({
            'user_id': request.user_id,
            'glucose_reading': request.glucose_reading,
            'action': request.action
        })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CGM agent error: {str(e)}")

@app.post("/api/food")
async def manage_food_intake(request: FoodRequest):
    """Log food intake or get nutrition statistics"""
    try:
        result = food_intake_agent.process({
            'user_id': request.user_id,
            'meal_description': request.meal_description,
            'action': request.action
        })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Food intake agent error: {str(e)}")

@app.post("/api/meal-plan")
async def manage_meal_plan(request: MealPlanRequest):
    """Generate meal plan or get latest meal plan"""
    try:
        result = meal_planner_agent.process({
            'user_id': request.user_id,
            'special_requirements': request.special_requirements,
            'action': request.action
        })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Meal planner agent error: {str(e)}")

@app.post("/api/interrupt")
async def handle_interrupt(request: InterruptRequest):
    """Handle general questions and interrupts"""
    try:
        result = interrupt_agent.process({
            'user_id': request.user_id,
            'query': request.query,
            'current_context': request.current_context or {}
        })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Interrupt agent error: {str(e)}")

# Utility endpoints
@app.get("/api/users/{user_id}/summary")
async def get_user_summary(user_id: int):
    """Get comprehensive user summary"""
    try:
        # Get data from multiple agents
        mood_result = mood_tracker_agent.process({
            'user_id': user_id,
            'action': 'get_stats'
        })
        
        cgm_result = cgm_agent.process({
            'user_id': user_id,
            'action': 'get_stats'
        })
        
        food_result = food_intake_agent.process({
            'user_id': user_id,
            'action': 'get_stats'
        })
        
        meal_plan_result = meal_planner_agent.process({
            'user_id': user_id,
            'action': 'get_latest'
        })
        
        return {
            'success': True,
            'mood_summary': mood_result,
            'cgm_summary': cgm_result,
            'nutrition_summary': food_result,
            'latest_meal_plan': meal_plan_result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summary error: {str(e)}")

@app.get("/api/available-moods")
async def get_available_moods():
    """Get list of available mood options"""
    return {
        'moods': list(mood_tracker_agent.mood_values.keys()),
        'mood_values': mood_tracker_agent.mood_values
    }

# Error handlers
@app.exception_handler(404)
async def not_found_handler(request, exc):
    return JSONResponse(
        status_code=404,
        content={"error": "Endpoint not found", "detail": "The requested endpoint does not exist"}
    )

@app.exception_handler(500)
async def internal_error_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": "An unexpected error occurred"}
    )

if __name__ == "__main__":
    import uvicorn
    
    # Ensure DATABASE_PATH is set correctly
    if not os.getenv('DATABASE_PATH'):
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        os.environ['DATABASE_PATH'] = os.path.join(project_root, 'data', 'healthcare_data.db')
    
    print(f"📊 Database Path: {os.environ.get('DATABASE_PATH')}")
    print(f"📊 Database Exists: {os.path.exists(os.environ.get('DATABASE_PATH', ''))}")
    
    uvicorn.run(
        "app:app",  # Use import string for reload to work
        host="localhost", 
        port=8000,
        reload=True,
        log_level="info"
    )