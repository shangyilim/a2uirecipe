"""Recipe Assistant Agent demonstrating ADK and A2UI integration.

This file supports all 3 stages of the codelab:
  - Stage 1: Standard agent returning recipes as plain text
  - Stage 2: A2UI agent returning structured A2UI JSON (via show_raw_json callback)
  - Stage 3: Rendered agent emitting native <a2ui-json> blocks rendered by ADK Web

Change RECIPE_STAGE to 1, 2, or 3 (or set the RECIPE_STAGE environment variable)
to switch between stages.
"""

import os
from google.adk.agents import Agent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models import Gemini
from google.adk.models.llm_response import LlmResponse
from google.genai import types
from a2ui.core.basic_catalog import BasicCatalog
from a2ui.inference_formats.direct_json import DirectJsonFormat
from .recipes import get_recipes

# Set Stage: 1 (Plain Text), 2 (Raw JSON), or 3 (Rendered UI)
STAGE = int(os.environ.get("RECIPE_STAGE", "3"))

# ==============================================================================
# Model Configuration
# ==============================================================================
# Configured to use Gemini 3.5 Flash-Lite
gemini_model = Gemini(
    model="gemini-3.5-flash-lite",
    retry_options=types.HttpRetryOptions(attempts=5),
)

# ==============================================================================
# Stage 1: Plain Text Instructions
# ==============================================================================
STAGE_1_INSTRUCTION = (
    "You are a helpful culinary chef and recipe assistant. When users ask about "
    "recipes, cooking ideas, or ingredients, you MUST use the get_recipes tool to retrieve "
    "the available recipe data. Summarize the recipes clearly in plain text with "
    "cooking times, ingredients, and step-by-step instructions. Never hallucinate or make up recipes."
)

# ==============================================================================
# Stages 2 & 3: A2UI Schema & Prompt Generation
# ==============================================================================
MANDATORY_TOOL_INSTRUCTIONS = (
    "CRITICAL REQUIREMENT - STRICT TOOL USAGE:\n"
    "1. You have NO built-in knowledge of recipes. You do NOT know which recipes exist until you call the get_recipes tool.\n"
    "2. Whenever the user asks for recipes (such as 'all recipes', 'show recipes', 'dinner ideas', 'what can I cook'), "
    "or asks about a specific recipe, you MUST FIRST call the `get_recipes` tool.\n"
    "3. NEVER invent, hallucinate, or make up recipes, ingredients, instructions, or image URLs. Only use recipes returned by `get_recipes`.\n"
    "4. After the tool returns the list of recipes, generate the appropriate A2UI JSON UI using the exact data (name, description, prep_time, cook_time, calories, cuisine, badge, image_url, ingredients) from the tool response.\n"
)

a2ui_format = DirectJsonFormat(
    catalogs=[BasicCatalog("0.8")],
)

a2ui_instruction = a2ui_format.prompt_generator.generate(
    role_description=(
        "You are an expert culinary assistant and interactive recipe dashboard. "
        "CRITICAL: You do NOT have internal recipe knowledge. You MUST call the get_recipes tool "
        "whenever the user asks for recipes, lists recipes, or asks for meal recommendations. "
        "Never invent or hallucinate recipe data or image URLs. Only use the data from get_recipes."
    ),
    workflow_description=(
        "1. RECIPE RETRIEVAL (MANDATORY):\n"
        "When the user asks for recipes, all recipes, or meal ideas, ALWAYS call get_recipes first.\n\n"
        "2. STAGE A - RECIPE LIST / DISCOVERY:\n"
        "After receiving the recipes from get_recipes, present them using simplified 'RecipeSummaryCard' components inside a Column (NOT RecipeDetailCard). "
        "Each card features the recipe's title, cooking stats, badge, authentic image_url from the tool, a 'View' button, and a 'Let\'s Cook This' button.\n\n"
        "3. STAGE B - RECIPE DETAILS:\n"
        "When the user clicks 'View' (or asks for full details/ingredients of a recipe), render the full 'RecipeDetailCard' with complete ingredients. "
        "The RecipeDetailCard includes the 'Let\'s Cook This' button so the user can start step-by-step guided cooking.\n\n"
        "4. STAGE C - STEP-BY-STEP GUIDED COOKING (ALL STEPS IN 1 SINGLE CARD):\n"
        "When the user clicks 'Let\'s Cook This' or asks to cook/prepare a dish:\n"
        "- Return ALL instruction steps in a single 'GuidedCookingCard'. The card lets the user navigate forward and backward locally via Next and Previous buttons without calling the agent again!\n"
        "- In the 'steps' array, include each step's title, instruction, and optional tip.\n"
        "- For instructions that have TIME information (boiling, searing, simmering, sautéing, baking, chilling, resting): specify 'timerMinutes' (number of minutes) and 'duration' (e.g. '10 mins', '5 mins') so an interactive countdown timer appears directly on that step!\n"
        "- For GENERAL instructions (prep, whisking, chopping, tossing, seasoning, plating): omit timerMinutes so it displays a clean, focused instruction card.\n"
    ),
    ui_description=(
        "Construct rich A2UI surfaces following these rules:\n"
        "1. First call get_recipes to fetch authentic recipes. Do NOT invent recipes or image URLs.\n"
        "2. Custom Component: 'RecipeSummaryCard' (FOR RECIPE LISTS & RECOMMENDATIONS):\n"
        "{\n"
        '  "id": "recipe-summary-<id>",\n'
        '  "component": {\n'
        '    "RecipeSummaryCard": {\n'
        '      "id": "<recipe.id>",\n'
        '      "name": "<recipe.name>",\n'
        '      "description": "<recipe.description>",\n'
        '      "cookTime": "<recipe.cook_time>",\n'
        '      "prepTime": "<recipe.prep_time>",\n'
        '      "difficulty": "<recipe.difficulty>",\n'
        '      "calories": "<recipe.calories>",\n'
        '      "cuisine": "<recipe.cuisine>",\n'
        '      "badge": "<recipe.badge>",\n'
        '      "imageUrl": "<recipe.image_url>"\n'
        '    }\n'
        '  }\n'
        "}\n\n"
        "3. Custom Component: 'RecipeDetailCard' (WHEN VIEWING DETAILS):\n"
        "{\n"
        '  "id": "recipe-detail-<id>",\n'
        '  "component": {\n'
        '    "RecipeDetailCard": {\n'
        '      "id": "<recipe.id>",\n'
        '      "name": "<recipe.name>",\n'
        '      "description": "<recipe.description>",\n'
        '      "prepTime": "<recipe.prep_time>",\n'
        '      "cookTime": "<recipe.cook_time>",\n'
        '      "servings": <recipe.servings>,\n'
        '      "difficulty": "<recipe.difficulty>",\n'
        '      "calories": "<recipe.calories>",\n'
        '      "cuisine": "<recipe.cuisine>",\n'
        '      "badge": "<recipe.badge>",\n'
        '      "imageUrl": "<recipe.image_url>",\n'
        '      "ingredients": <recipe.ingredients>,\n'
        '      "showCookButton": true\n'
        '    }\n'
        '  }\n'
        "}\n\n"
        "4. Custom Component: 'GuidedCookingCard' (FOR STEP-BY-STEP GUIDED COOKING - ALL STEPS IN 1 CARD):\n"
        "Use this when guiding the user to cook a recipe. Bundle ALL steps for the recipe in a single GuidedCookingCard so the user navigates locally with Next and Previous buttons:\n"
        "{\n"
        '  "id": "guided-cooking-1",\n'
        '  "component": {\n'
        '    "GuidedCookingCard": {\n'
        '      "dish": "Classic Roman Carbonara",\n'
        '      "steps": [\n'
        '        {\n'
        '          "step": 1,\n'
        '          "title": "Boil Pasta until Al Dente",\n'
        '          "instruction": "Bring a large pot of salted water to a gentle boil and cook spaghetti until al dente.",\n'
        '          "duration": "10 mins",\n'
        '          "timerMinutes": 10,\n'
        '          "dish": "Classic Roman Carbonara",\n'
        '          "tip": "Save 1/2 cup of starchy pasta water before draining!"\n'
        '        },\n'
        '        {\n'
        '          "step": 2,\n'
        '          "title": "Crisp the Guanciale",\n'
        '          "instruction": "In a large skillet, cook sliced guanciale over medium heat until golden and crispy.",\n'
        '          "duration": "5 mins",\n'
        '          "timerMinutes": 5,\n'
        '          "dish": "Classic Roman Carbonara",\n'
        '          "tip": "Render fat slowly for extra crunch."\n'
        '        },\n'
        '        {\n'
        '          "step": 3,\n'
        '          "title": "Whisk Egg and Cheese Mixture",\n'
        '          "instruction": "In a bowl, whisk whole eggs, egg yolks, grated Pecorino Romano, and freshly cracked black pepper.",\n'
        '          "dish": "Classic Roman Carbonara",\n'
        '          "tip": "Whisk until a thick, creamy paste forms."\n'
        '        },\n'
        '        {\n'
        '          "step": 4,\n'
        '          "title": "Combine Pasta and Guanciale",\n'
        '          "instruction": "Transfer al dente pasta into the skillet with guanciale and toss to coat in rendered fat off the heat.",\n'
        '          "dish": "Classic Roman Carbonara"\n'
        '        },\n'
        '        {\n'
        '          "step": 5,\n'
        '          "title": "Emulsify Carbonara Sauce",\n'
        '          "instruction": "Off the heat, quickly pour in egg mixture while vigorously tossing pasta. Splash reserved pasta water as needed to create a glossy sauce.",\n'
        '          "dish": "Classic Roman Carbonara",\n'
        '          "tip": "Keep skillet off heat to prevent eggs from scrambling!"\n'
        '        }\n'
        '      ]\n'
        '    }\n'
        '  }\n'
        "}\n\n"
        "5. Custom Component: 'InstructionStepCard' (ALTERNATIVE STEP CARD):\n"
        "Can also be used for individual steps inside a Column:\n"
        "{\n"
        '  "id": "step-card-1",\n'
        '  "component": {\n'
        '    "InstructionStepCard": {\n'
        '      "step": 1,\n'
        '      "totalSteps": 5,\n'
        '      "title": "Boil Pasta until Al Dente",\n'
        '      "instruction": "Bring a large pot of salted water to a gentle boil and cook pasta until al dente.",\n'
        '      "duration": "10 mins",\n'
        '      "timerMinutes": 10,\n'
        '      "dish": "Classic Roman Carbonara",\n'
        '      "tip": "Save 1/2 cup of starchy pasta water before draining!",\n'
        '      "isLastStep": false\n'
        '    }\n'
        '  }\n'
        "}\n\n"
        "6. Custom Component: 'CookingTimer' (STANDALONE TIMER):\n"
        "Can also be used as a standalone timer widget if needed:\n"
        "{\n"
        '  "id": "timer-1",\n'
        '  "component": {\n'
        '    "CookingTimer": {\n'
        '      "minutes": 10,\n'
        '      "label": "Boil Pasta until Al Dente",\n'
        '      "dish": "Classic Roman Carbonara"\n'
        '    }\n'
        '  }\n'
        "}\n\n"
        "7. Custom Component: 'DefaultCard' (FOR GENERAL TEXT & EXPLANATIONS WITH MARKDOWN):\n"
        "Use this default card whenever showing explanations, dietary notes, cooking tips, or general messages. It fully formats markdown (bullet lists, bold text, headings, code):\n"
        "{\n"
        '  "id": "info-card-1",\n'
        '  "component": {\n'
        '    "DefaultCard": {\n'
        '      "title": "Chef\'s Tip & Dietary Notes",\n'
        '      "text": "### How to Perfect Carbonara\\n\\n- **Never add heavy cream**: The creaminess comes purely from emulsion of egg yolks, starchy water, and Pecorino.\\n- **Freshly cracked black pepper**: Toast the pepper in the dry pan first for maximum aroma!"\n'
        '    }\n'
        '  }\n'
        "}\n\n"
        "Wrap your A2UI JSON array inside <a2ui-json> and </a2ui-json> tags."
    ),
    include_schema=True,
    include_examples=True,
)

STAGE_2_INSTRUCTION = MANDATORY_TOOL_INSTRUCTIONS + "\n\n" + a2ui_instruction
STAGE_3_INSTRUCTION = MANDATORY_TOOL_INSTRUCTIONS + "\n\n" + a2ui_instruction


def show_raw_json(
    callback_context: CallbackContext,
    llm_response: LlmResponse,
) -> LlmResponse | None:
    """Stage 2 callback: Converts <a2ui-json> tags into markdown code fences
    so the raw JSON structure is visible in chat rather than rendered.
    """
    if not llm_response.content or not llm_response.content.parts:
        return None
    for part in llm_response.content.parts:
        if part.text:
            part.text = (
                part.text
                .replace("<a2ui-json>", "```json\n")
                .replace("</a2ui-json>", "\n```")
            )
    return llm_response


# ==============================================================================
# Build Agent based on active Stage
# ==============================================================================
if STAGE == 1:
    root_agent = Agent(
        model=gemini_model,
        name="recipe_assistant",
        description="A culinary chef assistant that returns recipe details in plain text.",
        instruction=STAGE_1_INSTRUCTION,
        tools=[get_recipes],
    )
elif STAGE == 2:
    root_agent = Agent(
        model=gemini_model,
        name="recipe_assistant",
        description="A culinary chef assistant that returns structured A2UI JSON.",
        instruction=STAGE_2_INSTRUCTION,
        tools=[get_recipes],
        after_model_callback=show_raw_json,
    )
else:  # Stage 3: Rendered A2UI
    root_agent = Agent(
        model=gemini_model,
        name="recipe_assistant",
        description="A culinary chef assistant that renders rich A2UI recipe interfaces.",
        instruction=STAGE_3_INSTRUCTION,
        tools=[get_recipes],
    )

