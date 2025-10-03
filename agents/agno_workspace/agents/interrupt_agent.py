import os
from dotenv import load_dotenv
from google import genai
from agno.agent import Agent
from agno.db.sqlite import SqliteDb
from typing import Dict, Any

# Load environment variables with explicit path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(CURRENT_DIR)))
env_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path=env_path, override=True)
GENAI_API_KEY = os.getenv("GOOGLE_API_KEY")  # Use GOOGLE_API_KEY instead of GEMINI_API_KEY

if not GENAI_API_KEY:
    raise Exception("GEMINI_API_KEY or GOOGLE_API_KEY not found in .env file")

# Additional check for placeholder values
if GENAI_API_KEY == 'YOUR_GOOGLE_API_KEY_PLACEHOLDER' or GENAI_API_KEY == 'YOUR_ACTUAL_GOOGLE_API_KEY_HERE' or GENAI_API_KEY == 'your_actual_gemini_api_key_here':
    raise Exception("Invalid API key: Placeholder value detected. Please update with a valid Google API key.")

client = genai.Client(api_key=GENAI_API_KEY)

# DB path (if FAQs or help content stored locally)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(CURRENT_DIR)))
DB_PATH = os.path.join(BASE_DIR, "data", "healthcare_data.db")


def classify_question(query: str) -> str:
    """Basic classification — could be extended with ML or rules"""
    query = query.lower()
    if "how" in query or "what" in query or "why" in query:
        return "informational"
    elif "help" in query:
        return "app_help"
    else:
        return "general"


def answer_query(query: str) -> Dict[str, Any]:
    """Use Gemini API to answer a general question"""
    try:
        prompt = (
            f"You are an intelligent assistant. Answer the following query clearly and concisely and dont give any words in bold:\n\n"
            f"Query: {query}"
        )

        # Make API call without incorrect generation_config parameter
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt]
        )

        answer = response.candidates[0].content.parts[0].text.strip()

        return {"answer": answer, "source": "llm"}

    except Exception as e:
        return {"answer": f"Error answering query: {e}", "source": "error"}


def interrupt_agent(user_id: int = None, query: str = "", current_context: dict = None) -> Dict[str, Any]:
    if not query:
        return {
            "success": False,
            "message": "Query is required",
            "question_type": None,
            "response_source": None,
            "navigation_suggestion": None,
            "continue_flow": True
        }

    question_type = classify_question(query)
    answer_data = answer_query(query)

    # Navigation suggestion can be improved with NLP context awareness
    navigation_suggestion = "You can continue with your previous task or ask another question."

    return {
        "success": True,
        "message": answer_data.get("answer"),
        "question_type": question_type,
        "response_source": answer_data.get("source"),
        "navigation_suggestion": navigation_suggestion,
        "continue_flow": True
    }


# Setup agent
db = SqliteDb(db_file=DB_PATH)
interrupt_agent_instance = Agent(db=db, tools=[])

interrupt_agent_instance.tools.append({
    "name": "interrupt_agent",
    "description": "Handles general Q&A and interrupts during any flow",
    "func": interrupt_agent
})


def run_tool(agent: Agent, tool_name: str, **kwargs):
    for tool in agent.tools:
        if tool["name"] == tool_name:
            return tool["func"](**kwargs)
    return {"success": False, "message": f"Tool {tool_name} not found"}


# Greeting interaction
if __name__ == "__main__":
    print("Hello! I'm your Interrupt Agent. How can I help you today?")
    while True:
        user_query = input("Enter your question (or 'exit' to quit): ").strip()
        if user_query.lower() == "exit":
            break

        response = run_tool(interrupt_agent_instance, "interrupt_agent", query=user_query)
        print(f"Agent: {response['message']}")
        print(f"Suggestion: {response['navigation_suggestion']}")