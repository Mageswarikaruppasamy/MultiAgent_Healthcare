import os
import psycopg2
import psycopg2.extras
from typing import Dict, Any
from agno.agent import Agent
from dotenv import load_dotenv

# Load environment variables
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


def get_connection():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


# Tool function
def check_glucose(user_id: int, glucose_reading: int = None, action: str = "") -> Dict[str, Any]:
    conn = get_connection()
    cur = conn.cursor()

    try:
        if action == "get_stats":
            cur.execute("""
                SELECT glucose_reading, timestamp FROM cgm_readings
                WHERE user_id=%s ORDER BY timestamp DESC LIMIT 10
            """, (user_id,))
            rows = cur.fetchall()

            return {
                "success": True,
                "message": f"Retrieved {len(rows)} glucose readings for user {user_id}",
                "cgm_history": [{"glucose_reading": row["glucose_reading"], "timestamp": row["timestamp"]} for row in rows],
                "glucose_reading": None,
                "status": "history",
                "alert_flag": False,
                "recommendations": []
            }

        if glucose_reading is None:
            cur.execute("""
                SELECT glucose_reading FROM cgm_readings
                WHERE user_id=%s ORDER BY timestamp DESC LIMIT 1
            """, (user_id,))
            row = cur.fetchone()
            if row:
                glucose_reading = row["glucose_reading"]
            else:
                return {
                    "success": False,
                    "message": f"No glucose reading found for user ID {user_id}",
                    "glucose_reading": None,
                    "status": "unknown",
                    "alert_flag": False,
                    "recommendations": []
                }

        # Glucose status
        if glucose_reading < 80:
            status = "Low"
            alert_flag = True
            recommendations = [
                "Consume fast-acting carbs (e.g., glucose tablets, juice).",
                "Recheck glucose after 15 minutes."
            ]
        elif glucose_reading > 180:
            status = "High"
            alert_flag = True
            recommendations = [
                "Check insulin dosage if applicable.",
                "Drink water and monitor symptoms."
            ]
        else:
            status = "Normal"
            alert_flag = False
            recommendations = [
                "Maintain current routine.",
                "Keep monitoring glucose regularly."
            ]

        if action == "log" and glucose_reading is not None:
            cur.execute("""
                INSERT INTO cgm_readings (user_id, glucose_reading)
                VALUES (%s, %s)
            """, (user_id, glucose_reading))
            conn.commit()

        return {
            "success": True,
            "message": f"Glucose reading is {glucose_reading} mg/dL — {status}",
            "glucose_reading": glucose_reading,
            "status": status,
            "alert_flag": alert_flag,
            "recommendations": recommendations
        }

    except Exception as e:
        return {
            "success": False,
            "message": f"Error: {str(e)}",
            "glucose_reading": None,
            "status": "error",
            "alert_flag": False,
            "recommendations": []
        }
    finally:
        cur.close()
        conn.close()


# Setup agent
db = {"get_connection": get_connection}  # Mock db object
cgm_agent = Agent(db=db, tools=[])

# Register tool
cgm_agent.tools.append({
    "name": "check_glucose",
    "description": "Validates glucose ranges and returns status",
    "func": check_glucose
})


# Helper to run tool
def run_tool(agent: Agent, tool_name: str, **kwargs):
    for tool in agent.tools:
        if tool["name"] == tool_name:
            return tool["func"](**kwargs)
    return {"success": False, "message": f"Tool {tool_name} not found", "glucose_reading": None, "status": "fail", "alert_flag": False, "recommendations": []}


# Test
if __name__ == "__main__":
    print(run_tool(cgm_agent, "check_glucose", user_id=1))
    print(run_tool(cgm_agent, "check_glucose", user_id=1, glucose_reading=75))
