# Codelab: Interactive Recipe Experiences with ADK and A2UI in Google Cloud Shell

Build an AI-powered culinary recipe dashboard using **Agent Development Kit (ADK)** and **A2UI**, rendering interactive recipe cards, dietary tags, and action buttons dynamically from structured JSON—all running entirely within **Google Cloud Shell** on **Google Cloud Platform (GCP)**.

---

## 1. Overview

Most AI assistants reply to cooking inquiries with long walls of plain text or bulleted lists. In this codelab, you will use **A2UI** (Agent-to-User Interface) to enable your agent to reply with a rich, interactive user interface directly inside Google Cloud Platform without needing to install anything on your local workstation.

The agent describes recipe cards, ingredients, cooking stats, and buttons in declarative JSON using the **A2UI v0.9.1** specification. The client renders them using its own native widgets—meaning new layouts and experiences do not require changes to frontend code.

### What you'll build
A **Recipe Assistant** built through three progressive stages:
1. **Stage 1: Grounded Plain Text Agent** — Queries recipe data via `get_recipes` and returns plain text.
2. **Stage 2: A2UI JSON Agent** — Queries recipe data and outputs structured A2UI v0.9.1 JSON with components and data bindings.
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
                 |    (Google AI Studio)    |
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
- How to set up and run Python ADK and Node.js React workflows inside **Google Cloud Shell**.
- How to access development servers using Cloud Shell's built-in **Web Preview** feature.
- How to ground an ADK agent using Gemini with a **Google AI Studio API Key**.
- How A2UI works: the **v0.9.1 specification**, the flat component model, top-down root ordering, and lifecycle messages (`createSurface`, `updateComponents`, `updateDataModel`, `deleteSurface`).
- How to design custom A2UI primitives (`RecipeSummaryCard`, `RecipeDetailCard`, `GuidedCookingCard`, `DefaultCard`).
- How to create a **single-card step-by-step stepper** with client-side navigation and interactive countdown timers.
- How to serve static food photography using ADK custom services (`recipe_agent/services.py`).

---

## 2. Set up your Google Cloud Shell Environment

**Google Cloud Shell** is a browser-based computing environment pre-authenticated with your Google Cloud account. It comes pre-installed with `gcloud`, `git`, `python3`, `node`, and `npm`.

### 2.1 Select Your Google Cloud Project and Open Cloud Shell
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. In the top navigation bar, click the **Project drop-down** and select (or create) the Google Cloud Project you will use for this codelab. Note down your **Project ID**.
3. Click the **Activate Cloud Shell** icon (`>_`) in the upper-right corner of the console toolbar:

![Google Cloud Shell](https://cloud.google.com/static/shell/docs/images/cloud-shell-toolbar.png)

4. In the Cloud Shell terminal, ensure your project is actively set:
   ```bash
   gcloud config set project YOUR_PROJECT_ID
   ```
   *(Replace `YOUR_PROJECT_ID` with your actual Project ID).*

### 2.2 Verify Installed Tooling
Run the following in Cloud Shell to verify Python and Node versions:
```bash
python3 --version   # Python 3.10+ (or 3.11/3.12)
node --version      # v18+ or v20+
npm --version
```

### 2.3 Clone or Navigate to the Codebase
If cloning from your git repository in Cloud Shell, checkout the starter `stage0` branch:
```bash
git clone https://github.com/shangyilim/a2uirecipe.git
cd a2uirecipe
git checkout stage0
```

### 2.4 Set Up Python Virtual Environment
Cloud Shell manages packages best within a virtual environment. Create and activate `.venv`:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install google-adk a2ui-agent-sdk a2ui-adk
```

### 2.5 Configure Google AI Studio API Credentials
To call Gemini, obtain an API key from Google AI Studio tied to the same Google Cloud Project:

1. Copy the example environment configuration:
   ```bash
   cp recipe_agent/.env.example recipe_agent/.env
   ```
2. **Obtain your Gemini API Key**:
   - Go to [Google AI Studio Get API Key](https://aistudio.google.com/app/apikey).
   - Click **Create API key**.
   - When prompted to choose a project, click **Select existing project** and pick the **same Google Cloud Project** you selected in Step 2.1.
   - Click **Create API key in existing project** and copy the generated key.
3. Open `recipe_agent/.env` and paste your API key:
   ```bash
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   RECIPE_STAGE=1
   ```

### 2.6 Open Google Cloud Shell Editor
To easily explore and edit files throughout this codelab, open the Cloud Shell built-in code editor:

1. In the upper-right toolbar of Cloud Shell, click **Open Editor** (the pencil icon):
   
   ![Cloud Shell Editor Button](https://cloud.google.com/static/shell/docs/images/open-editor.png)

2. The browser-based Cloud Shell Editor (based on VS Code / Theia) will open in a split pane above the terminal.
3. In the left file explorer sidebar, expand the `a2uirecipe` directory to inspect the project layout, source code, and configuration files.

---

## 3. Understand the Recipe Mock Data & Tool

Inspect `recipe_agent/recipes.py`. It provides a curated collection of authentic recipes along with the tool function `get_recipes()`.

Each recipe contains:
- Preparation & cooking durations
- Servings, calories, and difficulty rating
- Complete ingredients list
- Step-by-step instructions
- Dietary tags & chef badges
- Static image endpoint (`http://127.0.0.1:8080/images/...`)

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
    # Additional recipes: Thai Basil Chicken, Mediterranean Quinoa Bowl, Tuscan Garlic Salmon, etc.
]

def get_recipes() -> list[dict]:
    """Returns the list of authentic curated recipes."""
    return RECIPES
```

---

## 4. Stage 1: Build the Plain Text Agent

In Stage 1, we set up an agent that answers culinary inquiries using traditional plain-text conversational output.

### 4.1 Create `recipe_agent/agent.py`
Use the **Cloud Shell Editor** to easily create and save this file:
1. In the Cloud Shell Editor file explorer on the left, right-click the `recipe_agent` folder and select **New File**.
2. Name the file `agent.py`.
3. Paste the following code into `recipe_agent/agent.py` and save (`Ctrl+S` or `Cmd+S`):

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
        "recipes, cooking ideas, or ingredients, you MUST use the get_recipes tool to retrieve "
        "the available recipe data. Summarize the recipes clearly in plain text with "
        "cooking times, ingredients, and step-by-step instructions. Never hallucinate or make up recipes."
    ),
    tools=[get_recipes],
)
```

### 4.2 Start the ADK Server in Cloud Shell
If your terminal pane is minimized, click **Open Terminal** in the top-right toolbar of Cloud Shell. Then start the ADK web server on port **8080**:
```bash
.venv/bin/adk web --port 8080 --allow_origins "*"
```

### 4.3 View in Cloud Shell Web Preview
Because Cloud Shell runs on a remote virtual machine, you cannot open `localhost:8080` on your desktop browser directly. Instead, use Cloud Shell's **Web Preview**:

1. In the upper right corner of the Cloud Shell window, click the **Web Preview** icon:
   
   ![Web Preview Button](https://cloud.google.com/static/shell/docs/images/web-preview.png)

2. Click **Preview on port 8080**.
3. A new browser tab opens to your ADK Web Server UI.
4. Select **`recipe_assistant`** and send:
   ```text
   What can I make for dinner tonight?
   ```
5. **Observation**: The response contains recipe recommendations, but formatting is entirely unstructured text requiring tedious scrolling.

---

## 5. Stage 2: Generate Structured A2UI JSON (v1.0)

> [!TIP]
> **Catch-up Checkpoint**: If you want to jump straight to Stage 2 or need to reset your code from Stage 1, you can check out the `stage1` branch in your terminal:
> ```bash
> git checkout stage1
> ```

In Stage 2, we upgrade the agent to output structured **A2UI v1.0 JSON** instead of plain text.

### 5.1 Use `a2ui.adk` A2uiInstruction & A2uiRequestProcessor
The A2UI framework provides an official ADK integration via `A2uiInstruction` and `A2uiRequestProcessor`. 
- **`A2uiRequestProcessor`**: Binds the component catalog (`BasicCatalog(ProtocolVersion.V1_0)`) with an inference format factory (`DirectJsonFormatFactory()`) and compiles the formal v1.0 JSON schema and workflow rules.
- **`A2uiInstruction`**: Acts as a dynamic, callable instruction provider for ADK. ADK parses `{variable}` syntax as session state templates; `A2uiInstruction` safely injects A2UI JSON schema templates and few-shot examples without triggering template parsing errors.

Update `recipe_agent/agent.py` to inspect the raw JSON:
```python
# recipe_agent/agent.py

from google.adk.agents import Agent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models import Gemini
from google.adk.models.llm_response import LlmResponse
from google.genai import types
from a2ui.adk import A2uiInstruction
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
- The first component in 'components' MUST have id 'root'.
- Use flat v1.0 components where 'component' is a string discriminator (e.g. 'Column', 'Text', 'Button').
- Set 'version': '1.0' in every message envelope.
- Use 'children' array with component IDs, 'justify' instead of distribution, 'align' instead of alignment, and 'variant' instead of usageHint.
- Respond ONLY with the A2UI JSON array inside <a2ui-json> and </a2ui-json> tags.
"""

# Dynamic A2UI instruction wrapper for ADK
instruction = A2uiInstruction(
    f"{ROLE_DESCRIPTION}\n\n## UI Description:\n{UI_DESCRIPTION}",
    a2ui_processor=processor,
)

def show_raw_json(
    callback_context: CallbackContext,
    llm_response: LlmResponse,
) -> LlmResponse | None:
    """Stage 2 callback: Converts <a2ui-json> tags into markdown code blocks."""
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

### 5.2 Test Stage 2
1. Refresh the Web Preview tab on port 8080.
2. Ask:
   ```text
   What can I make for dinner tonight?
   ```
3. **Observation**: Gemini now returns declarative A2UI v1.0 JSON blocks (`createSurface`, `updateComponents`, `updateDataModel`) formatted as code blocks.

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
Declares components using a clean **flat discriminator model** (`component: "<Type>"`) where attributes live directly on the component object:
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
Surface IDs are scoped to **currently active surfaces**. When a surface is deleted via `deleteSurface`, its ID can be safely reused for subsequent responses:
```json
{
  "version": "1.0",
  "deleteSurface": {
    "surfaceId": "default"
  }
}
```

### 5. Standardized MIME Type & Bidirectional RPC
- **MIME Type**: Official MIME type is standardized to `application/a2ui+json`.
- **Bidirectional RPC**: v1.0 introduces native agent-renderer function invocation:
  - `callRendererFunction` / `rendererFunctionResponse`
  - `callAgentFunction` / `agentFunctionResponse`

### Specification Evolution Quick Reference

| Feature | v0.8.1 (Legacy) | v0.9 / v0.9.1 (Evolution) | v1.0 (Standardized) |
| :--- | :--- | :--- | :--- |
| **Envelope Version** | Omitted | `"v0.9.1"` | **`"version": "1.0"`** |
| **MIME Type** | `application/json` | `application/a2ui+json` | **`application/a2ui+json`** |
| **Data Binding** | `{ "path": "/key" }` | `{ "path": "/key" }` | **`{ "@path": "/key" }`** |
| **Action / Call** | `{ "call": "fn" }` | `{ "type": "fn", "context": {...} }` | **`{ "@call": "fn", "args": {...} }`** |
| **Surface Creation** | `beginRendering: { root }` | `createSurface: { surfaceId }` | **`createSurface` (supports embedded components & dataModel)** |
| **Theme in Surface** | Deprecated | `theme: {...}` | **Removed** (native client theme) |
| **Component Model** | Nested `{ "component": { "Text": {...} } }` | Flat `{ "component": "Text", ... }` | **Flat `{ "component": "Text", ... }`** |
| **Root Convention** | Parameter in `beginRendering` | Component with `"id": "root"` | **Component with `"id": "root"` placed first** |
| **Surface ID Scope** | Lifetime of renderer | Active surfaces | **Currently active surfaces** |

---

## 7. Stage 3: Unified Agent Architecture & Custom A2UI Catalog

> [!TIP]
> **Catch-up Checkpoint**: If you want to jump straight to Stage 3 or need to reset your code from Stage 2, you can check out the `stage2` branch in your terminal:
> ```bash
> git checkout stage2
> ```

In Stage 3, the agent supports full rendered A2UI with a **three-stage culinary workflow**:
1. **Stage A (Discovery)**: Displays `RecipeSummaryCard`s featuring food photography, cook times, difficulty badges, and "View" / "Let's Cook This" buttons.
2. **Stage B (Recipe Details)**: When the user clicks "View", renders `RecipeDetailCard` with complete ingredients checklist, nutrition stats, and the "Let's Cook This" button.
3. **Stage C (Guided Cooking in 1 Card)**: When the user clicks "Let's Cook This", emits a single unified `GuidedCookingCard` containing all steps. The user navigates forward and backward locally using client-side **Next** and **Previous** buttons without triggering slow agent roundtrips. Steps with timing information (boiling, simmering, searing) feature live interactive countdown timers!
4. **General Text & Tips**: Explanations and chef tips are rendered using `DefaultCard` with full markdown formatting.

Here is the complete unified `recipe_agent/agent.py`:

```python
# recipe_agent/agent.py

import os
from google.adk.agents import Agent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models import Gemini
from google.adk.models.llm_response import LlmResponse
from google.genai import types
from a2ui.adk import A2uiInstruction
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
    "### A2UI v1.0 Component Specifications:\n"
    "Construct rich A2UI v1.0 surfaces following these rules:\n"
    "1. First call get_recipes to fetch authentic recipes. Do NOT invent recipes or image URLs.\n"
    "2. A2UI v1.0 ENVELOPE: Set \"version\": \"1.0\" in each A2UI message.\n"
    "3. TOP-DOWN ORDERING & ROOT: The first element in 'components' MUST be the root container with id 'root'.\n"
    "4. FLAT v1.0 COMPONENT MODEL: Every component has 'id', 'component': '<Type>', and its properties placed directly on the object.\n\n"
    "5. Root Container Example:\n"
    "{\n"
    '  "id": "root",\n'
    '  "component": "Column",\n'
    '  "children": ["recipe-summary-1", "recipe-summary-2"],\n'
    '  "justify": "start"\n'
    "}\n\n"
    "6. Custom Component: 'RecipeSummaryCard' (FOR RECIPE LISTS & RECOMMENDATIONS):\n"
    "{\n"
    '  "id": "recipe-summary-<id>",\n'
    '  "component": "RecipeSummaryCard",\n'
    '  "recipeId": "<recipe.id>",\n'
    '  "name": "<recipe.name>",\n'
    '  "description": "<recipe.description>",\n'
    '  "cookTime": "<recipe.cook_time>",\n'
    '  "prepTime": "<recipe.prep_time>",\n'
    '  "difficulty": "<recipe.difficulty>",\n'
    '  "calories": "<recipe.calories>",\n'
    '  "cuisine": "<recipe.cuisine>",\n'
    '  "badge": "<recipe.badge>",\n'
    '  "imageUrl": "<recipe.image_url>"\n'
    "}\n\n"
    "7. Custom Component: 'RecipeDetailCard' (WHEN VIEWING DETAILS):\n"
    "{\n"
    '  "id": "recipe-detail-<id>",\n'
    '  "component": "RecipeDetailCard",\n'
    '  "recipeId": "<recipe.id>",\n'
    '  "name": "<recipe.name>",\n'
    '  "description": "<recipe.description>",\n'
    '  "prepTime": "<recipe.prep_time>",\n'
    '  "cookTime": "<recipe.cook_time>",\n'
    '  "servings": <recipe.servings>,\n'
    '  "difficulty": "<recipe.difficulty>",\n'
    '  "calories": "<recipe.calories>",\n'
    '  "cuisine": "<recipe.cuisine>",\n'
    '  "badge": "<recipe.badge>",\n'
    '  "imageUrl": "<recipe.image_url>",\n'
    '  "ingredients": <recipe.ingredients>,\n'
    '  "showCookButton": true\n'
    "}\n\n"
    "8. Custom Component: 'GuidedCookingCard' (FOR STEP-BY-STEP GUIDED COOKING - ALL STEPS IN 1 CARD):\n"
    "Bundle ALL steps for the recipe in a single GuidedCookingCard so the user navigates locally with Next and Previous buttons:\n"
    "{\n"
    '  "id": "guided-cooking-1",\n'
    '  "component": "GuidedCookingCard",\n'
    '  "dish": "Classic Roman Carbonara",\n'
    '  "steps": [\n'
    '    {\n'
    '      "step": 1,\n'
    '      "title": "Boil Pasta until Al Dente",\n'
    '      "instruction": "Bring a large pot of salted water to a gentle boil and cook spaghetti until al dente.",\n'
    '      "duration": "10 mins",\n'
    '      "timerMinutes": 10,\n'
    '      "dish": "Classic Roman Carbonara",\n'
    '      "tip": "Save 1/2 cup of starchy pasta water before draining!"\n'
    '    },\n'
    '    {\n'
    '      "step": 2,\n'
    '      "title": "Crisp the Guanciale",\n'
    '      "instruction": "In a large skillet, cook sliced guanciale over medium heat until golden and crispy.",\n'
    '      "duration": "5 mins",\n'
    '      "timerMinutes": 5,\n'
    '      "dish": "Classic Roman Carbonara",\n'
    '      "tip": "Render fat slowly for extra crunch."\n'
    '    },\n'
    '    {\n'
    '      "step": 3,\n'
    '      "title": "Whisk Egg and Cheese Mixture",\n'
    '      "instruction": "In a bowl, whisk whole eggs, egg yolks, grated Pecorino Romano, and freshly cracked black pepper.",\n'
    '      "dish": "Classic Roman Carbonara",\n'
    '      "tip": "Whisk until a thick, creamy paste forms."\n'
    '    },\n'
    '    {\n'
    '      "step": 4,\n'
    '      "title": "Combine Pasta and Guanciale",\n'
    '      "instruction": "Transfer al dente pasta into the skillet with guanciale and toss to coat in rendered fat off the heat.",\n'
    '      "dish": "Classic Roman Carbonara"\n'
    '    },\n'
    '    {\n'
    '      "step": 5,\n'
    '      "title": "Emulsify Carbonara Sauce",\n'
    '      "instruction": "Off the heat, quickly pour in egg mixture while vigorously tossing pasta. Splash reserved pasta water as needed to create a glossy sauce.",\n'
    '      "dish": "Classic Roman Carbonara",\n'
    '      "tip": "Keep skillet off heat to prevent eggs from scrambling!"\n'
    '    }\n'
    '  ]\n'
    "}\n\n"
    "9. Custom Component: 'DefaultCard' (FOR GENERAL TEXT & EXPLANATIONS WITH MARKDOWN):\n"
    "Use this default card whenever showing explanations, dietary notes, cooking tips, or general messages. It fully formats markdown:\n"
    "{\n"
    '  "id": "info-card-1",\n'
    '  "component": "DefaultCard",\n'
    '  "title": "Chef\'s Tip & Dietary Notes",\n'
    '  "text": "### How to Perfect Carbonara\\n\\n- **Never add heavy cream**: Emulsion of egg yolks and starchy water creates the silky texture.\\n- **Toast the pepper**: Toasted black pepper releases fragrant essential oils."\n'
    "}\n\n"
    "Wrap your A2UI JSON array inside <a2ui-json> and </a2ui-json> tags."
)

a2ui_instruction = A2uiInstruction(
    (
        f"{ROLE_DESCRIPTION}\n\n"
        f"{WORKFLOW_DESCRIPTION}\n\n"
        f"## UI Description:\n{UI_DESCRIPTION}"
    ),
    a2ui_processor=processor,
)


def show_raw_json(
    callback_context: CallbackContext,
    llm_response: LlmResponse,
) -> LlmResponse | None:
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
    model=gemini_model,
    name="recipe_assistant",
    description="A culinary assistant that renders rich A2UI recipe interfaces.",
    instruction=a2ui_instruction,
    tools=[get_recipes],
)
```

---

## 8. Test the Three-Stage Interactive Flow

With the agent configured, test the complete culinary journey:

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
- Complete bulleted ingredient checklist with portions (e.g., 200g Spaghetti, 100g Guanciale, 3 egg yolks).
- Servings, cook time, and nutritional stats.
- Prominent **"Let's Cook This"** button.

### Step 3: Single-Card Guided Cooking (Stage C)
**Action**: Click the **"Let's Cook This"** button.
**Result**: The agent emits a single, self-contained `GuidedCookingCard`:
- **Single Unified Card**: All 5 steps are bundled into one card container with a progress bar and numbered step pills (`[1]`, `[2]`, `[3]`, etc.).
- **One Step at a Time**: Only the current active step is visible, keeping the screen focused and clean.
- **Local Client-Side Navigation**: Clicking **"Next Step"** or **"Previous"** immediately advances or rewinds the step locally in React with **zero latency** and **no additional agent turns**.
- **Interactive Timers**: Step 1 (10 mins boiling pasta) and Step 2 (5 mins crisping guanciale) display built-in digital countdown timers with **Start**, **Pause**, **Reset**, and bell chimes directly inside the card!
- **Culinary Tips**: Chef's advice appears highlighted in amber.
- **Completion**: The final step displays **"Finish Cooking!"**, congratulating the user and inviting plating recommendations.

---

## 9. Simulated Remote Food Photography & ADK Custom Services

To serve food photography assets without needing external cloud storage buckets, the agent packages its images and custom FastAPI service hooks:

1. **Asset Directory** (`recipe_agent/images/`):
   Contains food photography for each dish (`carbonara.jpg`, `pad_krapow.jpg`, `quinoa_bowl.jpg`, `tuscan_salmon.jpg`, `berry_parfait.jpg`).
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

## 10. React Client Companion in Google Cloud Shell

A complete React application is provided in the `frontend/` directory to demonstrate client-side A2UI rendering with modern styling and responsive interactions.

### 10.1 Multi-Port Architecture in Cloud Shell
Inside Cloud Shell, we run two simultaneous servers:
- **ADK Backend Server**: Port `8080`
- **React Frontend Dev Server (Vite)**: Port `3000`

### 10.2 Configure Frontend API URL for Cloud Shell
Because Cloud Shell exposes web applications through port-proxied URLs, configure `frontend/` to connect to port 8080:

```bash
cd frontend
cat <<EOF > .env.local
VITE_ADK_URL=http://127.0.0.1:8080
EOF
```

### 10.3 Run the Servers in Google Cloud Shell
Open **two Cloud Shell terminal tabs** (click the **`+`** icon on the Cloud Shell terminal bar to open a second tab):

#### In Tab 1: Start ADK Backend
```bash
cd ~/a2uirecipe
source .venv/bin/activate
export RECIPE_STAGE=3
.venv/bin/adk web --port 8080 --allow_origins "*"
```

#### In Tab 2: Start React Frontend
```bash
cd ~/a2uirecipe/frontend
npm install
npm run dev -- --host 0.0.0.0 --port 3000
```
> **Tip for Cloud Shell**: Passing `--host 0.0.0.0` ensures the Vite development server binds to all interfaces, allowing Cloud Shell's Web Preview proxy to reach it.

### 10.4 Access the React Frontend via Web Preview
1. Click the **Web Preview** icon (`>_` with an eye) in the top-right toolbar of Cloud Shell.
2. Select **Change port**.
3. Type `3000` and click **Change and Preview**.
4. The React Culinary Recipe Assistant application opens in a new tab!
5. Test sending `"What can I make for dinner tonight?"` and interact with the custom discovery cards, details, and guided cooking stepper.

---

## 11. Production Deployment on Google Cloud

When you are ready to deploy your A2UI Recipe Assistant to production on Google Cloud:

### 11.1 Deploying the ADK Backend to Cloud Run
Containerize the ADK agent and deploy with serverless auto-scaling on **Cloud Run**:
```bash
# Build and deploy container directly to Cloud Run
gcloud run deploy recipe-assistant-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars RECIPE_STAGE=3,GEMINI_API_KEY=${GEMINI_API_KEY}
```

### 11.2 Deploying the Frontend to Firebase App Hosting / Cloud Storage
Build the React production bundle:
```bash
cd frontend
npm run build
```
Deploy the `dist/` directory to **Firebase Hosting** or **Cloud Storage + Cloud CDN** for global low-latency distribution.

---

## 12. Summary & Checklist

Congratulations! You built and ran a full-stack, AI-powered interactive recipe assistant inside **Google Cloud Shell** using **ADK** and **A2UI**.

- [x] **Cloud Shell Environment**: Configured Python venv, Node.js, and Google AI Studio credentials.
- [x] **Stage 1**: Created a grounded agent retrieving recipe data without hallucination.
- [x] **Stage 2**: Used `a2ui-agent-sdk` to generate prompts guiding Gemini to output structured A2UI v0.9.1 JSON.
- [x] **Stage 3**: Rendered interactive UI cards, badges, and buttons directly inside `adk web` and React.
- [x] **Custom Component Catalog**: Built `RecipeSummaryCard`, `RecipeDetailCard`, `GuidedCookingCard`, and `DefaultCard`.
- [x] **Single-Card Guided Stepper**: Packaged all recipe steps into 1 card with zero-latency local Next/Previous buttons and live countdown timers.
- [x] **Web Preview**: Accessed and tested both port 8080 (ADK) and port 3000 (React) using Cloud Shell's built-in Web Preview.
- [x] **Cloud Native**: Documented serverless deployment paths using Cloud Run and Firebase Hosting.
