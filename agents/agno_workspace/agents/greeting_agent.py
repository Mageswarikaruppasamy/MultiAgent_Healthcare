import os
import sqlite3
import json
from typing import Dict, Any
from agno.agent import Agent
from agno.db.sqlite import SqliteDb

# Calculate the correct path to the database
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(CURRENT_DIR)))
DB_PATH = os.path.join(BASE_DIR, "data", "healthcare_data.db")

def greet_user(user_id: int) -> Dict[str, Any]:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        SELECT id, first_name, last_name, city, dietary_preference, medical_conditions
        FROM users WHERE id=?
    """, (user_id,))
    row = cur.fetchone()
    conn.close()

    if row:
        # Parse medical_conditions from JSON string to list
        medical_conditions = []
        if row[5]:  # medical_conditions column
            try:
                medical_conditions = json.loads(row[5])
            except json.JSONDecodeError:
                # If it's not valid JSON, treat it as a string
                medical_conditions = [row[5]] if row[5] != 'None' else []
        
        user_info = {
            "id": row[0],
            "first_name": row[1],
            "last_name": row[2],
            "city": row[3],
            "dietary_preference": row[4],
            "medical_conditions": medical_conditions
        }
        return {
            "success": True,
            "message": f"Hello {row[1]} {row[2]} from {row[3]} 👋! "
                       f"Welcome to your personalized Health Care companion.",
            "user_info": user_info,
            "action": "proceed"
        }
    else:
        return {
            "success": False,
            "message": f"User ID {user_id} not found ❌",
            "user_info": None,
            "action": "ask_signup"
        }

db = SqliteDb(db_file=DB_PATH)
greeting_agent = Agent(db=db, tools=[])

greeting_agent.tools.append({
    "name": "greet_user",
    "description": "Greets a user by validating their ID in healthcare_data.db",
    "func": greet_user
})

def run_tool(agent: Agent, tool_name: str, **kwargs):
    for tool in agent.tools:
        if tool["name"] == tool_name:
            return tool["func"](**kwargs)
    return {"success": False, "message": f"Tool {tool_name} not found", "user_info": None, "action": "fail"}

if __name__ == "__main__":
    print(run_tool(greeting_agent, "greet_user", user_id=1))
    print(run_tool(greeting_agent, "greet_user", user_id=200))