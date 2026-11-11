# Codelab: Interactive Recipe Experiences with ADK and A2UI in Google Cloud Shell

Build an AI-powered culinary recipe dashboard using **Agent Development Kit (ADK)** and **A2UI**, rendering interactive recipe cards, dietary tags, and action buttons dynamically from structured JSON—all running entirely within **Google Cloud Shell** on **Google Cloud Platform (GCP)**.

---

## 1. Overview

Most AI assistants reply to cooking inquiries with long walls of plain text or bulleted lists. In this codelab, you will use **A2UI** (Agent-to-User Interface) to enable your agent to reply with a rich, interactive user interface directly inside Google Cloud Platform without needing to install anything on your local workstation.

The agent describes recipe cards, ingredients, cooking stats, and buttons in declarative JSON using the **A2UI v0.9.1** specification. The client renders them using its own native widgets—meaning new layouts and experiences do not require changes to frontend code.

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
                 |    (Google AI Studio)    |
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
- Static image endpoint (`/images/...`)

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

In Stage 2, we upgrade the agent to output **validated A2UI v1.0 JSON** instead of plain text.

### 5.1 Use `a2ui.adk` (`A2uiInstruction`, `A2uiRequestProcessor` & `SendA2uiToClientToolset`)
The A2UI framework provides an official ADK integration combining three pieces:
- **`A2uiRequestProcessor`**: Binds the component catalog (`BasicCatalog(ProtocolVersion.V1_0)`) with an inference format factory (`DirectJsonFormatFactory()`) and compiles the formal v1.0 JSON schema and workflow rules.
- **`A2uiInstruction`**: Acts as a dynamic, callable instruction provider for ADK. ADK parses `{variable}` syntax as session state templates; `A2uiInstruction` safely injects A2UI JSON schema templates and few-shot examples without triggering template parsing errors.
- **`SendA2uiToClientToolset`**: Exposes the `send_a2ui_json_to_client` tool to Gemini. Rather than emitting fragile raw JSON inside chat text, the model submits its A2UI payload to this tool, which runs `validate_payload` on the Python backend:
  - If validation fails (e.g., hyphenated component IDs or legacy `usageHint` properties), it returns `{ "error": "..." }` so the model self-corrects automatically.
  - Once valid, it sets `skip_summarization = True` and returns `{ "validated_a2ui_json": [...] }` as a clean `functionResponse`.

Update `recipe_agent/agent.py` to add the processor, instruction, and toolset:
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

### 5.2 Test Stage 2
1. Refresh the Web Preview tab on port 8080.
2. Ask:
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

## 7. Stage 3: Render Default A2UI Catalog on the Client

> [!TIP]
> **Catch-up Checkpoint**: If you want to jump straight to Stage 3 or need to reset your code from Stage 2, you can check out the `stage2` branch in your terminal:
> ```bash
> git checkout stage2
> ```

In Stage 3, we configure the agent with the standard A2UI v1.0 `BasicCatalog` and render its output on the React client using the turnkey `@a2ui/react` default renderer (`DefaultA2UIRenderer.tsx`), styled with CSS custom properties. Once you've seen the default primitives in action, we'll move to **Stage 4** to author a formal custom Culinary Catalog!

---

### 7.1 Configure the Base A2UI v1.0 Agent (`recipe_agent/agent.py`)

To start with the **Default Renderer (`@a2ui/react`)**, use Cloud Shell Editor to configure `recipe_agent/agent.py` using the built-in `BasicCatalog(ProtocolVersion.V1_0)`. This instructs the agent to emit standard A2UI v1.0 primitives (`Column`, `Row`, `Card`, `Image`, `Text`, `Button`) with valid v1.0 `action.event` payloads:

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
1. Start the ADK backend (port `8080`) and the React frontend (port `3000`) (see **Section 11.2–11.4** for Cloud Shell Vite proxy & Web Preview setup).
2. In the app header, select **`Default (@a2ui/react)`** and ask:
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

Following the [A2UI Authoring Components Guide](https://a2ui.org/guides/authoring-components/#1-defining-the-catalog-schema), we define a formal, contract-driven Custom Catalog across both backend (Pydantic) and frontend (Zod + `@a2ui/react`'s `createComponentImplementation`).

### 8.1 Define the Formal Backend Catalog (`recipe_agent/catalog.py`)
Use Cloud Shell Editor to create `recipe_agent/catalog.py` defining strict Pydantic v1.0 component schemas extending `BASIC_COMPONENTS` for `RecipeSummaryCard`, `RecipeDetailCard`, `GuidedCookingCard`, and `DefaultCard`:

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
Use Cloud Shell Editor to update `recipe_agent/agent.py` to pass `create_culinary_catalog()` into `A2uiRequestProcessor` and `SendA2uiToClientToolset`, and instruct the agent on the three-stage custom component workflow:

```python
# recipe_agent/agent.py

import os
from google.adk.agents import Agent
from google.genai import types
from google.adk.models import Gemini
from a2ui.adk import A2uiInstruction, SendA2uiToClientToolset
from a2ui.inference_formats.direct_json import DirectJsonFormatFactory
from a2ui.processor import A2uiRequestProcessor
from .catalog import CULINARY_CATALOG_ID, create_culinary_catalog
from .recipes import get_recipes

# ==============================================================================
# Model Configuration
# ==============================================================================
gemini_model = Gemini(
    model="gemini-3.5-flash-lite",
    retry_options=types.HttpRetryOptions(attempts=5),
)

processor = A2uiRequestProcessor(
    [create_culinary_catalog()],
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
    f"2. A2UI v1.0 ENVELOPE & CATALOG: Set \"version\": \"1.0\" in each A2UI message and \"catalogId\": \"{CULINARY_CATALOG_ID}\" in createSurface.\n"
    "3. TOP-DOWN ORDERING & ROOT: The first element in 'components' MUST be the root container with id 'root'.\n"
    "4. FLAT v1.0 COMPONENT MODEL & UAX #31 IDENTIFIERS: Every component has 'id', 'component': '<Type>', and its properties placed directly on the object. Component IDs MUST be valid UAX #31 identifiers (use letters, numbers, and underscores like 'header_text', 'recipe_summary_1'; NEVER use hyphens '-').\n"
    "5. BUTTON ACTIONS: Every 'Button' component MUST have a valid v1.0 action with the exact recipe name in context:\n"
    "   - View Button: \"action\": {\"event\": {\"name\": \"view_recipe\", \"context\": {\"recipe_name\": \"<exact recipe name>\"}}}\n"
    "   - Cook Button: \"action\": {\"event\": {\"name\": \"start_cooking\", \"context\": {\"recipe_name\": \"<exact recipe name>\"}}}\n"
    "   Always supply the exact recipe name from the tool in the context object.\n\n"
    "6. Root Container Example:\n"
    "{\n"
    '  "id": "root",\n'
    '  "component": "Column",\n'
    '  "children": ["recipe_summary_1", "recipe_summary_2"],\n'
    '  "justify": "start"\n'
    "}\n\n"
    "7. Custom Component: 'RecipeSummaryCard' (FOR RECIPE LISTS & RECOMMENDATIONS):\n"
    "{\n"
    '  "id": "recipe_summary_<id>",\n'
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
    "8. Custom Component: 'RecipeDetailCard' (WHEN VIEWING DETAILS):\n"
    "{\n"
    '  "id": "recipe_detail_<id>",\n'
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
    "9. Custom Component: 'GuidedCookingCard' (FOR STEP-BY-STEP GUIDED COOKING - ALL STEPS IN 1 CARD):\n"
    "Bundle ALL steps for the recipe in a single GuidedCookingCard so the user navigates locally with Next and Previous buttons:\n"
    "{\n"
    '  "id": "guided_cooking_1",\n'
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
    "10. Custom Component: 'DefaultCard' (FOR GENERAL TEXT & EXPLANATIONS WITH MARKDOWN):\n"
    "Use this default card whenever showing explanations, dietary notes, cooking tips, or general messages. It fully formats markdown:\n"
    "{\n"
    '  "id": "info_card_1",\n'
    '  "component": "DefaultCard",\n'
    '  "title": "Chef\'s Tip & Dietary Notes",\n'
    '  "text": "### How to Perfect Carbonara\\n\\n- **Never add heavy cream**: Emulsion of egg yolks and starchy water creates the silky texture.\\n- **Toast the pepper**: Toasted black pepper releases fragrant essential oils."\n'
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
```

### 8.3 Create the Frontend Zod Catalog (`frontend/src/catalog/culinaryCatalog.tsx`)
Create `frontend/src/catalog/culinaryCatalog.tsx` in Cloud Shell Editor (also add `"zod": "^3.25.76"` to `frontend/package.json` dependencies if not already listed):

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

Open `frontend/src/components/A2UIRenderer.tsx` in Cloud Shell Editor and update it to validate and render surfaces via `MessageProcessor([culinaryCatalog, basicCatalog])` and `<A2uiSurface />`, with a resilient React `renderComponent` fallback:

```tsx
// frontend/src/components/A2UIRenderer.tsx

import { useState, useEffect, type FC, type ReactNode } from 'react';
import { MessageProcessor, basicCatalog } from '@a2ui/web_core/v1_0';
import { A2uiSurface } from '@a2ui/react';
import { culinaryCatalog } from '../catalog/culinaryCatalog';
import { A2UIComponent, SurfaceState } from '../types/a2ui';
import { Clock, Star, Flame, ChefHat } from 'lucide-react';
import { RecipeDetailCard } from './RecipeDetailCard';
import { RecipeSummaryCard } from './RecipeSummaryCard';
import { CookingTimer } from './CookingTimer';
import { InstructionStepCard } from './InstructionStepCard';
import { GuidedCookingCard } from './GuidedCookingCard';
import { DefaultCard } from './DefaultCard';
import { MarkdownRenderer } from './MarkdownRenderer';

interface Props {
  messages?: any[];
  surface?: SurfaceState;
  onAction?: (action: { type: string; parameters?: Record<string, any>; context?: Record<string, any> }) => void;
}

export const A2UIRenderer: FC<Props> = ({ messages, surface, onAction }) => {
  const [catalogSurfaces, setCatalogSurfaces] = useState<any[]>([]);

  useEffect(() => {
    if (!messages || messages.length === 0) {
      setCatalogSurfaces([]);
      return;
    }

    const processor = new MessageProcessor([culinaryCatalog, basicCatalog]);
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
    } catch (err) {
      console.warn('Formal Culinary Catalog processor fallback triggered:', err);
      setCatalogSurfaces([]);
    }

    return () => {
      createdSub.unsubscribe();
      deletedSub.unsubscribe();
      actionSubs.forEach((sub) => sub.unsubscribe());
    };
  }, [messages, onAction]);

  // If official A2UI MessageProcessor successfully validated & built the formal culinaryCatalog surface(s), render via A2uiSurface
  if (catalogSurfaces.length > 0) {
    return (
      <div className="a2ui-surface w-full space-y-4">
        {catalogSurfaces.map((surf) => (
          <A2uiSurface key={surf.id} surface={surf as any} />
        ))}
      </div>
    );
  }

  // Fallback: render directly from parsed SurfaceState if messages were absent or failed schema validation
  if (!surface || !surface.rootId || !surface.components[surface.rootId]) {
    return null;
  }

  const resolveValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value.literalString !== undefined) return value.literalString;
    if (value.literalNumber !== undefined) return String(value.literalNumber);
    if (value.literalBoolean !== undefined) return String(value.literalBoolean);
    const pathRef = value['@path'] ?? value.path;
    if (pathRef) {
      const cleanPath = String(pathRef).replace(/^\//, '');
      if (surface.dataModel[cleanPath] !== undefined) {
        return String(surface.dataModel[cleanPath]);
      }
      if (surface.dataModel[pathRef] !== undefined) {
        return String(surface.dataModel[pathRef]);
      }
    }
    return '';
  };

  const getComponentInfo = (item: A2UIComponent): { type: string; props: any } => {
    if (!item) return { type: '', props: {} };
    if (typeof item.component === 'string') {
      return { type: item.component, props: item };
    }
    if (typeof item.component === 'object' && item.component !== null) {
      const type = Object.keys(item.component)[0] || '';
      return { type, props: item.component[type] || {} };
    }
    return { type: '', props: {} };
  };

  const getChildIds = (props: any): string[] => {
    if (Array.isArray(props.children)) {
      return props.children.map(String);
    }
    if (props.children && Array.isArray(props.children.explicitList)) {
      return props.children.explicitList.map(String);
    }
    return [];
  };

  const renderComponent = (componentId: string): ReactNode => {
    const item: A2UIComponent = surface.components[componentId];
    if (!item) return null;

    const { type, props } = getComponentInfo(item);

    // Text Primitive
    if (type === 'Text') {
      const textVal = resolveValue(props.text ?? props.value);
      const variant = props.variant || props.usageHint;
      switch (variant) {
        case 'h1':
          return (
            <h1 key={componentId} className="text-xl font-bold text-slate-900 tracking-tight my-1">
              {textVal}
            </h1>
          );
        case 'h2':
          return (
            <h2 key={componentId} className="text-base font-semibold text-slate-800 tracking-tight my-0.5">
              {textVal}
            </h2>
          );
        case 'h3':
          return (
            <h3 key={componentId} className="text-sm font-medium text-slate-700">
              {textVal}
            </h3>
          );
        case 'badge':
          return (
            <span
              key={componentId}
              className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
            >
              {textVal}
            </span>
          );
        case 'caption':
          return (
            <p key={componentId} className="text-xs text-slate-500 leading-relaxed">
              {textVal}
            </p>
          );
        default:
          return (
            <MarkdownRenderer key={componentId} content={textVal} />
          );
      }
    }

    // Card Primitive
    if (type === 'Card') {
      const childId = props.child;
      const childrenIds = getChildIds(props);
      return (
        <DefaultCard key={componentId}>
          {childId ? renderComponent(childId) : null}
          {childrenIds.map((cid) => renderComponent(cid))}
        </DefaultCard>
      );
    }

    // Column Primitive
    if (type === 'Column') {
      const childrenIds = getChildIds(props);
      const stepItems: { id: string; stepData: any }[] = [];
      const nonStepIds: string[] = [];

      for (const id of childrenIds) {
        const comp = surface.components[id];
        if (comp) {
          const compInfo = getComponentInfo(comp);
          if (compInfo.type === 'InstructionStepCard' || compInfo.type === 'StepCard') {
            stepItems.push({
              id,
              stepData: compInfo.props,
            });
            continue;
          }
        }
        nonStepIds.push(id);
      }

      // If there are multiple step cards, render non-step children first, then GuidedCookingCard
      if (stepItems.length > 1) {
        const dishName = resolveValue(stepItems[0]?.stepData?.dish);
        const mappedSteps = stepItems.map((item, idx) => ({
          step: resolveValue(item.stepData.step) || idx + 1,
          title: resolveValue(item.stepData.title),
          instruction: resolveValue(item.stepData.instruction || item.stepData.text || item.stepData.description),
          duration: resolveValue(item.stepData.duration),
          timerMinutes: resolveValue(item.stepData.timerMinutes || item.stepData.minutes),
          dish: resolveValue(item.stepData.dish),
          tip: resolveValue(item.stepData.tip),
        }));

        return (
          <div key={componentId} className="flex flex-col gap-2.5 w-full">
            {nonStepIds.map((childId) => renderComponent(childId))}
            <GuidedCookingCard dish={dishName} steps={mappedSteps} onAction={onAction} />
          </div>
        );
      }

      return (
        <div key={componentId} className="flex flex-col gap-2.5 w-full">
          {childrenIds.map((childId) => renderComponent(childId))}
        </div>
      );
    }

    // Row Primitive
    if (type === 'Row') {
      const childrenIds = getChildIds(props);
      const justifyAttr = props.justify || props.distribution;
      const justify =
        justifyAttr === 'spaceBetween' || justifyAttr === 'space-between'
          ? 'justify-between'
          : justifyAttr === 'center'
          ? 'justify-center'
          : justifyAttr === 'end'
          ? 'justify-end'
          : 'justify-start';

      return (
        <div
          key={componentId}
          className={`flex flex-row items-center gap-2.5 ${justify} flex-wrap w-full`}
        >
          {childrenIds.map((childId) => renderComponent(childId))}
        </div>
      );
    }

    // Button Primitive
    if (type === 'Button') {
      const childId = props.child;
      const label = childId ? renderComponent(childId) : resolveValue(props.label || props.text);
      const action = props.action;
      const isBorderless = props.variant === 'borderless';
      return (
        <button
          key={componentId}
          onClick={() => {
            if (action) {
              const callType =
                action.event?.name ||
                action.name ||
                action['@call'] ||
                action.call ||
                action.callAgentFunction?.function ||
                action.type ||
                '';
              const params =
                action.event?.context ||
                action.context ||
                action.args ||
                action.callAgentFunction?.arguments ||
                action.parameters ||
                {};
              onAction?.({ type: callType, parameters: params, context: params });
            }
          }}
          className={
            isBorderless
              ? 'inline-flex items-center text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition'
              : 'inline-flex items-center justify-center px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 rounded-xl border border-slate-200 shadow-sm transition-all focus:outline-none'
          }
        >
          {label}
        </button>
      );
    }

    // Icon Primitive
    if (type === 'Icon') {
      const iconName = resolveValue(props.name).toLowerCase();
      const iconProps = { size: props.size || 16, className: 'inline-block text-amber-500' };
      if (iconName.includes('clock') || iconName.includes('schedule')) {
        return <Clock key={componentId} {...iconProps} />;
      }
      if (iconName.includes('star')) {
        return <Star key={componentId} {...iconProps} />;
      }
      if (iconName.includes('flame') || iconName.includes('spicy')) {
        return <Flame key={componentId} {...iconProps} />;
      }
      return <ChefHat key={componentId} {...iconProps} />;
    }

    // Image Primitive
    if (type === 'Image') {
      return (
        <img
          key={componentId}
          src={resolveValue(props.url || props.src)}
          alt={resolveValue(props.alt) || 'Recipe'}
          className="rounded-xl object-cover max-h-52 w-full mb-2 border border-slate-100"
        />
      );
    }

    // Divider Primitive
    if (type === 'Divider') {
      return <hr key={componentId} className="my-2 border-slate-100" />;
    }

    // List Primitive
    if (type === 'List') {
      const childrenIds = getChildIds(props);
      return (
        <ul key={componentId} className="list-disc pl-5 text-xs text-slate-600 space-y-1">
          {childrenIds.map((childId) => (
            <li key={childId}>{renderComponent(childId)}</li>
          ))}
        </ul>
      );
    }

    // Custom Component: RecipeSummaryCard
    if (type === 'RecipeSummaryCard') {
      return (
        <RecipeSummaryCard
          key={componentId}
          id={resolveValue(props.recipeId || props.id) || componentId}
          name={resolveValue(props.name)}
          description={resolveValue(props.description)}
          cookTime={resolveValue(props.cookTime)}
          prepTime={resolveValue(props.prepTime)}
          difficulty={resolveValue(props.difficulty)}
          calories={resolveValue(props.calories)}
          cuisine={resolveValue(props.cuisine)}
          badge={resolveValue(props.badge)}
          imageUrl={resolveValue(props.imageUrl)}
          onAction={onAction}
        />
      );
    }

    // Custom Component: RecipeDetailCard
    if (type === 'RecipeDetailCard') {
      let ingList: string[] = [];
      if (Array.isArray(props.ingredients)) {
        ingList = props.ingredients.map((ing: any) => resolveValue(ing));
      } else if (props.ingredients && 'path' in props.ingredients && surface.dataModel[props.ingredients.path]) {
        const fromModel = surface.dataModel[props.ingredients.path];
        ingList = Array.isArray(fromModel) ? fromModel.map(String) : [];
      }

      return (
        <RecipeDetailCard
          key={componentId}
          id={resolveValue(props.recipeId || props.id) || componentId}
          name={resolveValue(props.name)}
          description={resolveValue(props.description)}
          prepTime={resolveValue(props.prepTime)}
          cookTime={resolveValue(props.cookTime)}
          servings={resolveValue(props.servings)}
          difficulty={resolveValue(props.difficulty)}
          calories={resolveValue(props.calories)}
          cuisine={resolveValue(props.cuisine)}
          badge={resolveValue(props.badge)}
          imageUrl={resolveValue(props.imageUrl)}
          ingredients={ingList}
          showCookButton={props.showCookButton ?? true}
          onAction={onAction}
        />
      );
    }

    // Custom Component: CookingTimer
    if (type === 'CookingTimer') {
      return (
        <CookingTimer
          key={componentId}
          minutes={resolveValue(props.minutes) || 5}
          label={resolveValue(props.label)}
          dish={resolveValue(props.dish)}
        />
      );
    }

    // Custom Component: InstructionStepCard
    if (type === 'InstructionStepCard' || type === 'StepCard') {
      return (
        <InstructionStepCard
          key={componentId}
          step={resolveValue(props.step)}
          totalSteps={resolveValue(props.totalSteps)}
          title={resolveValue(props.title)}
          instruction={resolveValue(props.instruction || props.text || props.description)}
          duration={resolveValue(props.duration)}
          timerMinutes={resolveValue(props.timerMinutes || props.minutes)}
          dish={resolveValue(props.dish)}
          tip={resolveValue(props.tip)}
          isLastStep={Boolean(props.isLastStep)}
          onAction={onAction}
        />
      );
    }

    // Custom Component: GuidedCookingCard
    if (type === 'GuidedCookingCard') {
      return (
        <GuidedCookingCard
          key={componentId}
          dish={resolveValue(props.dish || props.recipeName)}
          steps={props.steps || []}
          onAction={onAction}
        />
      );
    }

    // Custom Component: DefaultCard
    if (type === 'DefaultCard') {
      return (
        <DefaultCard
          key={componentId}
          title={resolveValue(props.title)}
          text={resolveValue(props.text || props.content || props.body)}
        />
      );
    }

    // Fallback if no specialized card matched: render default card
    const fallbackText =
      resolveValue(props.text) ||
      resolveValue(props.content) ||
      resolveValue(props.message) ||
      resolveValue(props.description);

    if (fallbackText) {
      return (
        <DefaultCard
          key={componentId}
          title={resolveValue(props.title)}
          text={fallbackText}
        />
      );
    }

    return null;
  };

  return (
    <div className="a2ui-surface w-full">
      {renderComponent(surface.rootId)}
    </div>
  );
};
```

---

## 9. Test the Three-Stage Culinary Flow

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

## 10. Simulated Remote Food Photography & ADK Custom Services

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

## 11. React Client Companion in Google Cloud Shell

A complete React application is provided in the `frontend/` directory to demonstrate client-side A2UI rendering with modern styling and responsive interactions.

### 11.1 Multi-Port Architecture in Cloud Shell
Inside Cloud Shell, we run two simultaneous servers:
- **ADK Backend Server**: Port `8080`
- **React Frontend Dev Server (Vite)**: Port `3000`

### 11.2 Configure Cloud Shell Vite Proxy (Avoid CORS & Auth Redirects)

Cloud Shell secures each Web Preview port (`3000-...cloudshell.dev` and `8080-...cloudshell.dev`) behind separate Google Cloud authentication session cookies. If the browser on port 3000 attempts to `fetch()` directly to port 8080, Cloud Shell attempts an authentication cookie hop (`/_cloudshell/forwardAuthCookie`), which the browser blocks under standard cross-origin (CORS) security rules.

To resolve this seamlessly, configure Vite's dev server inside `frontend/vite.config.ts` to proxy all agent API calls locally:

```typescript
// frontend/vite.config.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/list-apps': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      '/apps': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      '/run': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      '/images': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
});
```

> [!IMPORTANT]
> **Remove or Clear `frontend/.env.local`**: If you previously created `frontend/.env.local` pointing to an `https://8080-cs-...` URL or `http://127.0.0.1:8080`, remove it so the client makes relative same-origin requests:
> ```bash
> rm -f ~/a2uirecipe/frontend/.env.local
> ```
> With the Vite proxy configured and relative URLs, all requests hit `https://3000-...` (same origin) and Vite proxies them internally over `127.0.0.1:8080` without cross-origin redirects!

### 11.3 Run the Servers in Google Cloud Shell
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

### 11.4 Access the React Frontend via Web Preview
1. Click the **Web Preview** icon (`>_` with an eye) in the top-right toolbar of Cloud Shell.
2. Select **Change port**.
3. Type `3000` and click **Change and Preview**.
4. The React Culinary Recipe Assistant application opens in a new tab!
5. Test sending `"What can I make for dinner tonight?"` and interact with the custom discovery cards, details, and guided cooking stepper.

---

## 12. Production Deployment on Google Cloud

When you are ready to deploy your A2UI Recipe Assistant to production on Google Cloud:

### 12.1 Deploying the ADK Backend to Cloud Run
Containerize the ADK agent and deploy with serverless auto-scaling on **Cloud Run**:
```bash
# Build and deploy container directly to Cloud Run
gcloud run deploy recipe-assistant-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars RECIPE_STAGE=3,GEMINI_API_KEY=${GEMINI_API_KEY}
```

### 12.2 Deploying the Frontend to Firebase App Hosting / Cloud Storage
Build the React production bundle:
```bash
cd frontend
npm run build
```
Deploy the `dist/` directory to **Firebase Hosting** or **Cloud Storage + Cloud CDN** for global low-latency distribution.

---

## 13. Summary & Checklist

Congratulations! You built and ran a full-stack, AI-powered interactive recipe assistant inside **Google Cloud Shell** using **ADK** and **A2UI**.

- [x] **Cloud Shell Environment**: Configured Python venv, Node.js, and Google AI Studio credentials.
- [x] **Stage 1**: Created a grounded agent retrieving recipe data without hallucination.
- [x] **Stage 2**: Used `a2ui-agent-sdk` to generate prompts guiding Gemini to output structured A2UI v1.0 JSON.
- [x] **Stage 3**: Rendered the Default A2UI Catalog on the client using `@a2ui/react` and `@a2ui/web_core`, styled with CSS custom properties.
- [x] **Stage 4**: Authored a formal Custom Culinary Catalog (`recipe_agent/catalog.py` & `culinaryCatalog.tsx`) with `RecipeSummaryCard`, `RecipeDetailCard`, `GuidedCookingCard`, and `DefaultCard`.
- [x] **Single-Card Guided Stepper**: Packaged all recipe steps into 1 card with zero-latency local Next/Previous buttons and live countdown timers.
- [x] **Web Preview**: Accessed and tested both port 8080 (ADK) and port 3000 (React) using Cloud Shell's built-in Web Preview.
- [x] **Cloud Native**: Documented serverless deployment paths using Cloud Run and Firebase Hosting.
