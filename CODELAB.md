# Codelab: Interactive Recipe Experiences with ADK and A2UI

Build an AI-powered culinary recipe dashboard using **Agent Development Kit (ADK)** and **A2UI**, rendering interactive recipe cards, dietary tags, and action buttons dynamically from structured JSON.

---

## 1. Overview

**Author:** Shang Yi

Most AI assistants reply to cooking inquiries with long walls of plain text or bulleted lists. In this codelab, you will use **A2UI** (Agent-to-User Interface) to enable your agent to reply with a rich, interactive user interface instead. 

The agent describes recipe cards, ingredients, cooking stats, and buttons in declarative JSON using a catalog of standard components. The client renders them using its own native widgets—meaning new layouts and experiences do not require changes to frontend code.

### What you'll build
A **Recipe Assistant** built through four progressive stages:
1. **Stage 1: Grounded Plain Text Agent** — Queries recipe data via `get_recipes` and returns plain text.
2. **Stage 2: A2UI JSON Agent** — Queries recipe data and outputs structured A2UI v1.0 JSON with components and data bindings.
3. **Stage 3: Render Default A2UI Catalog on the Client** — Renders standard A2UI v1.0 primitives (`Card`, `Column`, `Row`, `Text`, `Image`, `Button`) using `@a2ui/react` and `@a2ui/web_core` styled with CSS variables.
4. **Stage 4: Author a Formal Custom A2UI Catalog** — Upgrades both backend and frontend with a formal domain catalog (`RecipeSummaryCard`, `RecipeDetailCard`, `GuidedCookingCard`, `DefaultCard`) using Pydantic, Zod schemas, and custom React components:
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
            +─────────────────────────────────────+
            |  Stage 1: Plain text summary        |
            |  Stage 2: Structured A2UI JSON      |
            |  Stage 3: Default A2UI Catalog UI   |
            |  Stage 4: Formal Custom Catalog UI  |
            |   • RecipeSummaryCard (Discovery)   |
            |   • RecipeDetailCard (Ingredients)  |
            |   • GuidedCookingCard (Stepper)     |
            |   • Live Timers & Markdown Notes    |
            +─────────────────────────────────────+
```

### What you'll learn
- How A2UI works: the **v1.0 specification**, the flat component model, top-down root ordering, and lifecycle messages (`createSurface`, `updateComponents`, `updateDataModel`, `deleteSurface`).
- How to strictly ground an ADK agent with tools to prevent hallucinations of recipes, ingredients, or image URLs.
- How to use **`a2ui-agent-sdk` and `a2ui-adk`** (`A2uiRequestProcessor`, `A2uiInstruction`, and `SendA2uiToClientToolset`) for prompt generation, backend schema validation, and LLM self-correction.
- How to design custom A2UI components (`RecipeSummaryCard`, `RecipeDetailCard`, `GuidedCookingCard`, `DefaultCard`).
- How to create a **single-card step-by-step stepper** with client-side navigation and interactive countdown timers.
- How to connect a React and Tailwind CSS client to the ADK agent via `@a2ui/react` and `@a2ui/web_core`.

---

## 2. Set up your environment

### Prerequisites
- Python 3.12+ (or 3.13)
- A Gemini API Key from [Google AI Studio](https://aistudio.google.com/app/apikey).

### 2.1 Clone the Codebase
Clone the repository and check out the starter `stage0` branch:
```bash
git clone https://github.com/shangyilim/a2uirecipe.git
cd a2uirecipe
git checkout stage0
```

### 2.2 Project Directory Structure
In your project folder (`a2uirecipe`), the structure is organized as follows:
```text
a2uirecipe/
├── services.py           # Root ADK custom services entry point (delegates to recipe_agent)
├── recipe_agent/         # Recipe Assistant Agent package
│   ├── .env              # Environment variables (API keys, RECIPE_STAGE)
│   ├── .env.example      # Environment variable template
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

### 2.3 Install Dependencies
Create and activate a virtual environment, then install ADK and the A2UI SDK:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install google-adk a2ui-agent-sdk a2ui-adk
```

### 2.4 Configure API Credentials
1. Copy the example environment configuration:
   ```bash
   cp recipe_agent/.env.example recipe_agent/.env
   ```
2. **Obtain your Gemini API Key**:
   - Go to [Google AI Studio Get API Key](https://aistudio.google.com/app/apikey).
   - Click **Create API key**.
   - If prompted, select your active Google Cloud project so the key is associated with it.
   - Copy the generated key.
3. Open `recipe_agent/.env` and set your API key:
   ```bash
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   RECIPE_STAGE=1
   ```

---

## 3. Define Recipe Mock Data & Tool

Create `recipe_agent/recipes.py` containing a curated list of dishes and a tool function `get_recipes()`. Each recipe includes preparation stats, ingredients, step-by-step instructions, dietary tags, and a relative image URL (`/images/...`) served locally by the agent's ADK static endpoint (which also works cleanly behind the React dev server proxy).

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
        "image_url": "/images/carbonara.jpg",
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
        "image_url": "/images/thai_basil_chicken.jpg",
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
        "image_url": "/images/quinoa_bowl.jpg",
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

## 5. Stage 2: Generate Structured A2UI JSON (v1.0)

> [!TIP]
> **Catch-up Checkpoint**: If you want to jump straight to Stage 2 or need to reset your code from Stage 1, you can check out the `stage1` branch:
> ```bash
> git checkout stage1
> ```

Instead of generating unstructured text, we teach the LLM how to output **validated A2UI v1.0 JSON** via `a2ui.adk`.

### 5.1 Use `a2ui.adk` (`A2uiInstruction`, `A2uiRequestProcessor` & `SendA2uiToClientToolset`)
The A2UI framework provides an official ADK integration combining three pieces:
- **`A2uiRequestProcessor`**: Binds the component catalog (`BasicCatalog(ProtocolVersion.V1_0)`) with an inference format factory (`DirectJsonFormatFactory()`) and compiles the formal v1.0 JSON schema and workflow rules.
- **`A2uiInstruction`**: Acts as a dynamic, callable instruction provider for ADK. ADK parses `{variable}` syntax as session state templates; `A2uiInstruction` safely injects A2UI JSON schema templates and few-shot examples without triggering template parsing errors.
- **`SendA2uiToClientToolset`**: Exposes the `send_a2ui_json_to_client` tool to Gemini. Rather than emitting fragile raw JSON inside chat text, the model submits its A2UI payload to this tool, which runs `validate_payload` on the Python backend:
  - If validation fails (e.g., hyphenated component IDs or legacy `usageHint` properties), it returns `{ "error": "..." }` so the model self-corrects automatically.
  - Once valid, it sets `skip_summarization = True` and returns `{ "validated_a2ui_json": [...] }` as a clean `functionResponse`.

Replace the contents of `recipe_agent/agent.py` with the following:

```python
# recipe_agent/agent.py

from google.adk.agents import Agent
from google.adk.models import Gemini
from google.genai import types
from a2ui.adk import A2uiInstruction, SendA2uiToClientToolset
from a2ui.core.basic_catalog import BasicCatalog
from a2ui.core.schema import ProtocolVersion
from a2ui.inference_formats.direct_json import DirectJsonFormatFactory
from a2ui.processor import A2uiRequestProcessor
from .recipes import get_recipes

# Initialize A2UI Request Processor with BasicCatalog v1.0
processor = A2uiRequestProcessor(
    [BasicCatalog(ProtocolVersion.V1_0)],
    format_factory=DirectJsonFormatFactory(),
)

ROLE_DESCRIPTION = (
    "You are an expert culinary assistant and recipe dashboard. When users ask for "
    "recipes, meal ideas, or cooking instructions, use the get_recipes tool to fetch "
    "the current state."
)

UI_DESCRIPTION = """
- Every response renders as a new card in the chat timeline: ALWAYS start with 'createSurface' using a fresh unique 'surfaceId' (never emit 'updateComponents' for a surface created in an earlier turn).
- The first component in 'components' MUST have id 'root'.
- Use flat v1.0 components where 'component' is a string discriminator (e.g. 'Column', 'Text', 'Button').
- Component IDs MUST be valid UAX #31 identifiers (letters, numbers, underscores only; NEVER hyphens '-').
- Set 'version': '1.0' in every message envelope.
- Use 'children' array with component IDs, 'justify' instead of distribution, 'align' instead of alignment, and 'variant' instead of usageHint.
- Deliver your A2UI v1.0 JSON array by calling the send_a2ui_json_to_client tool.
"""

# Dynamic A2UI instruction wrapper for ADK
instruction = A2uiInstruction(
    f"{ROLE_DESCRIPTION}\n\n## UI Description:\n{UI_DESCRIPTION}",
    a2ui_processor=processor,
)

# Validates outgoing A2UI JSON on the backend and auto-retries via LLM self-correction
a2ui_toolset = SendA2uiToClientToolset(
    a2ui_enabled=True,
    a2ui_processor=processor,
)

root_agent = Agent(
    model=Gemini(
        model="gemini-3.5-flash-lite",
        retry_options=types.HttpRetryOptions(attempts=5),
    ),
    name="recipe_assistant",
    description="A culinary assistant that produces validated A2UI v1.0 JSON payloads.",
    instruction=instruction,
    tools=[get_recipes, a2ui_toolset],
)
```

> [!TIP]
> **Why `SendA2uiToClientToolset`?**
> `A2uiInstruction` teaches Gemini the schema via the system prompt, whereas **`SendA2uiToClientToolset`** gives the agent the `send_a2ui_json_to_client` tool. Every payload passes through `validate_payload` against `processor.active_catalogs` (checking UAX #31 identifiers, `Text.variant`, `Image.url`, and `Button.action`):
> - If invalid, the tool returns `{ "error": "..." }` so the LLM automatically self-corrects before replying.
> - If valid, the tool emits `{ "validated_a2ui_json": [...] }` in its `functionResponse`, eliminating client-side schema normalization hacks!

### Testing Stage 2
1. In the ADK web UI, click **+ New Session** on `recipe_assistant`.
2. Send the prompt:
   ```text
   What can I make for dinner tonight?
   ```
3. **Observation**: Because `SendA2uiToClientToolset` uses `skip_summarization = True`, Gemini calls `get_recipes` followed by `send_a2ui_json_to_client`. Click the **`send_a2ui_json_to_client` tool response chip** (or open the **Events** tab) in ADK Web UI to inspect the returned `validated_a2ui_json` array containing `createSurface`, `updateComponents`, and `updateDataModel`—along with any automatic self-correction retries if validation failed on a first attempt.

---

## 6. Understanding the A2UI v1.0 Architecture & Evolution

Look closely at the JSON produced in Stage 2. The **A2UI v1.0 Specification** ([Evolution Guide](https://a2ui.org/specification/v1.0-evolution-guide/)) standardizes agent-driven UI into an efficient, token-conscious architecture designed for production applications:

### 1. `createSurface` (Single-Message & Multi-Message Lifecycle)
Signals the client to create a rendering surface. In v1.0:
- The envelope version is standardized to `"version": "1.0"`.
- The `theme` property is deliberately left out as we want to render styling from the client natively.
- Surface creation supports **single-message surface construction**: `createSurface` can directly embed `components` and initial `dataModel` to eliminate round-trip latency.

```json
{
  "version": "1.0",
  "createSurface": {
    "surfaceId": "default",
    "catalogId": "https://a2ui.org/specification/v1_0/basic_catalog.json"
  }
}
```
> **Root Rule in v1.0**: The root container is explicitly declared by having exactly one component with `"id": "root"` placed first in `components`.

### 2. `updateComponents` (Flat Discriminator Model)
Declares components using a clean **flat discriminator model** (`component: "<Type>"`) where attributes live directly on the component object rather than wrapped under nested keys:
```json
{
  "version": "1.0",
  "updateComponents": {
    "surfaceId": "default",
    "components": [
      {
        "id": "root",
        "component": "Column",
        "children": ["header-text", "carbonara-card"],
        "justify": "start"
      },
      {
        "id": "header-text",
        "component": "Text",
        "text": "Recommended Dinner Recipes",
        "variant": "h1"
      },
      {
        "id": "carbonara-card",
        "component": "Card",
        "child": "carbonara-body"
      },
      {
        "id": "carbonara-body",
        "component": "Column",
        "children": ["recipe-title", "cook-button"]
      },
      {
        "id": "recipe-title",
        "component": "Text",
        "text": "Classic Roman Carbonara",
        "variant": "h2"
      },
      {
        "id": "cook-button",
        "component": "Button",
        "label": "Start Cooking",
        "variant": "primary",
        "action": {
          "@call": "start_cooking",
          "args": { "recipe_name": "Classic Roman Carbonara" }
        }
      }
    ]
  }
}
```

### 3. `updateDataModel` & `@path` Syntax
Data bindings and updates use natural JSON key-value maps:
- In A2UI v1.0, data-bound properties use the `@path` prefix (e.g. `{"@path": "/recipe_name"}`).
- Data model updates are applied with upsert semantics:
```json
{
  "version": "1.0",
  "updateDataModel": {
    "surfaceId": "default",
    "value": {
      "recipe_name": "Classic Roman Carbonara",
      "cook_time": "15 mins"
    }
  }
}
```

### 4. `deleteSurface` (Active Surface Scoping)
Surface IDs are scoped to **currently active surfaces**. When a surface is deleted via `deleteSurface`, its ID can be safely reused for future interactions:
```json
{
  "version": "1.0",
  "deleteSurface": {
    "surfaceId": "default"
  }
}
```

---

## 7. Stage 3: Render Default A2UI Catalog on the Client

> [!TIP]
> **Catch-up Checkpoint**: If you want to jump straight to Stage 3 or need to reset your code from Stage 2, you can check out the `stage2` branch:
> ```bash
> git checkout stage2
> ```

In Stage 3, we configure the agent with the standard A2UI v1.0 `BasicCatalog` and render its output on the React client using the turnkey `@a2ui/react` default renderer (`DefaultA2UIRenderer.tsx`), styled with CSS custom properties. Once you've seen the default primitives in action, we'll move to **Stage 4** to author a formal custom Culinary Catalog!

---

### 7.1 Configure the Base A2UI v1.0 Agent (`recipe_agent/agent.py`)

To start with the **Default Renderer (`@a2ui/react`)**, configure `recipe_agent/agent.py` using the built-in `BasicCatalog(ProtocolVersion.V1_0)`. This instructs the agent to emit standard A2UI v1.0 primitives (`Column`, `Row`, `Card`, `Image`, `Text`, `Button`) with valid v1.0 `action.event` payloads:

```python
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
from a2ui.utils.renderer_state import RendererState
from .recipes import get_recipes

# ==============================================================================
# Model Configuration
# ==============================================================================
gemini_model = Gemini(
    model="gemini-3.5-flash-lite",
    retry_options=types.HttpRetryOptions(attempts=5),
)

catalogs = [BasicCatalog(ProtocolVersion.V1_0)]

processor = A2uiRequestProcessor(
    catalogs,
    format_factory=DirectJsonFormatFactory(),
)


def create_turn_processor(_ctx=None) -> A2uiRequestProcessor:
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
    "2. PER-TURN SURFACE CREATION: Every response renders as a new independent card in the chat timeline. ALWAYS start with `createSurface` using a fresh unique `surfaceId` (and never emit `updateComponents` for a surface from an earlier turn).\n"
    "3. A2UI v1.0 ENVELOPE: Set \"version\": \"1.0\" in each A2UI message.\n"
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

# Validates outgoing A2UI payloads against BasicCatalog + a fresh per-turn RendererState
# so missing createSurface or schema violations trigger automatic LLM self-correction.
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
```

### 7.2 Use the Pre-Configured Default Renderer (`@a2ui/react` & `@a2ui/web_core`)

To render standard A2UI v1.0 payloads on the client without writing custom component JSX, we use the official **`@a2ui/react`** and **`@a2ui/web_core`** packages from the [A2UI TypeScript renderers](https://github.com/a2ui-project/a2ui/tree/main/typescript/renderers/react). These packages parse incoming A2UI message streams (`createSurface`, `updateComponents`, `updateDataModel`) and automatically render standard `BasicCatalog` primitives (`Card`, `Column`, `Row`, `Text`, `Image`, `Button`, `Icon`).

> [!NOTE]
> **Already Pre-Installed & Pre-Created!**
> Both `@a2ui/react` and `@a2ui/web_core` are **already pre-configured** in `frontend/package.json` (and will be installed automatically when you run `npm install` in `frontend/`). Additionally, **`frontend/src/components/DefaultA2UIRenderer.tsx`**—along with its theme variables and `App.tsx` wiring—is **already created** in your workspace so you can start testing right away.

#### What to Examine (Optional)
If you want to understand how the client-side Default Renderer is put together, open and inspect these files in your editor:

1. **`frontend/src/components/DefaultA2UIRenderer.tsx`**:
   - **`MessageProcessor` (`@a2ui/web_core/v1_0`)**: Instantiated with `[basicCatalog]` to ingest backend-validated Stage 3 `BasicCatalog` messages directly with zero client adapters or schema workarounds, and manage reactive surface state.
   - **`injectBasicCatalogStyles()`**: Injects the structural CSS required by `@a2ui/web_core` basic primitives.
   - **`<A2uiSurface />` (`@a2ui/react`)**: Mounts the reactive Web Component tree and subscribes to `surface.onAction` to forward button events (`view_recipe`, `start_cooking`) back to `handleAction` in `App.tsx`.
2. **`frontend/src/index.css`**:
   - Per the [A2UI Theming & Styling Guide](https://a2ui.org/guides/theming), defines `--a2ui-*` CSS Custom Properties scoped to `.a2ui-default-surface` (primary Emerald buttons, Slate typography, rounded cards, and spacing) so standard primitives match the application's theme.
3. **`frontend/src/services/adkService.ts` & `frontend/src/App.tsx`**:
   - `adkService.ts` extracts `part.functionResponse.response.validated_a2ui_json` emitted by `SendA2uiToClientToolset` (with `<a2ui-json>` / raw JSON block fallback) and preserves `rawMessages` alongside `surfaceState`.
   - `App.tsx` provides a header toggle (**`Default (@a2ui/react)`** vs. **`Custom Catalog`**) and renders `<DefaultA2UIRenderer messages={msg.rawMessages} onAction={handleAction} />` when Default mode is active.

#### Test the Default Renderer & Understand Why to Switch to Custom UI Components
1. Open two terminals to start the backend and frontend:
   - **Terminal 1 — Start the ADK Backend (port `8080`)**:
     ```bash
     source .venv/bin/activate
     .venv/bin/adk web --port 8080 --allow_origins "*" --reload_agents
     ```
   - **Terminal 2 — Install & Start the React Frontend (port `3000`)**:
     ```bash
     cd frontend
     npm install
     npm run dev
     ```
2. Open `http://localhost:3000` in your browser, select **`Default (@a2ui/react)`** in the header, and ask:
   ```text
   What can I make for dinner tonight?
   ```
3. Notice how `@a2ui/react` renders standard `Card`, `Column`, `Row`, `Image`, `Text`, and `Button` components directly from your agent's `BasicCatalog` output—and clicking **"View"** or **"Let's Cook This"** triggers the next turn.

While turnkey default rendering is ideal for generic interfaces (forms, settings panels, and informational cards), specialized culinary experiences benefit from custom domain components:
- **Culinary Discovery Cards**: Rich photography headers, cooking time badges, calorie meters, and cuisine tags (`RecipeSummaryCard`).
- **Interactive Ingredient Checklists**: Checkable portions and chef prep advice (`RecipeDetailCard`).
- **Single-Card Guided Cooking with Live Timers**: A multi-step flow bundled into one card with zero-latency client-side **Next** / **Previous** navigation and interactive countdown timers (`GuidedCookingCard`, `CookingTimer`).

Now that you have tested the default renderer in Stage 3, let's move to **Stage 4** to author a **Formal Custom Culinary Catalog**!

---

## 8. Stage 4: Author a Formal Custom A2UI Catalog

> [!TIP]
> **Catch-up Checkpoint**: If you want to jump straight to Stage 4 or need to reset your code from Stage 3, you can optionally check out the `stage3` branch:
> ```bash
> git checkout stage3
> ```

Following the [A2UI Authoring Components Guide](https://a2ui.org/guides/authoring-components/#1-defining-the-catalog-schema), we define a formal, contract-driven Custom Catalog across both backend (Pydantic) and frontend (Zod + `@a2ui/react`'s `createComponentImplementation`).

### 8.1 Define the Formal Backend Catalog (`recipe_agent/catalog.py`)
Create `recipe_agent/catalog.py` to define strict Pydantic v1.0 component schemas extending `BASIC_COMPONENTS` for `RecipeSummaryCard`, `RecipeDetailCard`, `GuidedCookingCard`, and `DefaultCard`:

```python
# recipe_agent/catalog.py
"""Formal A2UI v1.0 Catalog Definition for the Culinary Recipe Assistant."""

from __future__ import annotations

from typing import List, Literal, Optional
from pydantic import BaseModel, Field

from a2ui.core.basic_catalog.v1_0 import BASIC_COMPONENTS, create_basic_catalog_functions
from a2ui.core.catalog import Catalog, ModelComponentApi
from a2ui.core.schema import ProtocolVersion
from a2ui.core.schema.v1_0 import (
    ComponentCommon,
    DynamicBoolean,
    DynamicNumber,
    DynamicString,
    DynamicStringList,
)

CULINARY_CATALOG_ID = (
    "https://a2ui.org/specification/v1_0/catalogs/culinary/catalog.json"
)


class RecipeSummaryCardComponent(ComponentCommon):
    """Compact summary card displaying a recipe overview and action buttons."""

    component: Literal["RecipeSummaryCard"] = "RecipeSummaryCard"
    recipeId: Optional[str] = Field(
        default=None, description="Unique identifier of the recipe."
    )
    name: DynamicString = Field(..., description="Display name of the recipe.")
    description: Optional[DynamicString] = Field(
        default=None, description="Short appetizing description of the dish."
    )
    cookTime: Optional[DynamicString] = Field(
        default=None, description="Cooking duration (e.g. '15 mins')."
    )
    prepTime: Optional[DynamicString] = Field(
        default=None, description="Preparation duration (e.g. '10 mins')."
    )
    difficulty: Optional[DynamicString] = Field(
        default=None, description="Difficulty level ('Easy', 'Medium', 'Hard')."
    )
    calories: Optional[DynamicString] = Field(
        default=None, description="Calorie count (e.g. '580 kcal')."
    )
    cuisine: Optional[DynamicString] = Field(
        default=None, description="Cuisine category (e.g. 'Italian', 'Thai')."
    )
    badge: Optional[DynamicString] = Field(
        default=None, description="Highlight badge (e.g. \"Chef's Choice\")."
    )
    imageUrl: Optional[DynamicString] = Field(
        default=None, description="Authentic image URL for the dish."
    )


class RecipeDetailCardComponent(ComponentCommon):
    """Full recipe detail card with ingredients list and guided cooking trigger."""

    component: Literal["RecipeDetailCard"] = "RecipeDetailCard"
    recipeId: Optional[str] = Field(
        default=None, description="Unique identifier of the recipe."
    )
    name: DynamicString = Field(..., description="Display name of the recipe.")
    description: Optional[DynamicString] = Field(
        default=None, description="Full description of the dish."
    )
    prepTime: Optional[DynamicString] = Field(
        default=None, description="Preparation duration."
    )
    cookTime: Optional[DynamicString] = Field(
        default=None, description="Cooking duration."
    )
    servings: Optional[DynamicNumber] = Field(
        default=None, description="Number of servings."
    )
    difficulty: Optional[DynamicString] = Field(
        default=None, description="Difficulty level."
    )
    calories: Optional[DynamicString] = Field(
        default=None, description="Calorie count per serving."
    )
    cuisine: Optional[DynamicString] = Field(
        default=None, description="Cuisine category."
    )
    badge: Optional[DynamicString] = Field(
        default=None, description="Highlight badge."
    )
    imageUrl: Optional[DynamicString] = Field(
        default=None, description="Authentic image URL for the dish."
    )
    ingredients: Optional[DynamicStringList] = Field(
        default=None, description="Complete list of recipe ingredients."
    )
    showCookButton: Optional[DynamicBoolean] = Field(
        default=True, description="Whether to show the Let's Cook This button."
    )


class GuidedStep(BaseModel):
    """A single step in a GuidedCookingCard."""

    step: int = Field(..., description="1-based step index.")
    title: str = Field(..., description="Short step heading.")
    instruction: str = Field(..., description="Detailed instruction for this step.")
    duration: Optional[str] = Field(
        default=None, description="Human-readable duration (e.g. '10 mins')."
    )
    timerMinutes: Optional[int] = Field(
        default=None,
        description="Optional countdown timer in minutes when timing is required.",
    )
    dish: Optional[str] = Field(default=None, description="Name of the dish.")
    tip: Optional[str] = Field(
        default=None, description="Optional chef tip for this step."
    )


class GuidedCookingCardComponent(ComponentCommon):
    """Interactive multi-step cooking guide with local navigation and step timers."""

    component: Literal["GuidedCookingCard"] = "GuidedCookingCard"
    dish: DynamicString = Field(..., description="Name of the dish being cooked.")
    steps: List[GuidedStep] = Field(
        ..., description="Ordered list of all cooking steps for this recipe."
    )


class DefaultCardComponent(ComponentCommon):
    """General informational card supporting rich Markdown text."""

    component: Literal["DefaultCard"] = "DefaultCard"
    title: Optional[DynamicString] = Field(
        default=None, description="Optional card title."
    )
    text: DynamicString = Field(
        ..., description="Markdown-formatted body text."
    )


CULINARY_COMPONENTS = [
    ModelComponentApi(RecipeSummaryCardComponent),
    ModelComponentApi(RecipeDetailCardComponent),
    ModelComponentApi(GuidedCookingCardComponent),
    ModelComponentApi(DefaultCardComponent),
]


def create_culinary_catalog(locale: str | None = None) -> Catalog:
    """Builds the formal Culinary Catalog extending the A2UI v1.0 Basic Catalog."""
    return Catalog(
        catalog_id=CULINARY_CATALOG_ID,
        protocol_version=ProtocolVersion.V1_0,
        components=list(BASIC_COMPONENTS) + CULINARY_COMPONENTS,
        functions=create_basic_catalog_functions(locale=locale),
        schema_dialect="https://json-schema.org/draft/2020-12/schema",
        schema_id=CULINARY_CATALOG_ID,
        title="Culinary Recipe Assistant Catalog",
        description=(
            "Formal A2UI v1.0 catalog combining standard layout primitives with "
            "custom culinary components (RecipeSummaryCard, RecipeDetailCard, "
            "GuidedCookingCard, DefaultCard)."
        ),
        declared_protocol_version="1.0",
        union_defs={"anyComponent": None, "anyFunction": None},
    )
```

### 8.2 Register the Custom Catalog in `recipe_agent/agent.py`
Update `recipe_agent/agent.py` to pass `create_culinary_catalog()` into `A2uiRequestProcessor` and `SendA2uiToClientToolset`, and instruct the agent on the three-stage custom component workflow:

```python
# recipe_agent/agent.py

import os
from google.adk.agents import Agent
from google.genai import types
from google.adk.models import Gemini
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

processor = A2uiRequestProcessor(
    catalogs,
    format_factory=DirectJsonFormatFactory(),
)


def create_turn_processor(_ctx=None) -> A2uiRequestProcessor:
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
```

### 8.3 Create the Frontend Zod Catalog (`frontend/src/catalog/culinaryCatalog.tsx`)
Create `frontend/src/catalog/culinaryCatalog.tsx`:

```tsx
// frontend/src/catalog/culinaryCatalog.tsx
import { z } from 'zod';
import {
  basicCatalog,
  DynamicBooleanSchema,
  DynamicNumberSchema,
  DynamicStringListSchema,
  DynamicStringSchema,
} from '@a2ui/web_core/v1_0';
import { createComponentImplementation } from '@a2ui/react';
import { RecipeSummaryCard } from '../components/RecipeSummaryCard';
import { RecipeDetailCard } from '../components/RecipeDetailCard';
import { GuidedCookingCard } from '../components/GuidedCookingCard';
import { DefaultCard } from '../components/DefaultCard';

export const CULINARY_CATALOG_ID =
  'https://a2ui.org/specification/v1_0/catalogs/culinary/catalog.json';

const normalizeImageUrl = (url?: string): string => {
  if (!url) return '';
  return String(url).replace(/^http:\/\/(?:127\.0\.0\.1|localhost):8080/, '');
};

// 1. Formal Zod Catalog Schemas (Matching recipe_agent/catalog.py)
export const RecipeSummaryCardApi = {
  name: 'RecipeSummaryCard',
  schema: z.object({
    recipeId: z.string().optional(),
    name: DynamicStringSchema,
    description: DynamicStringSchema.optional(),
    cookTime: DynamicStringSchema.optional(),
    prepTime: DynamicStringSchema.optional(),
    difficulty: DynamicStringSchema.optional(),
    calories: DynamicStringSchema.optional(),
    cuisine: DynamicStringSchema.optional(),
    badge: DynamicStringSchema.optional(),
    imageUrl: DynamicStringSchema.optional(),
  }),
};

export const RecipeDetailCardApi = {
  name: 'RecipeDetailCard',
  schema: z.object({
    recipeId: z.string().optional(),
    name: DynamicStringSchema,
    description: DynamicStringSchema.optional(),
    prepTime: DynamicStringSchema.optional(),
    cookTime: DynamicStringSchema.optional(),
    servings: z.union([DynamicNumberSchema, z.string()]).optional(),
    difficulty: DynamicStringSchema.optional(),
    calories: DynamicStringSchema.optional(),
    cuisine: DynamicStringSchema.optional(),
    badge: DynamicStringSchema.optional(),
    imageUrl: DynamicStringSchema.optional(),
    ingredients: z.union([DynamicStringListSchema, z.array(z.string())]).optional(),
    showCookButton: DynamicBooleanSchema.optional(),
  }),
};

export const GuidedStepSchema = z.object({
  step: z.union([z.number(), z.string()]).optional(),
  title: z.string().optional(),
  instruction: z.string(),
  duration: z.string().optional(),
  timerMinutes: z.union([z.number(), z.string()]).optional(),
  dish: z.string().optional(),
  tip: z.string().optional(),
});

export const GuidedCookingCardApi = {
  name: 'GuidedCookingCard',
  schema: z.object({
    dish: DynamicStringSchema,
    steps: z.array(GuidedStepSchema),
  }),
};

export const DefaultCardApi = {
  name: 'DefaultCard',
  schema: z.object({
    title: DynamicStringSchema.optional(),
    text: DynamicStringSchema,
  }),
};

// 2. Register React Custom Components via createComponentImplementation
const RecipeSummaryCardImpl = createComponentImplementation(
  RecipeSummaryCardApi as any,
  ({ props, context }: any) => (
    <RecipeSummaryCard
      id={props.recipeId || context.componentModel.id}
      name={String(props.name || '')}
      description={props.description ? String(props.description) : undefined}
      cookTime={props.cookTime ? String(props.cookTime) : undefined}
      prepTime={props.prepTime ? String(props.prepTime) : undefined}
      difficulty={props.difficulty ? String(props.difficulty) : undefined}
      calories={props.calories ? String(props.calories) : undefined}
      cuisine={props.cuisine ? String(props.cuisine) : undefined}
      badge={props.badge ? String(props.badge) : undefined}
      imageUrl={normalizeImageUrl(props.imageUrl)}
      onAction={(action) => {
        context.dispatchAction({
          event: { name: action.type, context: action.parameters || {} },
        });
      }}
    />
  )
);

const RecipeDetailCardImpl = createComponentImplementation(
  RecipeDetailCardApi as any,
  ({ props, context }: any) => (
    <RecipeDetailCard
      id={props.recipeId || context.componentModel.id}
      name={String(props.name || '')}
      description={props.description ? String(props.description) : undefined}
      prepTime={props.prepTime ? String(props.prepTime) : undefined}
      cookTime={props.cookTime ? String(props.cookTime) : undefined}
      servings={props.servings}
      difficulty={props.difficulty ? String(props.difficulty) : undefined}
      calories={props.calories ? String(props.calories) : undefined}
      cuisine={props.cuisine ? String(props.cuisine) : undefined}
      badge={props.badge ? String(props.badge) : undefined}
      imageUrl={normalizeImageUrl(props.imageUrl)}
      ingredients={Array.isArray(props.ingredients) ? props.ingredients.map(String) : []}
      showCookButton={props.showCookButton ?? true}
      onAction={(action) => {
        context.dispatchAction({
          event: { name: action.type, context: action.parameters || {} },
        });
      }}
    />
  )
);

const GuidedCookingCardImpl = createComponentImplementation(
  GuidedCookingCardApi as any,
  ({ props, context }: any) => (
    <GuidedCookingCard
      dish={String(props.dish || '')}
      steps={Array.isArray(props.steps) ? props.steps : []}
      onAction={(action) => {
        context.dispatchAction({
          event: { name: action.type, context: action.parameters || {} },
        });
      }}
    />
  )
);

const DefaultCardImpl = createComponentImplementation(
  DefaultCardApi as any,
  ({ props }: any) => (
    <DefaultCard
      title={props.title ? String(props.title) : undefined}
      text={String(props.text || '')}
    />
  )
);

// 3. Derived Formal Culinary Catalog
export const culinaryCatalog = basicCatalog.derive({
  catalogId: CULINARY_CATALOG_ID,
  components: [
    ...basicCatalog.components.values(),
    RecipeSummaryCardImpl as any,
    RecipeDetailCardImpl as any,
    GuidedCookingCardImpl as any,
    DefaultCardImpl as any,
  ],
  instructions:
    'Formal Culinary Recipe Catalog extending A2UI Basic Catalog with RecipeSummaryCard, RecipeDetailCard, GuidedCookingCard, and DefaultCard.',
});
```

### 8.4 Implement Custom UI Components in `frontend/src/components/A2UIRenderer.tsx`

Now we update `frontend/src/components/A2UIRenderer.tsx` to validate and render surfaces strictly via `MessageProcessor([culinaryCatalog])` and `<A2uiSurface />`, showing a clear error banner if the agent returns `BasicCatalog` (or fails schema validation) instead of falling back:

```tsx
// frontend/src/components/A2UIRenderer.tsx

import { useState, useEffect, type FC } from 'react';
import { MessageProcessor, basicCatalog, injectBasicCatalogStyles } from '@a2ui/web_core/v1_0';
import { A2uiSurface } from '@a2ui/react';
import { culinaryCatalog, CULINARY_CATALOG_ID } from '../catalog/culinaryCatalog';
import { AlertCircle } from 'lucide-react';

if (typeof document !== 'undefined') {
  injectBasicCatalogStyles();
}

interface Props {
  messages?: any[];
  onAction?: (action: { type: string; parameters?: Record<string, any>; context?: Record<string, any> }) => void;
}

export const A2UIRenderer: FC<Props> = ({ messages, onAction }) => {
  const [catalogSurfaces, setCatalogSurfaces] = useState<any[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    if (!messages || messages.length === 0) {
      setCatalogSurfaces([]);
      setCatalogError(null);
      return;
    }

    const returnedBasicCatalog = messages.some(
      (msg) => msg?.createSurface?.catalogId === basicCatalog.id
    );
    if (returnedBasicCatalog) {
      setCatalogSurfaces([]);
      setCatalogError(
        `Custom Catalog mode expected ${CULINARY_CATALOG_ID}, but the agent returned BasicCatalog (${basicCatalog.id}). Switch the header toggle to "Default (@a2ui/react)" or enable CulinaryCatalog on the agent.`
      );
      return;
    }

    const processor = new MessageProcessor([culinaryCatalog]);
    const actionSubs: Array<{ unsubscribe: () => void }> = [];

    const sync = () => {
      const activeSurfaces = Array.from(processor.model.surfacesMap.values());
      setCatalogSurfaces(activeSurfaces);

      actionSubs.forEach((sub) => sub.unsubscribe());
      actionSubs.length = 0;

      for (const surf of activeSurfaces) {
        const sub = (surf as any).onAction.subscribe((actionEvent: any) => {
          const actionName = actionEvent.name || actionEvent.type || 'action';
          const params = actionEvent.context || actionEvent.parameters || {};
          onAction?.({
            type: actionName,
            parameters: params,
            context: params,
          });
        });
        actionSubs.push(sub);
      }
    };

    const createdSub = processor.onSurfaceCreated(sync);
    const deletedSub = processor.onSurfaceDeleted(sync);

    try {
      processor.processMessages(messages);
      sync();
      if (processor.model.surfacesMap.size === 0) {
        setCatalogError(
          `Custom Catalog renderer could not create a surface for ${CULINARY_CATALOG_ID}.`
        );
      } else {
        setCatalogError(null);
      }
    } catch (err) {
      console.warn('Formal Culinary Catalog processor error:', err);
      setCatalogSurfaces([]);
      setCatalogError(
        err instanceof Error
          ? err.message
          : `Failed to validate payload against Custom Catalog (${CULINARY_CATALOG_ID}).`
      );
    }

    return () => {
      createdSub.unsubscribe();
      deletedSub.unsubscribe();
      actionSubs.forEach((sub) => sub.unsubscribe());
    };
  }, [messages, onAction]);

  if (catalogError) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900"
      >
        <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
        <div className="space-y-1">
          <p className="font-semibold">Catalog Mismatch Error</p>
          <p className="leading-relaxed text-red-800">{catalogError}</p>
        </div>
      </div>
    );
  }

  if (catalogSurfaces.length === 0) {
    return null;
  }

  return (
    <div className="a2ui-surface w-full space-y-4">
      {catalogSurfaces.map((surf) => (
        <A2uiSurface key={surf.id} surface={surf as any} />
      ))}
    </div>
  );
};
```
---

## 9. Test the Three-Stage Culinary Flow

With the agent configured, test the complete end-to-end culinary journey:

### Step 1: Recipe Discovery (Stage A)
**Prompt**:
```text
What can I make for dinner tonight?
```
**Result**: The agent calls `get_recipes` and returns interactive `RecipeSummaryCard`s. Each card features:
- Authentic food photography (`/images/carbonara.jpg`).
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

## 10. Production Frontend Integrations (Optional)

> [!NOTE]
> **Optional Reference**: You can finish the codelab with Section 9 above. For production deployments, you can render A2UI JSON on any client platform using official renderers:

| Framework | Package / SDK | Installation |
| :--- | :--- | :--- |
| **React** | `@a2ui/react` | `npm install @a2ui/react` |
| **Angular** | `@a2ui/angular` | `npm install @a2ui/angular` |
| **Lit / Web Components** | `@a2ui/lit` | `npm install @a2ui/lit` |
| **Flutter** | Flutter GenUI SDK | `flutter pub add genui` |

Because A2UI is decoupled from rendering engines, client applications translate the same JSON into native Material Design, Cupertino, or custom design system widgets.

---

## 11. Summary & Checklist

Congratulations! You built an interactive recipe assistant powered by ADK and A2UI.

- [x] **Stage 1**: Created a grounded agent retrieving recipe data without hallucination.
- [x] **Stage 2**: Used `a2ui-agent-sdk` to generate system prompts that guide Gemini to output structured A2UI v1.0 JSON.
- [x] **Stage 3**: Rendered the Default A2UI Catalog on the client using `@a2ui/react` and `@a2ui/web_core`, styled with CSS custom properties.
- [x] **Stage 4**: Authored a formal Custom Culinary Catalog (`recipe_agent/catalog.py` & `culinaryCatalog.tsx`) with `RecipeSummaryCard`, `RecipeDetailCard`, `GuidedCookingCard`, and `DefaultCard`.
- [x] **Markdown Formatting**: Formatted chef tips and general advice with full markdown rendering.

