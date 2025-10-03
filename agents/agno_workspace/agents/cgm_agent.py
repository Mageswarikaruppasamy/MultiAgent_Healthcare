import os
import sqlite3
from typing import Dict, Any
from agno.agent import Agent
from agno.db.sqlite import SqliteDb
from dotenv import load_dotenv

# Path to database
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(CURRENT_DIR)))
DB_PATH = os.path.join(BASE_DIR, "data", "healthcare_data.db")

# Load environment variables with explicit path
env_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path=env_path, override=True)
GENAI_API_KEY =  os.getenv("GOOGLE_API_KEY")

if not GENAI_API_KEY:
    raise Exception("GEMINI_API_KEY or GOOGLE_API_KEY not found in .env file")


# Tool function
def check_glucose(user_id: int, glucose_reading: int = None, action: str = "") -> Dict[str, Any]:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    try:
        if action == "get_stats":
            # Get glucose history for the user
            cur.execute("""
                SELECT glucose_reading, timestamp FROM cgm_readings
                WHERE user_id=? ORDER BY timestamp DESC LIMIT 10
            """, (user_id,))
            rows = cur.fetchall()
            
            return {
                "success": True,
                "message": f"Retrieved {len(rows)} glucose readings for user {user_id}",
                "cgm_history": [{"glucose_reading": row[0], "timestamp": row[1]} for row in rows],
                "glucose_reading": None,
                "status": "history",
                "alert_flag": False,
                "recommendations": []
            }
        
        # If glucose reading not provided, fetch latest from DB
        if glucose_reading is None:
            cur.execute("""
                SELECT glucose_reading FROM cgm_readings
                WHERE user_id=? ORDER BY timestamp DESC LIMIT 1
            """, (user_id,))
            row = cur.fetchone()
            if row:
                glucose_reading = row[0]
            else:
                return {
                    "success": False,
                    "message": f"No glucose reading found for user ID {user_id}",
                    "glucose_reading": None,
                    "status": "unknown",
                    "alert_flag": False,
                    "recommendations": []
                }

        # Determine glucose status
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

        # If action is "log", save the reading to the database
        if action == "log" and glucose_reading is not None:
            cur.execute("""
                INSERT INTO cgm_readings (user_id, glucose_reading)
                VALUES (?, ?)
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
        conn.close()

# Setup agent
db = SqliteDb(db_file=DB_PATH)
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
