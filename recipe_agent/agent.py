# recipe_agent/agent.py

import os
from google.adk.agents import Agent
from google.adk.models import Gemini
from google.genai import types
from a2ui.adk import A2uiInstruction, SendA2uiToClientToolset
from a2ui.core.basic_catalog import BasicCatalog
from a2ui.core.schema import ProtocolVersion
from a2ui.inference_formats.direct_json import DirectJsonFormatFactory
from a2ui.processor import A2uiRequestProcessor
from .recipes import get_recipes

# ==============================================================================
# Model Configuration
# ==============================================================================
gemini_model = Gemini(
    model="gemini-3.5-flash-lite",
    retry_options=types.HttpRetryOptions(attempts=5),
)

processor = A2uiRequestProcessor(
    [BasicCatalog(ProtocolVersion.V1_0)],
    format_factory=DirectJsonFormatFactory(),
)

ROLE_DESCRIPTION = (
    "You are an expert culinary assistant and interactive recipe dashboard. "
    "CRITICAL: You do NOT have internal recipe knowledge. You MUST call the get_recipes tool "
    "whenever the user asks for recipes, lists recipes, or asks for meal recommendations. "
    "Never invent or hallucinate recipe data or image URLs. Only use the data from get_recipes."
)

WORKFLOW_DESCRIPTION = (
    "### Recipe Assistant Workflow:\n"
    "1. RECIPE RETRIEVAL (MANDATORY):\n"
    "When the user asks for recipes, all recipes, or meal ideas, ALWAYS call get_recipes first.\n\n"
    "2. STAGE A - RECIPE LIST / DISCOVERY:\n"
    "After receiving recipes from get_recipes, present each recipe inside a Card within a Column root container. "
    "Include the recipe's title, description, cooking stats, authentic image_url from the tool, a 'View' button, and a 'Let\'s Cook This' button.\n\n"
    "3. STAGE B - RECIPE DETAILS:\n"
    "When the user clicks 'View' (or asks for full details/ingredients of a recipe), render the full recipe details with complete ingredients list and a 'Let\'s Cook This' button.\n\n"
    "4. STAGE C - STEP-BY-STEP GUIDED COOKING:\n"
    "When the user clicks 'Let\'s Cook This' or asks to cook/prepare a dish, render clear step-by-step instructions with timing and chef tips."
)

UI_DESCRIPTION = (
    "### A2UI v1.0 Component Specifications:\n"
    "Construct rich A2UI v1.0 surfaces following these rules:\n"
    "1. First call get_recipes to fetch authentic recipes. Do NOT invent recipes or image URLs.\n"
    "2. A2UI v1.0 ENVELOPE: Set \"version\": \"1.0\" in each A2UI message.\n"
    "3. TOP-DOWN ORDERING & ROOT: The first element in 'components' MUST be the root container with id 'root'.\n"
    "4. FLAT v1.0 COMPONENT MODEL & UAX #31 IDENTIFIERS: Every component has 'id', 'component': '<Type>', and its properties placed directly on the object. Component IDs MUST be valid UAX #31 identifiers (use letters, numbers, and underscores like 'header_text', 'recipe_card_1'; NEVER use hyphens '-').\n"
    "5. BUTTON ACTIONS: Every 'Button' component MUST have a valid v1.0 action with the exact recipe name in context:\n"
    "   - View Button: \"action\": {\"event\": {\"name\": \"view_recipe\", \"context\": {\"recipe_name\": \"<exact recipe name>\"}}}\n"
    "   - Cook Button: \"action\": {\"event\": {\"name\": \"start_cooking\", \"context\": {\"recipe_name\": \"<exact recipe name>\"}}}\n"
    "   Always supply the exact recipe name from the tool in the context object.\n\n"
    "6. Root Container Example:\n"
    "{\n"
    '  "id": "root",\n'
    '  "component": "Column",\n'
    '  "children": ["header_text", "recipe_card_1", "recipe_card_2"],\n'
    '  "justify": "start"\n'
    "}\n\n"
    "Deliver the A2UI v1.0 JSON array by calling the send_a2ui_json_to_client tool with a valid payload matching the catalog schema."
)

a2ui_instruction = A2uiInstruction(
    (
        f"{ROLE_DESCRIPTION}\n\n"
        f"{WORKFLOW_DESCRIPTION}\n\n"
        f"## UI Description:\n{UI_DESCRIPTION}"
    ),
    a2ui_processor=processor,
)

# Validates outgoing A2UI payloads against BasicCatalog on the backend and
# automatically triggers LLM self-correction if any schema violation occurs.
a2ui_toolset = SendA2uiToClientToolset(
    a2ui_enabled=True,
    a2ui_processor=processor,
)

root_agent = Agent(
    model=gemini_model,
    name="recipe_assistant",
    description="A culinary assistant that renders rich A2UI recipe interfaces.",
    instruction=a2ui_instruction,
    tools=[get_recipes, a2ui_toolset],
)