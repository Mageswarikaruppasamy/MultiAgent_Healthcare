# agents/app.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
import sys
import os
from dotenv import load_dotenv

# Load environment variables from .env file
print("📁 Loading environment variables from .env file...")
# Get the absolute path of the .env file
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
print(f"📁 .env file exists: {os.path.exists(env_path)}")

load_dotenv(dotenv_path=env_path, override=True)
print("📁 Environment loading completed.")

# Debug: Print environment variables
gemini_key = os.getenv('GEMINI_API_KEY')
google_key = os.getenv('GOOGLE_API_KEY')

print(f"🔍 Loaded GEMINI_API_KEY: {'<hidden>' if gemini_key else 'None'}")
print(f"🔍 GEMINI_API_KEY length: {len(gemini_key) if gemini_key else 0}")
print(f"🔍 Loaded GOOGLE_API_KEY: {'<hidden>' if google_key else 'None'}")
print(f"🔍 GOOGLE_API_KEY length: {len(google_key) if google_key else 0}")

# Explicitly handle API key conflicts
# Use GOOGLE_API_KEY as primary, fallback to GEMINI_API_KEY
GENAI_API_KEY = None
if google_key and google_key not in ['YOUR_GOOGLE_API_KEY_PLACEHOLDER', 'YOUR_ACTUAL_GOOGLE_API_KEY_HERE', 'your_actual_gemini_api_key_here']:
    GENAI_API_KEY = google_key
    print("🔑 Using GOOGLE_API_KEY for authentication")
elif gemini_key and gemini_key not in ['YOUR_GEMINI_API_KEY_PLACEHOLDER', 'YOUR_ACTUAL_GOOGLE_API_KEY_HERE', 'your_actual_gemini_api_key_here']:
    GENAI_API_KEY = gemini_key
    print("🔑 Using GEMINI_API_KEY for authentication")
else:
    print("⚠️ No valid API key found. LLM features will use fallback mechanisms.")

# Set the API key in environment for agents to use
if GENAI_API_KEY:
    os.environ['GOOGLE_API_KEY'] = GENAI_API_KEY
    os.environ['GEMINI_API_KEY'] = GENAI_API_KEY

# Set DATABASE_PATH environment variable to point to data directory
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.environ['DATABASE_PATH'] = os.path.join(project_root, 'data', 'healthcare_data.db')

# Add the agno_workspace/agents to Python path
agno_agents_path = os.path.join(os.path.dirname(__file__), 'agno_workspace', 'agents')
sys.path.insert(0, agno_agents_path)
print(f"📁 Added to Python path: {agno_agents_path}")

# Import agents and their run_tool functions
from greeting_agent import greeting_agent, run_tool as run_greeting_tool
from mood_tracker_agent import mood_agent, run_tool as run_mood_tool
from cgm_agent import cgm_agent, run_tool as run_cgm_tool
from food_intake_agent import food_agent, run_tool as run_food_tool
from meal_planner_agent import meal_agent as meal_planner_agent, run_tool as run_meal_tool
from interrupt_agent import interrupt_agent_instance, run_tool as run_interrupt_tool

app = FastAPI(title="Healthcare Multi-Agent API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:3001",
        "https://multiagent-healthcare-frontend.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize agents
greeting_agent = greeting_agent
mood_tracker_agent = mood_agent
cgm_agent = cgm_agent
food_intake_agent = food_agent
meal_planner_agent = meal_planner_agent
interrupt_agent = interrupt_agent_instance

# Pydantic models for request validation
class GreetingRequest(BaseModel):
    user_id: int

class MoodRequest(BaseModel):
    user_id: int
    mood: Optional[str] = None
    action: str = "log"
    user_input: Optional[str] = None

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
        result = run_greeting_tool(greeting_agent, "greet_user", user_id=request.user_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Greeting agent error: {str(e)}")

@app.post("/api/mood")
async def track_mood(request: MoodRequest):
    """Track user mood or get mood statistics"""
    try:
        # Prepare parameters for the mood tracker tool
        params = {
            'user_id': request.user_id,
            'action': request.action
        }
        
        # Add mood parameter if provided
        if request.mood:
            params['mood'] = request.mood
            
        # Add user_input parameter if provided
        if request.user_input:
            params['user_input'] = request.user_input
            
        result = run_mood_tool(mood_tracker_agent, "mood_tracker", **params)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mood tracker error: {str(e)}")

@app.post("/api/cgm")
async def manage_cgm(request: CGMRequest):
    """Log CGM reading, generate reading, or get statistics"""
    try:
        # Prepare parameters for the CGM tool
        params = {
            'user_id': request.user_id,
            'action': request.action
        }
        
        # Add glucose_reading parameter if provided
        if request.glucose_reading is not None:
            params['glucose_reading'] = request.glucose_reading
            
        result = run_cgm_tool(cgm_agent, "check_glucose", **params)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CGM agent error: {str(e)}")

@app.post("/api/food")
async def manage_food_intake(request: FoodRequest):
    """Log food intake or get nutrition statistics"""
    try:
        # Prepare parameters for the food intake tool
        params = {
            'user_id': request.user_id,
            'action': request.action
        }
        
        # Add meal_description parameter if provided
        if request.meal_description:
            params['meal_description'] = request.meal_description
            
        result = run_food_tool(food_intake_agent, "food_intake", **params)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Food intake agent error: {str(e)}")

@app.post("/api/meal-plan")
async def manage_meal_plan(request: MealPlanRequest):
    """Generate meal plan or get latest meal plan"""
    try:
        # Prepare parameters for the meal planner tool
        params = {
            'user_id': request.user_id,
            'action': request.action
        }
        
        # Add special_requirements parameter if provided
        if request.special_requirements:
            params['special_requirements'] = request.special_requirements
            
        result = run_meal_tool(meal_planner_agent, "meal_planner", **params)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Meal planner agent error: {str(e)}")

@app.post("/api/interrupt")
async def handle_interrupt(request: InterruptRequest):
    """Handle general questions and interrupts"""
    try:
        # Prepare parameters for the interrupt tool
        params = {
            'query': request.query
        }
        
        # Add user_id parameter if provided
        if request.user_id is not None:
            params['user_id'] = request.user_id
            
        # Add current_context parameter if provided
        if request.current_context:
            params['current_context'] = request.current_context
            
        result = run_interrupt_tool(interrupt_agent, "interrupt_agent", **params)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Interrupt agent error: {str(e)}")

# Utility endpoints
@app.get("/api/users/{user_id}/summary")
async def get_user_summary(user_id: int):
    """Get comprehensive user summary"""
    try:
        # Get data from multiple agents
        mood_result = run_mood_tool(mood_tracker_agent, "mood_tracker", user_id=user_id, action='get_stats')
        cgm_result = run_cgm_tool(cgm_agent, "check_glucose", user_id=user_id, action='get_stats')
        food_result = run_food_tool(food_intake_agent, "food_intake", user_id=user_id, action='get_stats')
        meal_plan_result = run_meal_tool(meal_planner_agent, "meal_planner", user_id=user_id, action='get_latest')
        
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
    # Since the new agent structure doesn't have mood_values attribute,
    # we'll return the standard mood options
    return {
        'moods': ["happy", "sad", "tired", "anxious", "calm", "energetic", "angry"],
        'mood_values': {
            "happy": 5,
            "sad": 1,
            "tired": 2,
            "anxious": 1,
            "calm": 4,
            "energetic": 5,
            "angry": 1
        }
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
    
    # Debug database path
    db_path = os.environ.get('DATABASE_PATH', '')
    print(f"📊 Database Path: {db_path}")
    print(f"📊 Database Exists: {os.path.exists(db_path)}")
    
    # If database doesn't exist at the current path, try the correct path
    if not os.path.exists(db_path):
        # Correct path should be relative to the project root, not the agents directory
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        correct_db_path = os.path.join(project_root, 'data', 'healthcare_data.db')
        print(f"🔧 Trying correct database path: {correct_db_path}")
        print(f"🔧 Correct database exists: {os.path.exists(correct_db_path)}")
        if os.path.exists(correct_db_path):
            os.environ['DATABASE_PATH'] = correct_db_path
            db_path = correct_db_path
            print(f"✅ Updated database path to: {db_path}")
    
    uvicorn.run(
    "app:app",
    host="0.0.0.0", 
    port=8000,
    reload=True,
    log_level="info"
)
