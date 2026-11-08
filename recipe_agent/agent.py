# recipe_agent/agent.py

from google.adk.agents import Agent
from google.adk.models import Gemini
from google.genai import types
from .recipes import get_recipes

root_agent = Agent(
    model=Gemini(
        model="gemini-3.5-flash-lite",
        retry_options=types.HttpRetryOptions(attempts=5),
    ),
    name="recipe_assistant",
    description="A culinary assistant that reports on recipe recommendations in plain text.",
    instruction=(
        "You are a helpful culinary chef and recipe assistant. When users ask about "
        "recipes, cooking ideas, or ingredients, you MUST use the get_recipes tool to retrieve "
        "the available recipe data. Summarize the recipes clearly in plain text with "
        "cooking times, ingredients, and step-by-step instructions. Never hallucinate or make up recipes."
    ),
    tools=[get_recipes],
)