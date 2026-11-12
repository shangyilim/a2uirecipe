# recipe_agent/agent.py

from a2ui.core.schema import ProtocolVersion
from a2ui.core.basic_catalog import BasicCatalog
import os
from google.adk.agents import Agent
from google.adk.models import Gemini
from google.genai import types
from a2ui.adk import A2uiInstruction, SendA2uiToClientToolset
from a2ui.inference_formats.direct_json import DirectJsonFormatFactory
from a2ui.processor import A2uiRequestProcessor
from a2ui.utils.renderer_state import RendererState
from .catalog import CULINARY_CATALOG_ID, create_culinary_catalog
from .recipes import get_recipes


# ==============================================================================
# Model Configuration
# ==============================================================================
gemini_model = Gemini(
    model="gemini-3.5-flash-lite",
    retry_options=types.HttpRetryOptions(attempts=5),
)

catalogs = [create_culinary_catalog()]

# Stateless processor used to build system instructions for A2uiInstruction.
processor = A2uiRequestProcessor(
    catalogs,
    format_factory=DirectJsonFormatFactory(),
)


def create_turn_processor(_ctx=None) -> A2uiRequestProcessor:
    """Create a fresh per-turn processor with an empty RendererState.

    Each chat bubble renders an independent surface, so binding a fresh
    RendererState per tool call enforces that every response creates the
    surface(s) it updates and rejects orphan updateComponents calls.
    """
    return A2uiRequestProcessor(
        catalogs,
        format_factory=DirectJsonFormatFactory(),
        state=RendererState(catalogs),
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
    "After receiving recipes from get_recipes, present them using 'RecipeSummaryCard' components inside a Column root container. "
    "Each card features the recipe's title, cooking stats, badge, authentic image_url from the tool, a 'View' button, and a 'Let\'s Cook This' button.\n\n"
    "3. STAGE B - RECIPE DETAILS:\n"
    "When the user clicks 'View' (or asks for full details/ingredients of a recipe), render the full 'RecipeDetailCard' with complete ingredients list. "
    "The RecipeDetailCard includes the 'Let\'s Cook This' button so the user can start step-by-step guided cooking.\n\n"
    "4. STAGE C - STEP-BY-STEP GUIDED COOKING (ALL STEPS IN 1 SINGLE CARD):\n"
    "When the user clicks 'Let\'s Cook This' or asks to cook/prepare a dish:\n"
    "- Return ALL instruction steps in a single 'GuidedCookingCard'. The card lets the user navigate forward and backward locally via Next and Previous buttons without calling the agent again!\n"
    "- In the 'steps' array, include each step's title, instruction, and optional tip.\n"
    "- For instructions that have TIME information (boiling, searing, simmering, sautéing, baking, chilling, resting): specify 'timerMinutes' (number of minutes) and 'duration' (e.g. '10 mins', '5 mins') so an interactive countdown timer appears directly on that step!\n"
    "- For GENERAL instructions (prep, whisking, chopping, tossing, seasoning, plating): omit timerMinutes so it displays a clean, focused instruction card."
)

UI_DESCRIPTION = (
    "### A2UI v1.0 Culinary UI Rules:\n"
    "- Every response renders as a new independent card in the chat timeline. ALWAYS start with `createSurface` using a fresh unique `surfaceId` (e.g. `recipe_list_1`, `recipe_detail_carbonara_1`, `guided_cooking_1`), and either embed `components` directly inside `createSurface` or follow with `updateComponents` using that exact same `surfaceId`. NEVER emit `updateComponents` or `updateDataModel` for a `surfaceId` created in an earlier turn.\n"
    f"- Set \"catalogId\": \"{CULINARY_CATALOG_ID}\" in createSurface.\n"
    "- Use UAX #31 identifiers for component IDs (letters, numbers, underscores only; NEVER use hyphens '-').\n"
    "- Prefer the custom culinary components ('RecipeSummaryCard', 'RecipeDetailCard', 'GuidedCookingCard', 'DefaultCard') over generic BasicCatalog primitives whenever applicable.\n"
    "- If rendering any standard 'Button', set action event 'view_recipe' or 'start_cooking' with '{\"recipe_name\": \"<exact recipe name>\"}' in context.\n"
    "- Deliver the A2UI v1.0 JSON array by calling the send_a2ui_json_to_client tool."
)

a2ui_instruction = A2uiInstruction(
    (
        f"{ROLE_DESCRIPTION}\n\n"
        f"{WORKFLOW_DESCRIPTION}\n\n"
        f"## UI Description:\n{UI_DESCRIPTION}"
    ),
    a2ui_processor=processor,
)

a2ui_toolset = SendA2uiToClientToolset(
    a2ui_enabled=True,
    a2ui_processor=create_turn_processor,
)


root_agent = Agent(
    model=gemini_model,
    name="recipe_assistant",
    description="A culinary assistant that renders rich A2UI recipe interfaces.",
    instruction=a2ui_instruction,
    tools=[get_recipes, a2ui_toolset],
)
