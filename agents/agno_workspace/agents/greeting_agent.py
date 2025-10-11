import os
import psycopg2
import psycopg2.extras
import json
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
if not DATABASE_URL:
    raise Exception("DATABASE_URL not found in environment variables")


def get_connection():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


def greet_user(user_id: int) -> Dict[str, Any]:
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT id, first_name, last_name, city, dietary_preference, medical_conditions
            FROM users WHERE id=%s
        """, (user_id,))
        row = cur.fetchone()

        if row:
            medical_conditions = []
            if row["medical_conditions"]:
                if isinstance(row["medical_conditions"], list):
                    medical_conditions = row["medical_conditions"]
                else:
                    try:
                        medical_conditions = json.loads(row["medical_conditions"])
                    except json.JSONDecodeError:
                        medical_conditions = [row["medical_conditions"]] if row["medical_conditions"] != 'None' else []

            user_info = {
                "id": row["id"],
                "first_name": row["first_name"],
                "last_name": row["last_name"],
                "city": row["city"],
                "dietary_preference": row["dietary_preference"],
                "medical_conditions": medical_conditions
            }
            return {
                "success": True,
                "message": f"Hello {row['first_name']} {row['last_name']} from {row['city']} 👋! "
                           f"Welcome to your personalized Health Care companion.",
                "user": user_info,
                "action": "proceed"
            }
        else:
            return {
                "success": False,
                "message": f"User ID {user_id} not found ❌",
                "user": None,
                "action": "ask_signup"
            }

    except Exception as e:
        return {
            "success": False,
            "message": f"Error: {str(e)}",
            "user": None,
            "action": "fail"
        }
    finally:
        cur.close()
        conn.close()



# Setup agent
db = {"get_connection": get_connection}
greeting_agent = Agent(db=db, tools=[])

greeting_agent.tools.append({
    "name": "greet_user",
    "description": "Greets a user by validating their ID in healthcare_data database",
    "func": greet_user
})


def run_tool(agent: Agent, tool_name: str, **kwargs):
    for tool in agent.tools:
        if tool["name"] == tool_name:
            return tool["func"](**kwargs)
    return {"success": False, "message": f"Tool {tool_name} not found", "user_info": None, "action": "fail"}


# Test
if __name__ == "__main__":
    print(run_tool(greeting_agent, "greet_user", user_id=1))
    print(run_tool(greeting_agent, "greet_user", user_id=200))