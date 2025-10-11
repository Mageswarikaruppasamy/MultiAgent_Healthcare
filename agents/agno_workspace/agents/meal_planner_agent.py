import os
import psycopg2
import psycopg2.extras
import json
from dotenv import load_dotenv
from google import genai
from agno.agent import Agent
from functools import lru_cache
from typing import Dict, Any
import time

# ------------------------------
# Load environment variables
# ------------------------------
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(CURRENT_DIR)))
env_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path=env_path, override=True)

DATABASE_URL = os.getenv("DATABASE_URL")
GENAI_API_KEY = os.getenv("GOOGLE_API_KEY")

if not DATABASE_URL:
    raise Exception("DATABASE_URL not found in environment variables")
if not GENAI_API_KEY:
    raise Exception("GOOGLE_API_KEY not found in environment variables")

client = genai.Client(api_key=GENAI_API_KEY)

# ------------------------------
# DB connection helper
# ------------------------------
def get_connection():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)

# ------------------------------
# Get user context
# ------------------------------
def get_user_context(user_id: int) -> Dict[str, Any]:
    """Fetch user's dietary preference and medical conditions from PostgreSQL DB."""
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT dietary_preference, medical_conditions
            FROM users WHERE id=%s
        """, (user_id,))
        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row:
            return {}

        # Fix JSON parsing error
        medical_conditions = []
        if row["medical_conditions"]:
            if isinstance(row["medical_conditions"], list):
                medical_conditions = row["medical_conditions"]
            else:
                try:
                    medical_conditions = json.loads(row["medical_conditions"])
                except Exception:
                    medical_conditions = [row["medical_conditions"]] if row["medical_conditions"] != 'None' else []

        return {
            "dietary_preference": row["dietary_preference"],
            "medical_conditions": medical_conditions
        }
    except Exception as e:
        print(f"Error fetching user context: {e}")
        return {}

# ------------------------------
# Generate meal plan
# ------------------------------
def generate_meal_plan(user_context: Dict[str, Any], special_requirements: str = "") -> Dict[str, Any]:
    try:
        prompt = ( f"Create a detailed meal plan for the next day with Breakfast, Lunch, and Dinner, "
                  f"based on these preferences:\n" 
                  f"Dietary Preference: {user_context.get('dietary_preference', 'None')}\n" 
                  f"Medical Conditions: {', '.join(user_context.get('medical_conditions', []))}\n" 
                  f"Special Requirements: {special_requirements}\n\n" 
                  "Return the meal plan as JSON with the following structure:\n" 
                  "{\n" " \"breakfast\": {\n" 
                  " \"name\": \"Meal name\",\n" 
                    " \"description\": \"Meal description\",\n" 
                    " \"estimated_nutrition\": {\n" 
                        " \"calories\": 0,\n" 
                        " \"carbs\": 0,\n" 
                        " \"protein\": 0,\n" 
                        " \"fat\": 0,\n" 
                        " \"fiber\": 0\n" " },\n" 
                  " \"health_benefits\": [\"benefit1\", \"benefit2\"]\n" " },\n" 
                  " \"lunch\": {\n" 
                  " \"name\": \"Meal name\",\n" 
                    " \"description\": \"Meal description\",\n" 
                    " \"estimated_nutrition\": {\n" 
                        " \"calories\": 0,\n" 
                        " \"carbs\": 0,\n" 
                        " \"protein\": 0,\n" 
                        " \"fat\": 0,\n" 
                        " \"fiber\": 0\n" " },\n" 
                  " \"health_benefits\": [\"benefit1\", \"benefit2\"]\n" " },\n" 
                  " \"dinner\": {\n" " \"name\": \"Meal name\",\n"
                    " \"description\": \"Meal description\",\n" 
                    " \"estimated_nutrition\": {\n" 
                        " \"calories\": 0,\n" 
                        " \"carbs\": 0,\n" 
                        " \"protein\": 0,\n" 
                        " \"fat\": 0,\n" 
                        " \"fiber\": 0\n" " },\n" 
                  " \"health_benefits\": [\"benefit1\", \"benefit2\"]\n" " },\n" 
                " \"daily_totals\": {\n" " \"calories\": 0,\n" " \"carbs\": 0,\n" " \"protein\": 0,\n" " \"fat\": 0,\n" " \"fiber\": 0\n" " },\n" " \"special_notes\": [\"note1\", \"note2\"]\n" "}\n" 
                "IMPORTANT: Respond ONLY with valid JSON, no additional text. Make sure all fields are present. Health Benefits should be short and crisp in 4 to 5 words each.\n" 
                "Do not include ingredients unless specifically requested in the special requirements."
                )

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt]
        )

        content = response.candidates[0].content.parts[0].text.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.endswith("```"):
            content = content[:-3]

        meal_plan = json.loads(content)

        for meal_type in ["breakfast", "lunch", "dinner"]:
            if meal_type not in meal_plan:
                meal_plan[meal_type] = {
                    "name": "Default meal",
                    "description": "Default description",
                    "ingredients": [],
                    "estimated_nutrition": {"calories": 0, "carbs": 0, "protein": 0, "fat": 0, "fiber": 0},
                    "health_benefits": []
                }
        return meal_plan
    except Exception as e:
        print("Google API error:", e)
        return {}

# ------------------------------
# Meal planner agent
# ------------------------------
def meal_planner_agent(user_id: int, special_requirements: str = "", action: str = "generate") -> Dict[str, Any]:
    try:
        conn = get_connection()
        cur = conn.cursor()

        user_context = get_user_context(user_id)
        if not user_context:
            return {"success": False, "message": f"User {user_id} not found", "meal_plan": None}

        if action == "generate":
            meal_plan = generate_meal_plan(user_context, special_requirements)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS meal_plans (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id),
                    plan_data JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute("""
                INSERT INTO meal_plans (user_id, plan_data) VALUES (%s, %s) RETURNING id
            """, (user_id, json.dumps(meal_plan)))
            inserted_id = cur.fetchone()["id"]
            conn.commit()

            return {
                "success": True,
                "message": "Meal plan generated successfully",
                "meal_plan": meal_plan,
                "user_context": user_context,
                "plan_id": inserted_id
            }

        elif action == "get_latest":
            cur.execute("""
                SELECT plan_data FROM meal_plans
                WHERE user_id=%s ORDER BY created_at DESC LIMIT 1
            """, (user_id,))
            row = cur.fetchone()
            if row:
                return {
                    "success": True,
                    "message": "Retrieved latest meal plan",
                    "meal_plan": row["plan_data"],
                    "user_context": user_context
                }
            return {"success": False, "message": "No meal plans found", "meal_plan": None}

        return {"success": False, "message": "Invalid action", "meal_plan": None}

    except Exception as e:
        return {"success": False, "message": f"Error in meal planner agent: {str(e)}", "meal_plan": None}
    finally:
        cur.close()
        conn.close()

# ------------------------------
# Setup agent
# ------------------------------
try:
    from agno.db.postgres import PostgresDb
    db = PostgresDb(DATABASE_URL)
    meal_agent = Agent(db=db, tools=[])

    meal_agent.tools.append({
        "name": "meal_planner",
        "description": "Generates adaptive meal plans based on user preferences and health data",
        "func": meal_planner_agent
    })
except Exception as e:
    print(f"Error initializing meal planner agent: {e}")
    meal_agent = None

# ------------------------------
# Run tool helper
# ------------------------------
def run_tool(agent: Agent, tool_name: str, **kwargs):
    if not agent:
        return {"success": False, "message": "Agent not initialized"}

    for tool in agent.tools:
        if tool["name"] == tool_name:
            return tool["func"](**kwargs)
    return {"success": False, "message": f"Tool {tool_name} not found"}

# ------------------------------
# Test run
# ------------------------------
if __name__ == "__main__":
    result = run_tool(meal_agent, "meal_planner", user_id=1, special_requirements="low sugar")
    print(result)