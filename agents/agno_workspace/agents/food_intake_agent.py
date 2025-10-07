import os
import psycopg2
import psycopg2.extras
import json
import re
import time
from typing import Dict, Any
from agno.agent import Agent
import google.generativeai as genai
from dotenv import load_dotenv
from functools import lru_cache

# Load environment variables
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(CURRENT_DIR)))
env_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path=env_path, override=True)


DATABASE_URL = os.getenv("DATABASE_URL")
GENAI_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")

if not DATABASE_URL:
    raise Exception("DATABASE_URL not found in environment variables")
if not GENAI_API_KEY:
    raise Exception("GOOGLE_API_KEY not found in environment variables")

genai.configure(api_key=GENAI_API_KEY)


def get_connection():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


@lru_cache(maxsize=128)
def analyze_nutrition_cached(meal_description: str) -> str:
    try:
        start_time = time.time()
        model = genai.GenerativeModel('gemini-2.0-flash')

        prompt = (
            "Analyze the nutritional content of the following meal and "
            "provide calories (kcal), protein (g), carbohydrates (g), "
            "and fat (g) in JSON format with keys: calories, protein, carbohydrates, fat.\n"
            f"Meal: {meal_description}\n"
            "IMPORTANT: Respond ONLY with valid JSON in this exact format: "
            '{"calories": number, "protein": number, "carbohydrates": number, "fat": number}'
        )

        response = model.generate_content(
            prompt,
            generation_config={"temperature": 0.3, "max_output_tokens": 150}
        )

        elapsed_time = time.time() - start_time
        if elapsed_time > 15:
            print(f"Warning: LLM call took {elapsed_time:.2f} seconds")

        return response.text.strip()
    except Exception as e:
        print("Google API error:", e)
        return '{"calories": 300, "protein": 20, "carbohydrates": 30, "fat": 10}'


def parse_nutrition_response(content: str) -> Dict[str, Any]:
    try:
        json_match = re.search(r'\{[^}]+\}', content)
        if json_match:
            result = json.loads(json_match.group(0))
        else:
            clean_content = content.strip("```json").strip("```").strip()
            result = json.loads(clean_content)

        defaults = {"calories": 300, "protein": 20, "carbohydrates": 30, "fat": 10}
        for field in defaults:
            result[field] = float(result.get(field, defaults[field]))

        return result
    except Exception:
        return {"calories": 300, "protein": 20, "carbohydrates": 30, "fat": 10}


PREDEFINED_NUTRITION = {
    "apple": {"calories": 95, "protein": 0.5, "carbohydrates": 25, "fat": 0.3},
    "banana": {"calories": 105, "protein": 1.3, "carbohydrates": 27, "fat": 0.4},
    # add more as before...
}


def get_predefined_nutrition(meal_description: str) -> Dict[str, Any]:
    if not meal_description:
        return None
    desc = meal_description.lower().strip()
    if desc in PREDEFINED_NUTRITION:
        return PREDEFINED_NUTRITION[desc]
    for food, nutrition in PREDEFINED_NUTRITION.items():
        if food in desc or desc in food:
            return nutrition
    return None


def analyze_nutrition(meal_description: str) -> Dict[str, Any]:
    predefined = get_predefined_nutrition(meal_description)
    if predefined:
        return predefined
    return parse_nutrition_response(analyze_nutrition_cached(meal_description))


def food_intake_agent(user_id: int, meal_description: str = "", action: str = "log") -> Dict[str, Any]:
    conn = get_connection()
    cur = conn.cursor()

    try:
        if action == "log":
            if not meal_description:
                return {"success": False, "message": "Meal description required", "meal_description": None}

            nutrition_analysis = analyze_nutrition(meal_description)

            calories = float(nutrition_analysis.get("calories", 0))
            carbs = float(nutrition_analysis.get("carbohydrates", 0))
            protein = float(nutrition_analysis.get("protein", 0))
            fat = float(nutrition_analysis.get("fat", 0))

            cur.execute("""
                INSERT INTO food_logs (user_id, meal_description, estimated_calories, estimated_carbs, estimated_protein, estimated_fat)
                VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
            """, (user_id, meal_description, calories, carbs, protein, fat))
            inserted_id = cur.fetchone()["id"]
            conn.commit()

            return {"success": True, "message": "Meal logged", "meal_description": meal_description, "nutrition_analysis": nutrition_analysis, "log_id": inserted_id}

        elif action == "get_stats":
            cur.execute("""
                SELECT meal_description, estimated_calories, estimated_carbs, estimated_protein, estimated_fat, timestamp
                FROM food_logs WHERE user_id=%s ORDER BY timestamp DESC
            """, (user_id,))
            rows = cur.fetchall()
            return {"success": True, "message": f"Retrieved {len(rows)} meals", "nutrition_analysis": rows}

        return {"success": False, "message": "Invalid action", "meal_description": None}
    except Exception as e:
        conn.rollback()
        return {"success": False, "message": str(e), "meal_description": None}
    finally:
        cur.close()
        conn.close()


# Setup agent
db = {"get_connection": get_connection}
food_agent = Agent(db=db, tools=[])

food_agent.tools.append({
    "name": "food_intake",
    "description": "Logs meals and estimates nutrition",
    "func": food_intake_agent
})


def run_tool(agent: Agent, tool_name: str, **kwargs):
    for tool in agent.tools:
        if tool["name"] == tool_name:
            return tool["func"](**kwargs)
    return {"success": False, "message": f"Tool {tool_name} not found"}


if __name__ == "__main__":
    print(run_tool(food_agent, "food_intake", user_id=1, meal_description="Grilled chicken sandwich"))
