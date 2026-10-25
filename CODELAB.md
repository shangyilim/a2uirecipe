# Codelab: Interactive Recipe Experiences with ADK and A2UI

Build an AI-powered culinary recipe dashboard using **Agent Development Kit (ADK)** and **A2UI**, rendering interactive recipe cards, dietary tags, and action buttons dynamically from structured JSON.

---

## 1. Overview

Most AI assistants reply to cooking inquiries with long walls of plain text or bulleted lists. In this codelab, you will use **A2UI** (Agent-to-User Interface) to enable your agent to reply with a rich, interactive user interface instead. 

The agent describes recipe cards, ingredients, cooking stats, and buttons in declarative JSON using a catalog of standard components. The client renders them using its own native widgets—meaning new layouts and experiences do not require changes to frontend code.

### What you'll build
A **Recipe Assistant** built through three progressive stages:
1. **Stage 1: Grounded Plain Text Agent** — Queries recipe data via `get_recipes` and returns plain text.
2. **Stage 2: A2UI JSON Agent** — Queries recipe data and outputs structured A2UI JSON with components and data bindings.
3. **Stage 3: Interactive Rendered Agent & React Client** — Returns rich UI surfaces:
   - **Recipe Summary Cards**: Discovery cards with authentic food photography, stats, badges, and action buttons.
   - **Recipe Detail Cards**: In-depth ingredients checklist and preparation guidance.
   - **Single-Card Guided Stepper (`GuidedCookingCard`)**: Bundles all steps for a recipe into a single card with zero-latency client-side Next/Previous navigation and interactive countdown timers for timed steps.
   - **Markdown Notes (`DefaultCard`)**: Formatted cooking tips and chef notes.

```
+-------------------------------------------------------------+
|                     User Asks:                              |
|          "What can I make for dinner tonight?"              |
+-------------------------------------------------------------+
                              │
                              ▼
                 +──────────────────────────+
                 |  Gemini 3.5 Flash-Lite   |
                 |      (google-adk)        |
                 +──────────────────────────+
                              │
               Calls Tool: get_recipes() (Grounded)
                              │
                              ▼
            +────────────────────────────────────+
            |  Stage 1: Plain text summary       |
            |  Stage 2: Structured A2UI JSON     |
            |  Stage 3: Interactive UI Surfaces  |
            |   • RecipeSummaryCard (Discovery)  |
            |   • RecipeDetailCard (Ingredients) |
            |   • GuidedCookingCard (Stepper)    |
            |   • Live Timers & Markdown Notes   |
            +────────────────────────────────────+
```

### What you'll learn
- How A2UI works: the **18 primitives**, the flat component model, and message lifecycle (`beginRendering`, `surfaceUpdate`, `dataModelUpdate`).
- How to strictly ground an ADK agent with tools to prevent hallucinations of recipes, ingredients, or image URLs.
- How to use the **A2UI Python SDK** (`a2ui-agent-sdk`) to generate system prompts containing schemas and catalogs.
- How to design custom A2UI primitives (`RecipeSummaryCard`, `RecipeDetailCard`, `GuidedCookingCard`, `DefaultCard`).
- How to create a **single-card step-by-step stepper** with client-side navigation and interactive countdown timers.
- How to serve static food photography from simulated remote endpoints using ADK custom services (`recipe_agent/services.py`).
- How to build a full-stack companion using React and Tailwind CSS that connects directly to the ADK agent.

---

## 2. Set up your environment

### Prerequisites
- Python 3.12+ (or 3.13)
- A Gemini API Key from [Google AI Studio](https://aistudio.google.com/app/apikey) **OR** a Google Cloud Project with Vertex AI enabled.

### 2.1 Project Directory Structure
In your project folder (`a2uirecipecodelab`), the structure is organized as follows:
```text
a2uirecipecodelab/
├── .env                  # Environment variables (API keys, RECIPE_STAGE)
├── .env.example          # Environment variable template
├── services.py           # Root ADK custom services entry point (delegates to recipe_agent)
├── recipe_agent/         # Recipe Assistant Agent package
│   ├── __init__.py       # Package initialization & service hookup
│   ├── recipes.py        # Curated recipe dataset and get_recipes tool
│   ├── agent.py          # Unified agent definition (supports Stages 1, 2, and 3)
│   ├── services.py       # Custom ADK FastAPI static mount for /images
│   └── images/           # Generated food photography assets
└── frontend/             # Modern React + Vite + Tailwind client
    ├── src/
    │   ├── components/
    │   │   ├── RecipeSummaryCard.tsx   # Discovery summary cards
    │   │   ├── RecipeDetailCard.tsx    # Detailed view with ingredients
    │   │   ├── GuidedCookingCard.tsx   # Single-card stepper with timers
    │   │   ├── DefaultCard.tsx         # Markdown formatted text & tips
    │   │   └── A2UIRenderer.tsx        # Dynamic A2UI surface renderer
    │   ├── services/adkService.ts      # Direct ADK Web API client
    │   └── App.tsx
    └── package.json
```

### 2.2 Install Dependencies
Create and activate a virtual environment, then install ADK and the A2UI SDK:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install google-adk a2ui-agent-sdk
```

### 2.3 Configure API Credentials
Open `.env` and provide your Gemini API Key or Google Cloud credentials:
```bash
# Option A: Google AI Studio
GEMINI_API_KEY=your_actual_gemini_api_key_here

# Option B: Google Cloud Vertex AI (Optional)
# GOOGLE_CLOUD_PROJECT=your-gcp-project-id
# GOOGLE_CLOUD_LOCATION=global
# GOOGLE_GENAI_USE_ENTERPRISE=True

# Default active stage (1 = text, 2 = raw json, 3 = rendered UI)
RECIPE_STAGE=1
```

---

## 3. Define Recipe Mock Data & Tool

Create `recipe_agent/recipes.py` containing a curated list of dishes and a tool function `get_recipes()`. Each recipe includes preparation stats, ingredients, step-by-step instructions, dietary tags, and an authentic image URL served locally by the agent's simulated remote endpoint (`http://127.0.0.1:8080/images/...`).

```python
# recipe_agent/recipes.py

RECIPES = [
    {
        "id": "pasta-carbonara",
        "name": "Classic Roman Carbonara",
        "cuisine": "Italian",
        "category": "Main Course",
        "prep_time": "10 mins",
        "cook_time": "15 mins",
        "servings": 2,
        "difficulty": "Medium",
        "calories": "580 kcal",
        "rating": 4.9,
        "description": "Rich and silky traditional Roman pasta made with guanciale, fresh egg yolks, Pecorino Romano, and cracked black pepper.",
        "ingredients": [
            "200g Spaghetti or Rigatoni",
            "100g Guanciale (or Pancetta), diced",
            "3 large egg yolks + 1 whole egg",
            "50g Pecorino Romano, freshly grated",
            "Freshly cracked black pepper",
            "Sea salt (for pasta water)",
        ],
        "instructions": [
            "Bring a large pot of salted water to a gentle boil and cook pasta until al dente.",
            "In a skillet, crisp the diced guanciale over medium heat until golden; remove from heat.",
            "Whisk egg yolks, whole egg, grated Pecorino, and abundant black pepper in a bowl.",
            "Toss hot pasta directly into the guanciale skillet with rendered fat.",
            "Stir in egg mixture quickly off heat with a splash of starchy pasta water to emulsify into a creamy sauce.",
        ],
        "dietary": ["Nut-Free"],
        "badge": "Chef's Choice",
        "image_url": "http://127.0.0.1:8080/images/carbonara.jpg",
    },
    {
        "id": "thai-basil-chicken",
        "name": "Thai Basil Chicken (Pad Krapow)",
        "cuisine": "Thai",
        "category": "Quick Dinner",
        "prep_time": "10 mins",
        "cook_time": "8 mins",
        "servings": 2,
        "difficulty": "Easy",
        "calories": "420 kcal",
        "rating": 4.8,
        "description": "Sizzling street-style minced chicken stir-fried with bird's eye chilies, fragrant garlic, and holy basil in a savory sauce.",
        "ingredients": [
            "300g Chicken breast or thighs, minced",
            "1 cup fresh Holy Basil leaves",
            "4 cloves garlic, minced",
            "3 Thai bird's eye chilies, sliced",
            "1 tbsp Oyster sauce",
            "1 tbsp Fish sauce",
            "1 tsp Dark soy sauce",
            "Crispy fried egg (for serving)",
        ],
        "instructions": [
            "Pound chilies and garlic together; stir-fry in hot oil for 30 seconds until fragrant.",
            "Add minced chicken and cook over high heat until browned.",
            "Stir in savory sauces and a pinch of sugar.",
            "Fold in holy basil leaves until wilted and serve hot over jasmine rice.",
        ],
        "dietary": ["Dairy-Free", "High-Protein"],
        "badge": "Fast & Spicy",
        "image_url": "http://127.0.0.1:8080/images/thai_basil_chicken.jpg",
    },
    {
        "id": "mediterranean-quinoa-salad",
        "name": "Mediterranean Quinoa Bowl",
        "cuisine": "Mediterranean",
        "category": "Salad / Healthy",
        "prep_time": "15 mins",
        "cook_time": "15 mins",
        "servings": 4,
        "difficulty": "Easy",
        "calories": "340 kcal",
        "rating": 4.7,
        "description": "Refreshing salad with fluffy quinoa, crisp cucumbers, cherry tomatoes, Kalamata olives, feta, and lemon-herb vinaigrette.",
        "ingredients": [
            "1 cup dry Quinoa, cooked and cooled",
            "1 English cucumber, diced",
            "1.5 cups Cherry tomatoes, halved",
            "1/2 cup Kalamata olives, pitted and halved",
            "100g Feta cheese, crumbled",
            "Extra virgin olive oil and fresh lemon juice",
        ],
        "instructions": [
            "Whisk olive oil, lemon juice, salt, and herbs.",
            "Toss cooled quinoa with diced vegetables and olives.",
            "Fold in crumbled feta and chill before serving.",
        ],
        "dietary": ["Vegetarian", "Gluten-Free"],
        "badge": "Healthy & Fresh",
        "image_url": "http://127.0.0.1:8080/images/quinoa_bowl.jpg",
    },
]

def get_recipes() -> list[dict]:
    """Retrieve all curated recipes from the recipe catalog."""
    return RECIPES
```

---

## 4. Stage 1: Build the Plain Text Agent

Create `recipe_agent/agent.py` with the following contents. In Stage 1, the agent operates like standard conversational chatbots. It calls `get_recipes` and outputs plain text markdown.

```python
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
        "recipes, cooking ideas, or ingredients, use the get_recipes tool to retrieve "
        "the available recipe data. Summarize the recipes clearly in plain text with "
        "cooking times, ingredients, and step-by-step instructions."
    ),
    tools=[get_recipes],
)
```

### Testing Stage 1
Start the ADK web development server:
```bash
.venv/bin/adk web --port 8080 --allow_origins "*" --reload_agents
```
1. Open your browser to `http://127.0.0.1:8080`.
2. From the top-left dropdown, select **`recipe_assistant`** (or `recipe_agent`).
3. Send a prompt:
   ```text
   What can I make for dinner tonight?
   ```
4. **Observation**: The response is helpful, but it results in a lengthy text block that requires tedious scrolling and reading.

---

## 5. Stage 2: Generate Structured A2UI JSON

Instead of generating unstructured text, we teach the LLM how to output **A2UI JSON**. 

The `a2ui-agent-sdk` includes a `prompt_generator` that injects the complete A2UI JSON schema, standard component specs, and few-shot formatting rules into the agent's instructions.

To inspect the raw JSON output during this learning step, replace the contents of `recipe_agent/agent.py` with the following. We introduce a callback `show_raw_json` that transforms `<a2ui-json>` into a markdown ````json` code block:

```python
# recipe_agent/agent.py

from google.adk.agents import Agent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models import Gemini
from google.adk.models.llm_response import LlmResponse
from google.genai import types
from a2ui.core.basic_catalog import BasicCatalog
from a2ui.inference_formats.direct_json import DirectJsonFormat
from .recipes import get_recipes

a2ui_format = DirectJsonFormat(
    catalogs=[BasicCatalog("0.8")],
)

instruction = a2ui_format.prompt_generator.generate(
    role_description=(
        "You are an expert culinary assistant and recipe dashboard. When users ask for "
        "recipes, meal ideas, or cooking instructions, use the get_recipes tool to fetch "
        "the current state."
    ),
    workflow_description=(
        "Analyze the user's request and return structured UI when appropriate."
    ),
    ui_description=(
        "Use cards for recipe summaries, rows and columns for comparisons, "
        "icons for cook time and difficulty indicators, and buttons for cooking actions. "
        "Do NOT use markdown formatting in text values. Use the usageHint "
        "property for heading levels instead. "
        "Respond ONLY with the A2UI JSON array. Do NOT include any text "
        "outside the JSON. Put all explanations into Text components."
    ),
    include_schema=True,
    include_examples=True,
)

def show_raw_json(
    callback_context: CallbackContext,
    llm_response: LlmResponse,
) -> LlmResponse | None:
    """Intercept output to view raw A2UI JSON as readable code blocks."""
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

root_agent = Agent(
    model=Gemini(
        model="gemini-3.5-flash-lite",
        retry_options=types.HttpRetryOptions(attempts=5),
    ),
    name="recipe_assistant",
    description="A culinary assistant that returns structured A2UI JSON code blocks.",
    instruction=instruction,
    tools=[get_recipes],
    after_model_callback=show_raw_json,
)
```

### Testing Stage 2
1. In the ADK web UI, click **+ New Session** on `recipe_assistant`.
2. Send the prompt:
   ```text
   What can I make for dinner tonight?
   ```
3. **Observation**: The response now outputs structured JSON showing A2UI messages (`beginRendering`, `surfaceUpdate`, `dataModelUpdate`).

---

## 6. Understanding the A2UI Architecture

Look closely at the JSON produced in Stage 2. A2UI uses three message types:

### 1. `beginRendering`
Declares the active rendering surface and points to the root component ID:
```json
{
  "beginRendering": {
    "surfaceId": "default",
    "root": "recipe-column"
  }
}
```

### 2. `surfaceUpdate`
Defines the visual hierarchy as a **flat array of components** (not deeply nested trees):
```json
{
  "surfaceUpdate": {
    "surfaceId": "default",
    "components": [
      {
        "id": "recipe-column",
        "component": {
          "Column": {
            "children": { "explicitList": ["header-text", "carbonara-card"] }
          }
        }
      },
      {
        "id": "header-text",
        "component": {
          "Text": {
            "text": { "literalString": "Recommended Dinner Recipes" },
            "usageHint": "h1"
          }
        }
      },
      {
        "id": "carbonara-card",
        "component": {
          "Card": { "child": "carbonara-body" }
        }
      },
      {
        "id": "carbonara-body",
        "component": {
          "Column": {
            "children": { "explicitList": ["recipe-title", "cook-button"] }
          }
        }
      },
      {
        "id": "recipe-title",
        "component": {
          "Text": { "text": { "path": "recipe_name" }, "usageHint": "h2" }
        }
      },
      {
        "id": "cook-button",
        "component": {
          "Button": {
            "label": { "literalString": "Start Cooking" },
            "action": { "type": "start_cook" }
          }
        }
      }
    ]
  }
}
```
*Why flat?* A flat list with ID references makes streaming, partial updates, and validation fast and resilient against LLM generation errors.

### 3. `dataModelUpdate`
Separates dynamic content from layout structure:
```json
{
  "dataModelUpdate": {
    "surfaceId": "default",
    "contents": [
      { "key": "recipe_name", "valueString": "Classic Roman Carbonara" },
      { "key": "cook_time", "valueString": "15 mins" }
    ]
  }
}
```

### The 18 Primitives Catalog
| Category | Supported Primitives | Recipe Use Case |
| :--- | :--- | :--- |
| **Layout** | `Card`, `Column`, `Row`, `List`, `Tabs`, `Divider`, `Modal` | Recipe cards, two-column ingredient lists, instruction tabs |
| **Display** | `Text`, `Image`, `Icon`, `Video`, `AudioPlayer` | Recipe photos, prep time icons (`schedule`), ratings (`star`) |
| **Input** | `TextField`, `DateTimeInput`, `MultipleChoice`, `CheckBox`, `Slider` | Portion size sliders, dietary filters, pantry ingredient inputs |
| **Action** | `Button` | "Start Step-by-Step", "Add to Grocery List" |

---

## 7. Stage 3: Unified Agent Architecture & Custom A2UI Catalog

In Stage 3, the agent supports full rendered A2UI with a **three-stage culinary workflow**:
1. **Stage A (Discovery)**: Displays `RecipeSummaryCard`s featuring high-resolution food photography, cook times, difficulty badges, and "View" / "Let's Cook This" action buttons.
2. **Stage B (Recipe Details)**: When the user clicks "View", renders `RecipeDetailCard` with complete ingredients, nutrition stats, and the "Let's Cook This" button.
3. **Stage C (Guided Cooking in 1 Card)**: When the user clicks "Let's Cook This", emits a single unified `GuidedCookingCard` containing all steps. The user navigates forward and backward locally using client-side **Next** and **Previous** buttons without triggering slow agent roundtrips. Steps with timing information (boiling, simmering, searing) feature live interactive countdown timers!
4. **General Text & Tips**: Explanations and chef tips are rendered using `DefaultCard` with full markdown formatting (bold, bullet points, headers).

Here is the complete unified `recipe_agent/agent.py`:

```python
# recipe_agent/agent.py

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
gemini_model = Gemini(
    model="gemini-3.5-flash-lite",
    retry_options=types.HttpRetryOptions(attempts=5),
)

# Mandatory Grounding Instructions
MANDATORY_TOOL_INSTRUCTIONS = (
    "MANDATORY RECIPE RETRIEVAL RULES:\n"
    "1. You do NOT have internal knowledge of recipes, ingredients, instructions, or images.\n"
    "2. Whenever the user asks for recipes ('all recipes', 'dinner ideas', 'what can I cook'), "
    "or asks about a specific recipe, you MUST FIRST call the `get_recipes` tool.\n"
    "3. NEVER invent or hallucinate recipes, ingredients, instructions, or image URLs. Only use recipes returned by `get_recipes`.\n"
    "4. After the tool returns the list of recipes, generate the appropriate A2UI JSON UI using the exact data from the tool response.\n"
)

# ==============================================================================
# Stages 2 & 3: A2UI Schema & Prompt Generation
# ==============================================================================
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
        "After receiving the recipes from get_recipes, present them using simplified 'RecipeSummaryCard' components inside a Column. "
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
        "Bundle ALL steps for the recipe in a single GuidedCookingCard so the user navigates locally with Next and Previous buttons:\n"
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
        "5. Custom Component: 'DefaultCard' (FOR GENERAL TEXT & EXPLANATIONS WITH MARKDOWN):\n"
        "Use this default card whenever showing explanations, dietary notes, cooking tips, or general messages. It fully formats markdown (bullet lists, bold text, headings, code):\n"
        "{\n"
        '  "id": "info-card-1",\n'
        '  "component": {\n'
        '    "DefaultCard": {\n'
        '      "title": "Chef\'s Tip & Dietary Notes",\n'
        '      "text": "### How to Perfect Carbonara\\n\\n- **Never add heavy cream**: Emulsion of egg yolks and pasta water provides all the richness.\\n- **Toast the pepper**: Toasted black pepper releases maximum aroma."\n'
        '    }\n'
        '  }\n'
        "}\n\n"
        "Wrap your A2UI JSON array inside <a2ui-json> and </a2ui-json> tags."
    ),
    include_schema=True,
    include_examples=True,
)

STAGE_3_INSTRUCTION = MANDATORY_TOOL_INSTRUCTIONS + "\n\n" + a2ui_instruction

root_agent = Agent(
    model=gemini_model,
    name="recipe_assistant",
    description="A culinary assistant that renders rich A2UI recipe interfaces.",
    instruction=STAGE_3_INSTRUCTION,
    tools=[get_recipes],
)
```

---

## 8. Test the Three-Stage Interactive Flow

With the agent configured, test the complete end-to-end culinary journey:

### Step 1: Recipe Discovery (Stage A)
**Prompt**:
```text
What can I make for dinner tonight?
```
**Result**: The agent calls `get_recipes` and returns interactive `RecipeSummaryCard`s. Each card features:
- Authentic food photography (`http://127.0.0.1:8080/images/carbonara.jpg`).
- Cooking duration and calorie tags.
- Difficulty and category badges.
- **"View"** button and **"Let's Cook This"** button.

### Step 2: Full Ingredients Inspection (Stage B)
**Action**: Click the **"View"** button on the *Classic Roman Carbonara* card.
**Result**: The agent outputs a `RecipeDetailCard` displaying:
- Complete bulleted ingredient checklist with exact portions (e.g., 200g Spaghetti, 100g Guanciale, 3 egg yolks).
- Servings, cook time, and nutritional stats.
- Prominent **"Let's Cook This"** button.

### Step 3: Single-Card Guided Cooking (Stage C)
**Action**: Click the **"Let's Cook This"** button.
**Result**: The agent emits a single, self-contained `GuidedCookingCard`:
- **Single Unified Card**: All 5 steps are bundled into one card container with a progress bar and numbered step pills (`[1]`, `[2]`, `[3]`, etc.).
- **One Step at a Time**: Only the current active step is visible, keeping the workspace focused and clutter-free.
- **Local Client-Side Navigation**: Clicking **"Next Step"** or **"Previous"** immediately advances or rewinds the step locally in React with **zero server delay** and **no additional agent turns**.
- **Interactive Timers**: Step 1 (10 mins boiling pasta) and Step 2 (5 mins crisping guanciale) display built-in digital countdown timers with **Start**, **Pause**, **Reset**, and bell chimes directly inside the card!
- **Culinary Tips**: Chef's advice (e.g. *"Save 1/2 cup of starchy pasta water before draining!"*) appears highlighted in amber.
- **Completion**: The final step displays **"Finish Cooking!"**, congratulating the user and inviting plating recommendations.

---

## 9. Simulated Remote Food Photography & ADK Custom Services

To simulate remote CDN-hosted recipe images without needing external cloud storage buckets during local development, the agent packages its images and custom FastAPI service hooks:

1. **Asset Directory** (`recipe_agent/images/`):
   Contains generated food photography for each dish (`carbonara.jpg`, `thai_basil_chicken.jpg`, `quinoa_bowl.jpg`, etc.).
2. **Agent Service Module** (`recipe_agent/services.py`):
   Hooks into ADK's `ApiServer` on boot to mount `/images` as a static file route:
   ```python
   # recipe_agent/services.py
   import os
   from fastapi.staticfiles import StaticFiles
   import google.adk.cli.api_server as adk_api_server

   _orig_get_fast_api_app = adk_api_server.ApiServer.get_fast_api_app

   def _custom_get_fast_api_app(self, *args, **kwargs):
       app = _orig_get_fast_api_app(self, *args, **kwargs)
       images_dir = os.path.join(os.path.dirname(__file__), "images")
       if os.path.exists(images_dir):
           app.mount("/images", StaticFiles(directory=images_dir), name="recipe_images")
       return app

   if getattr(adk_api_server.ApiServer, "_has_custom_images_mount", False) is False:
       adk_api_server.ApiServer.get_fast_api_app = _custom_get_fast_api_app
       adk_api_server.ApiServer._has_custom_images_mount = True
   ```
3. **Root Delegation** (`services.py`):
   A clean one-line delegate at the project root ensures the service is loaded whether `adk web` is run from the workspace root or targeting `recipe_agent` directly:
   ```python
   from recipe_agent import services
   ```

---

## 10. React Client Companion

A complete React application is provided in the `frontend/` directory to demonstrate client-side A2UI rendering with modern styling and responsive interactions:

### Running the Full-Stack Application
1. **Start the ADK Backend**:
   ```bash
   .venv/bin/adk web --port 8080 --allow_origins "*"
   ```
2. **Start the React Frontend** (in a second terminal):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
3. Open `http://localhost:3000` to interact with the full custom recipe dashboard.

---

## 11. Production Frontend Integrations

For production, you can render A2UI JSON on any client platform using official renderers:

| Framework | Package / SDK | Installation |
| :--- | :--- | :--- |
| **React** | `@a2ui/react` | `npm install @a2ui/react` |
| **Angular** | `@a2ui/angular` | `npm install @a2ui/angular` |
| **Lit / Web Components** | `@a2ui/lit` | `npm install @a2ui/lit` |
| **Flutter** | Flutter GenUI SDK | `flutter pub add genui` |

Because A2UI is decoupled from rendering engines, client applications translate the same JSON into native Material Design, Cupertino, or custom design system widgets.

---

## 12. Summary & Checklist

Congratulations! You built an interactive recipe assistant powered by ADK and A2UI.

- [x] **Stage 1**: Created a grounded agent retrieving recipe data without hallucination.
- [x] **Stage 2**: Used `a2ui-agent-sdk` to generate system prompts that guide Gemini to output structured A2UI JSON.
- [x] **Stage 3**: Rendered interactive UI cards, badges, and buttons directly inside `adk web` and React.
- [x] **Custom Component Catalog**: Built `RecipeSummaryCard`, `RecipeDetailCard`, `GuidedCookingCard`, and `DefaultCard`.
- [x] **Single-Card Guided Stepper**: Packaged all recipe steps into 1 card with zero-latency local Next/Previous buttons and live countdown timers.
- [x] **Simulated Remote Images**: Served high-resolution food photography directly via ADK FastAPI static mounts.
- [x] **Markdown Formatting**: Formatted chef tips and general advice with full markdown rendering.

