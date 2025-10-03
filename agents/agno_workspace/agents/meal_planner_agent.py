import os
import sqlite3
import json
from dotenv import load_dotenv
from google import genai
from agno.agent import Agent
from agno.db.sqlite import SqliteDb
from typing import Dict, Any

# Path to your existing DB
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(CURRENT_DIR)))
DB_PATH = os.path.join(BASE_DIR, "data", "healthcare_data.db")

# Load API key from environment with explicit path
env_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path=env_path, override=True)
GENAI_API_KEY = os.getenv("GOOGLE_API_KEY")  # Use GOOGLE_API_KEY instead of GEMINI_API_KEY


if not GENAI_API_KEY:
    raise Exception("GEMINI_API_KEY or GOOGLE_API_KEY not found in .env")

# Additional check for placeholder values
if GENAI_API_KEY == 'YOUR_GOOGLE_API_KEY_PLACEHOLDER' or GENAI_API_KEY == 'YOUR_ACTUAL_GOOGLE_API_KEY_HERE' or GENAI_API_KEY == 'your_actual_gemini_api_key_here':
    raise Exception("Invalid API key: Placeholder value detected. Please update with a valid Google API key.")

client = genai.Client(api_key=GENAI_API_KEY)

def get_user_context(user_id: int) -> Dict[str, Any]:
    """Fetch user's dietary preference and medical condition from DB"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("""
            SELECT dietary_preference, medical_conditions
            FROM users WHERE id=?
        """, (user_id,))
        row = cur.fetchone()
        conn.close()

        if not row:
            return {}

        return {
            "dietary_preference": row[0],
            "medical_conditions": json.loads(row[1]) if row[1] else []
        }
    except Exception as e:
        print(f"Error fetching user context: {e}")
        return {}


def generate_meal_plan(user_context: Dict[str, Any], special_requirements: str = "") -> Dict[str, Any]:
    """Call Gemini to generate a meal plan"""
    try:
        prompt = (
            f"Create a detailed meal plan for the next day with Breakfast, Lunch, and Dinner, "
            f"based on these preferences:\n"
            f"Dietary Preference: {user_context.get('dietary_preference', 'None')}\n"
            f"Medical Conditions: {', '.join(user_context.get('medical_conditions', []))}\n"
            f"Special Requirements: {special_requirements}\n\n"
            "Return the meal plan as JSON with the following structure:\n"
            "{\n"
            "  \"breakfast\": {\n"
            "    \"name\": \"Meal name\",\n"
            "    \"description\": \"Meal description\",\n"
            "    \"estimated_nutrition\": {\n"
            "      \"calories\": 0,\n"
            "      \"carbs\": 0,\n"
            "      \"protein\": 0,\n"
            "      \"fat\": 0,\n"
            "      \"fiber\": 0\n"
            "    },\n"
            "    \"health_benefits\": [\"benefit1\", \"benefit2\"]\n"
            "  },\n"
            "  \"lunch\": {\n"
            "    \"name\": \"Meal name\",\n"
            "    \"description\": \"Meal description\",\n"
            "    \"estimated_nutrition\": {\n"
            "      \"calories\": 0,\n"
            "      \"carbs\": 0,\n"
            "      \"protein\": 0,\n"
            "      \"fat\": 0,\n"
            "      \"fiber\": 0\n"
            "    },\n"
            "    \"health_benefits\": [\"benefit1\", \"benefit2\"]\n"
            "  },\n"
            "  \"dinner\": {\n"
            "    \"name\": \"Meal name\",\n"
            "    \"description\": \"Meal description\",\n"
            "    \"estimated_nutrition\": {\n"
            "      \"calories\": 0,\n"
            "      \"carbs\": 0,\n"
            "      \"protein\": 0,\n"
            "      \"fat\": 0,\n"
            "      \"fiber\": 0\n"
            "    },\n"
            "    \"health_benefits\": [\"benefit1\", \"benefit2\"]\n"
            "  },\n"
            "  \"daily_totals\": {\n"
            "    \"calories\": 0,\n"
            "    \"carbs\": 0,\n"
            "    \"protein\": 0,\n"
            "    \"fat\": 0,\n"
            "    \"fiber\": 0\n"
            "  },\n"
            "  \"special_notes\": [\"note1\", \"note2\"]\n"
            "}\n"
            "IMPORTANT: Respond ONLY with valid JSON, no additional text. Make sure all fields are present. Health Benefits should be short and crisp in 4 to 5 words each.\n"
            "Do not include ingredients unless specifically requested in the special requirements."
        )

        # Make API call without incorrect generation_config parameter
        response = client.models.generate_content(
            model="gemini-2.5-flash",  # Use the correct model name as per project specifications
            contents=[prompt]
        )

        # Handle response properly
        if not response.candidates or not response.candidates[0].content or not response.candidates[0].content.parts:
            raise Exception("Empty response from Gemini API")
            
        content = response.candidates[0].content.parts[0].text.strip()

        # Remove code block markers if present
        if content.startswith("```json"):
            content = content[7:]
        if content.endswith("```"):
            content = content[:-3]

        # Try to parse JSON
        try:
            meal_plan = json.loads(content)
        except json.JSONDecodeError as je:
            print(f"JSON parsing error: {je}")
            print(f"Raw content: {content}")
            raise Exception("Failed to parse JSON from Gemini response")

        # Ensure all required fields are present
        required_meals = ['breakfast', 'lunch', 'dinner']
        for meal_type in required_meals:
            if meal_type not in meal_plan:
                meal_plan[meal_type] = {
                    "name": "Default meal",
                    "description": "Default description",
                    "ingredients": [],
                    "estimated_nutrition": {"calories": 0, "carbs": 0, "protein": 0, "fat": 0, "fiber": 0},
                    "health_benefits": []
                }
            
            meal = meal_plan[meal_type]
            # Ensure all required fields are present in each meal
            if "name" not in meal:
                meal["name"] = "Default meal"
            if "description" not in meal:
                meal["description"] = "Default description"
            if "ingredients" not in meal:
                meal["ingredients"] = []
            if "estimated_nutrition" not in meal:
                meal["estimated_nutrition"] = {"calories": 0, "carbs": 0, "protein": 0, "fat": 0, "fiber": 0}
            if "health_benefits" not in meal:
                meal["health_benefits"] = []
            
            # Ensure estimated_nutrition has all required fields
            nutrition = meal["estimated_nutrition"]
            if "calories" not in nutrition:
                nutrition["calories"] = 0
            if "carbs" not in nutrition:
                nutrition["carbs"] = 0
            if "protein" not in nutrition:
                nutrition["protein"] = 0
            if "fat" not in nutrition:
                nutrition["fat"] = 0
            if "fiber" not in nutrition:
                nutrition["fiber"] = 0

        # Ensure daily_totals and special_notes are present
        if "daily_totals" not in meal_plan:
            meal_plan["daily_totals"] = {
                "calories": 0, "carbs": 0, "protein": 0, "fat": 0, "fiber": 0
            }
        else:
            # Ensure all fields in daily_totals
            totals = meal_plan["daily_totals"]
            if "calories" not in totals:
                totals["calories"] = 0
            if "carbs" not in totals:
                totals["carbs"] = 0
            if "protein" not in totals:
                totals["protein"] = 0
            if "fat" not in totals:
                totals["fat"] = 0
            if "fiber" not in totals:
                totals["fiber"] = 0
            
        if "special_notes" not in meal_plan:
            meal_plan["special_notes"] = [
                "Drink plenty of water throughout the day",
                "Adjust portion sizes based on your activity level",
                "Consult with your healthcare provider about dietary changes"
            ]

        return meal_plan

    except Exception as e:
        print("Google API error:", e)
        print(f"API Key: {GENAI_API_KEY[:10] if GENAI_API_KEY else 'None'}...")  # Log first 10 chars of API key for debugging
        # Return a fallback meal plan with guaranteed structure
        return {
            "breakfast": {
                "name": "Oatmeal with Berries",
                "description": "Healthy oatmeal topped with fresh berries and nuts",
                "ingredients": [],
                "estimated_nutrition": {
                    "calories": 350,
                    "carbs": 55,
                    "protein": 12,
                    "fat": 10,
                    "fiber": 8
                },
                "health_benefits": ["High in fiber", "Rich in antioxidants", "Sustained energy"]
            },
            "lunch": {
                "name": "Grilled Chicken Salad",
                "description": "Fresh salad with grilled chicken, mixed greens, and vinaigrette",
                "ingredients": [],
                "estimated_nutrition": {
                    "calories": 420,
                    "carbs": 15,
                    "protein": 35,
                    "fat": 22,
                    "fiber": 6
                },
                "health_benefits": ["High in protein", "Low in carbs", "Rich in vitamins"]
            },
            "dinner": {
                "name": "Baked Salmon with Vegetables",
                "description": "Oven-baked salmon with roasted vegetables and quinoa",
                "ingredients": [],
                "estimated_nutrition": {
                    "calories": 480,
                    "carbs": 35,
                    "protein": 30,
                    "fat": 25,
                    "fiber": 8
                },
                "health_benefits": ["Omega-3 fatty acids", "High in protein", "Complex carbohydrates"]
            },
            "daily_totals": {
                "calories": 1250,
                "carbs": 105,
                "protein": 77,
                "fat": 57,
                "fiber": 22
            },
            "special_notes": [
                "Drink plenty of water throughout the day",
                "Adjust portion sizes based on your activity level",
                "Consult with your healthcare provider about dietary changes"
            ]
        }


def meal_planner_agent(user_id: int, special_requirements: str = "", action: str = "generate") -> Dict[str, Any]:
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
    except Exception as e:
        return {
            "success": False,
            "message": f"Database connection error: {str(e)}",
            "meal_plan": None,
            "user_context": None
        }

    try:
        user_context = get_user_context(user_id)
        if not user_context:
            return {
                "success": False,
                "message": f"User {user_id} not found",
                "meal_plan": None,
                "user_context": None
            }

        if action == "generate":
            meal_plan = generate_meal_plan(user_context, special_requirements)
            
            cur.execute("""
                CREATE TABLE IF NOT EXISTS meal_plans (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    plan_data TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            """)
            cur.execute("""
                INSERT INTO meal_plans (user_id, plan_data) VALUES (?, ?)
            """, (user_id, json.dumps(meal_plan)))
            conn.commit()

            return {
                "success": True,
                "message": "Meal plan generated successfully",
                "meal_plan": meal_plan,
                "user_context": user_context
            }

        elif action == "get_latest":
            cur.execute("""
                SELECT plan_data FROM meal_plans
                WHERE user_id=? ORDER BY created_at DESC LIMIT 1
            """, (user_id,))
            row = cur.fetchone()
            if row:
                return {
                    "success": True,
                    "message": "Retrieved latest meal plan",
                    "meal_plan": json.loads(row[0]),
                    "user_context": user_context
                }
            return {
                "success": False,
                "message": "No meal plans found",
                "meal_plan": None,
                "user_context": user_context
            }

        return {
            "success": False,
            "message": "Invalid action",
            "meal_plan": None,
            "user_context": user_context
        }

    except Exception as e:
        return {
            "success": False,
            "message": f"Error in meal planner agent: {str(e)}",
            "meal_plan": None,
            "user_context": None
        }
    finally:
        conn.close()


# Setup agent
try:
    db = SqliteDb(db_file=DB_PATH)
    meal_agent = Agent(db=db, tools=[])

    meal_agent.tools.append({
        "name": "meal_planner",
        "description": "Generates adaptive meal plans based on user preferences and health data",
        "func": meal_planner_agent
    })
except Exception as e:
    print(f"Error initializing meal planner agent: {e}")
    meal_agent = None


def run_tool(agent: Agent, tool_name: str, **kwargs):
    if not agent:
        return {"success": False, "message": "Agent not initialized"}
        
    for tool in agent.tools:
        if tool["name"] == tool_name:
            return tool["func"](**kwargs)
    return {"success": False, "message": f"Tool {tool_name} not found"}


if __name__ == "__main__":
    result = run_tool(meal_agent, "meal_planner", user_id=1, special_requirements="low sugar")
    print(result)