import sqlite3
import json
import os
from typing import Dict, Any
from agno.agent import Agent
from agno.db.sqlite import SqliteDb
from google import genai
from dotenv import load_dotenv

# DB path - Use consistent approach with mood_tracker_agent.py
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


def analyze_nutrition(meal_description: str) -> Dict[str, Any]:
    try:
        prompt = (
            "Analyze the nutritional content of the following meal and "
            "provide calories (kcal), protein (g), carbohydrates (g), "
            "and fat (g) in JSON format with keys: calories, protein, carbohydrates, fat.\n"
            f"Meal: {meal_description}\n"
            "IMPORTANT: Respond ONLY with valid JSON in this exact format: "
            '{"calories": number, "protein": number, "carbohydrates": number, "fat": number}'
        )

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt]
        )

        # Check if response is valid
        if not response.candidates or not response.candidates[0].content or not response.candidates[0].content.parts:
            raise Exception("Empty response from Gemini API")
            
        content = response.candidates[0].content.parts[0].text.strip()

        # Try to extract JSON from the response
        # Look for JSON object in the response
        import re
        
        # First try to find JSON object with curly braces
        json_match = re.search(r'\{[^}]+\}', content)
        if json_match:
            json_str = json_match.group(0)
            try:
                result = json.loads(json_str)
                # Validate that all required fields are present
                required_fields = ["calories", "protein", "carbohydrates", "fat"]
                for field in required_fields:
                    if field not in result:
                        result[field] = 0  # Default to 0 if field is missing
                return result
            except json.JSONDecodeError:
                pass  # Continue to default return

        # If that fails, try to parse the entire content as JSON
        try:
            # Remove markdown ```json wrapper if present
            clean_content = content
            if clean_content.startswith("```json"):
                clean_content = clean_content[7:]
            if clean_content.endswith("```"):
                clean_content = clean_content[:-3]
            clean_content = clean_content.strip()
            
            result = json.loads(clean_content)
            # Validate that all required fields are present
            required_fields = ["calories", "protein", "carbohydrates", "fat"]
            for field in required_fields:
                if field not in result:
                    result[field] = 0  # Default to 0 if field is missing
            return result
        except json.JSONDecodeError as je:
            print(f"JSON parsing error: {je}")
            print(f"Raw content: {content}")
            # Return default values instead of None
            return {
                "calories": 0,
                "protein": 0,
                "carbohydrates": 0,
                "fat": 0
            }

    except Exception as e:
        print("Google API error:", e)
        # Return default values instead of None to prevent null outputs
        return {
            "calories": 0,
            "protein": 0,
            "carbohydrates": 0,
            "fat": 0
        }


def food_intake_agent(user_id: int, meal_description: str = "", action: str = "log") -> Dict[str, Any]:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    try:
        if action == "log":
            if not meal_description:
                return {
                    "success": False,
                    "message": "Meal description is required for logging",
                    "meal_description": None,
                    "nutrition_analysis": None,
                }

            nutrition_analysis = analyze_nutrition(meal_description)
            print(f"Nutrition analysis result: {nutrition_analysis}")

            # Ensure all nutrition values are valid numbers
            calories = nutrition_analysis.get("calories", 0)
            carbs = nutrition_analysis.get("carbohydrates", 0)
            protein = nutrition_analysis.get("protein", 0)
            fat = nutrition_analysis.get("fat", 0)
            
            # Convert to float or int if needed, default to 0 if conversion fails
            try:
                calories = float(calories) if calories is not None else 0
            except (ValueError, TypeError):
                calories = 0
                
            try:
                carbs = float(carbs) if carbs is not None else 0
            except (ValueError, TypeError):
                carbs = 0
                
            try:
                protein = float(protein) if protein is not None else 0
            except (ValueError, TypeError):
                protein = 0
                
            try:
                fat = float(fat) if fat is not None else 0
            except (ValueError, TypeError):
                fat = 0

            # Insert into food_logs
            cur.execute("""
                INSERT INTO food_logs (user_id, meal_description, estimated_calories, estimated_carbs, estimated_protein, estimated_fat)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                user_id,
                meal_description,
                calories,
                carbs,
                protein,
                fat
            ))
            conn.commit()
            print("Database commit successful")

            # Verify the insertion was successful
            cur.execute("SELECT last_insert_rowid()")
            inserted_id = cur.fetchone()[0]
            print(f"Successfully inserted food log with ID: {inserted_id}")

            return {
                "success": True,
                "message": "Meal logged successfully with nutritional analysis.",
                "meal_description": meal_description,
                "nutrition_analysis": nutrition_analysis,
            }

        elif action == "get_stats":
            cur.execute("""
                SELECT meal_description, estimated_calories, estimated_carbs, estimated_protein, estimated_fat, timestamp
                FROM food_logs WHERE user_id=?
                ORDER BY timestamp DESC
            """, (user_id,))
            rows = cur.fetchall()
            print(f"Retrieved {len(rows)} food logs for user {user_id}")

            return {
                "success": True,
                "message": f"Retrieved {len(rows)} meals for user {user_id}.",
                "meal_description": None,
                "nutrition_analysis": [dict(
                    meal_description=row[0],
                    calories=row[1],
                    carbohydrates=row[2],
                    protein=row[3],
                    fat=row[4],
                    timestamp=row[5]
                ) for row in rows],
            }

        return {
            "success": False,
            "message": "Invalid action",
            "meal_description": None,
            "nutrition_analysis": None,
        }

    except Exception as e:
        error_msg = f"Error in food_intake_agent: {str(e)}"
        print(error_msg)
        import traceback
        traceback.print_exc()
        conn.rollback()
        return {
            "success": False,
            "message": error_msg,
            "meal_description": None,
            "nutrition_analysis": None,
        }
    finally:
        conn.close()


# Agent Schema
AGENT_SCHEMA = {
    "name": "food_intake_agent",
    "version": "1.0.0",
    "description": "Records meals/snacks and estimates nutritional content",
    "inputs": {
        "user_id": {"type": "integer", "description": "User ID", "required": True},
        "meal_description": {
            "type": "string",
            "description": "Description of the meal consumed",
            "required": False
        },
        "action": {
            "type": "string",
            "description": "Action to perform",
            "enum": ["log", "get_stats"],
            "default": "log"
        }
    },
    "outputs": {
        "success": {"type": "boolean", "description": "Whether the operation was successful"},
        "message": {"type": "string", "description": "Response message"},
        "meal_description": {"type": "string", "description": "The meal that was logged"},
        "nutrition_analysis": {"type": "object", "description": "Nutritional analysis of the meal"}
    }
}

# Register Agent
db = SqliteDb(db_file=DB_PATH)
food_agent = Agent(db=db, tools=[])

# Register tool with consistent naming
food_agent.tools.append({
    "name": "food_intake",
    "description": "Records meals/snacks and estimates nutritional content",
    "func": food_intake_agent
})


# Helper to run tool
def run_tool(agent: Agent, tool_name: str, **kwargs):
    for tool in agent.tools:
        if tool["name"] == tool_name:
            return tool["func"](**kwargs)
    return {"success": False, "message": f"Tool {tool_name} not found", "meal_description": None, "nutrition_analysis": None}


# Test
if __name__ == "__main__":
    print(run_tool(food_agent, "food_intake", user_id=1, meal_description="Grilled chicken sandwich with lettuce and tomato"))