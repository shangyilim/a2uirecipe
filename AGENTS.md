# AGENTS.md

This document describes the architecture, design decisions, and recent changes across the Python ADK agent backend (`recipe_agent/`) and React client (`frontend/`) in this repository so other agents and contributors can work on it safely without breaking invariants.

---

## 1. Repository Overview & Branch Structure

This repo is an interactive **ADK + A2UI v1.0 Culinary Recipe Assistant** codelab structured in progressive stages:
- Branches: `stage0`, `stage1`, `stage2`, `stage3`, `final` (active implementation on `final`).
- Documentation: [`CODELAB.md`](CODELAB.md) (local setup) and [`CODELAB_GCP_CLOUDSHELL.md`](CODELAB_GCP_CLOUDSHELL.md) (Google Cloud Shell workflow). **Keep both codelab guides in sync** whenever updating code snippets, instructions, or architecture notes across Stages 1–4.

Progressive stage architecture:
1. **Stage 1**: Plain-text ADK agent (`get_recipes` tool).
2. **Stage 2**: Structured, backend-validated **A2UI v1.0** JSON via `A2uiRequestProcessor`, `A2uiInstruction`, and `SendA2uiToClientToolset` (`BasicCatalog`).
3. **Stage 3**: Client rendering of `BasicCatalog` payloads using `@a2ui/react` and `@a2ui/web_core` (`DefaultA2UIRenderer.tsx`).
4. **Stage 4**: Formal Custom **Culinary Catalog** across backend Pydantic (`recipe_agent/catalog.py`) and frontend Zod + React implementations (`frontend/src/catalog/culinaryCatalog.tsx`, `A2UIRenderer.tsx`).

---

## 2. Backend Architecture (`recipe_agent/`)

### `recipe_agent/catalog.py`
Defines the formal A2UI v1.0 custom catalog extending the standard `BasicCatalog`:
- Catalog ID: `CULINARY_CATALOG_ID = "https://a2ui.org/specification/v1_0/catalogs/culinary/catalog.json"`.
- Custom Pydantic `ComponentCommon` models:
  - `RecipeSummaryCardComponent` (`RecipeSummaryCard`)
  - `RecipeDetailCardComponent` (`RecipeDetailCard`)
  - `GuidedCookingCardComponent` (`GuidedCookingCard`, containing `List[GuidedStep]` with optional `timerMinutes` and `duration`)
  - `DefaultCardComponent` (`DefaultCard`, Markdown body text)
- `create_culinary_catalog()` builds the `Catalog` with `ProtocolVersion.V1_0`, `components=list(BASIC_COMPONENTS) + CULINARY_COMPONENTS`, and `create_basic_catalog_functions()`.

### `recipe_agent/agent.py`
- **Model**: `Gemini(model="gemini-3.5-flash-lite", retry_options=types.HttpRetryOptions(attempts=5))`.
- **Processor**:
  ```python
  processor = A2uiRequestProcessor(
      [create_culinary_catalog()],
      format_factory=DirectJsonFormatFactory(),
  )
  ```
  > **Important:** Do **not** bind a `RendererState` instance to this module-level `processor` because it is shared across sessions/requests.
- **Instructions & Schema Validation (`a2ui.adk`)**:
  - `A2uiInstruction` wraps `ROLE_DESCRIPTION`, `WORKFLOW_DESCRIPTION`, and `UI_DESCRIPTION` with `a2ui_processor=processor`.
  - `a2ui_toolset = SendA2uiToClientToolset(a2ui_enabled=True, a2ui_processor=processor)` exposes the `send_a2ui_json_to_client` tool.
  - `root_agent` registers `tools=[get_recipes, a2ui_toolset]`.
  - **How schema adherence works**: When Gemini calls `send_a2ui_json_to_client`, `a2ui-adk` validates payloads on the backend via `validate_payload`:
    - Invalid payloads (e.g., hyphenated IDs, legacy `usageHint`, bad action shapes) return `{"error": "..."}` so the LLM self-corrects before finishing.
    - Valid payloads set `skip_summarization = True` and return `{"validated_a2ui_json": [...]}` in the tool's `functionResponse`.
  - Prompt examples use valid UAX #31 identifiers (e.g., `info_card_1`, `recipe_summary_1`; never hyphens) and A2UI v1.0 properties. No `show_raw_json` callback or `<a2ui-json>` prompt wrapper is used.

### `recipe_agent/recipes.py`, `recipe_agent/services.py`, and `services.py`
- `get_recipes()` returns curated dishes (`pasta-carbonara`, `thai-basil-chicken`, `mediterranean-quinoa-salad`, `creamy-tuscan-salmon`, `berry-chia-parfait`).
- All `image_url` values are **relative paths** (`/images/carbonara.jpg`, `/images/pad_krapow.jpg`, `/images/quinoa_bowl.jpg`, `/images/tuscan_salmon.jpg`, `/images/berry_parfait.jpg`) so images resolve cleanly across both direct `adk web` (`:8080`) and the Vite dev proxy (`:3000`).
- `recipe_agent/__init__.py` imports `recipe_agent/services.py`, and root `services.py` delegates to `recipe_agent.services`, patching `adk_api_server.ApiServer.get_fast_api_app` once to mount `/images` as FastAPI `StaticFiles`.

---

## 3. Frontend Architecture (`frontend/`)

### Stack & Dev Proxy (`frontend/package.json`, `frontend/vite.config.ts`)
- Core packages: `react` `^18.3.1`, `@a2ui/react` `^0.15.0`, `@a2ui/web_core` `^0.15.0`, `zod` `^3.25.76`, `marked` `^18.1.1`, `lucide-react` `^1.16.0`, Tailwind CSS `^3.4.14`, Vite `^5.4.10`.
- `vite.config.ts` serves on port `3000` and proxies `/list-apps`, `/apps`, `/run`, and `/images` to `http://127.0.0.1:8080`.

### Strictly A2UI v1.0 Protocol (`types/a2ui.ts`, `adkService.ts`, `A2UIRenderer.tsx`)
All **v0.8 and v0.9 legacy code has been removed** from `frontend/src/`:
- **`frontend/src/types/a2ui.ts`**:
  - Keeps only `A2UI_MIME_TYPE = 'application/a2ui+json'` and `A2UIVersion = '1.0' | 'v1.0'`.
  - Removed: `DEPRECATED_A2UI_MIME_TYPE`, `v0.9`/`v0.9.1` strings, `CreateSurfaceMessage.theme`, `literalString`/`literalNumber`/`literalBoolean`, v0.8 `BeginRenderingMessage`/`SurfaceUpdateMessage`/`DataModelUpdateMessage`, and nested object `component: Record<string, any>`.
- **`frontend/src/services/adkService.ts`**:
  - `initSession()` discovers the app via `GET /list-apps` and creates a session via `POST /apps/{appName}/users/demo_user/sessions`.
  - `sendMessage()` posts to `POST /run` and passes returned ADK events to `parseEvents(events)`.
  - `parseEvents()` inspects each event part for `part.functionResponse` (and `part.function_response`) where `name === 'send_a2ui_json_to_client'` and `Array.isArray(response?.validated_a2ui_json)`. It feeds those backend-validated messages into `collectedRawMessages` (`rawMessages`) and `applyMessages(surface, validated)`. Retains `<a2ui-json>` / raw JSON extraction only as a text fallback.
  - `applyMessages()` handles strictly v1.0 messages: `createSurface` (including embedded `components` and `dataModel`), `deleteSurface`, `updateComponents`, `updateDataModel`, plus direct `components` array fallback.

### Formal Frontend Catalog (`frontend/src/catalog/culinaryCatalog.tsx`)
- Exports `CULINARY_CATALOG_ID` matching `recipe_agent/catalog.py`.
- Defines Zod component APIs (`RecipeSummaryCardApi`, `RecipeDetailCardApi`, `GuidedCookingCardApi`, `DefaultCardApi`) matching the Python schemas.
- Wraps custom React components (`RecipeSummaryCard`, `RecipeDetailCard`, `GuidedCookingCard`, `DefaultCard`) via `createComponentImplementation(...)` and forwards user actions through `context.dispatchAction({ event: { name, context } })`.
- Derives `culinaryCatalog` using `basicCatalog.derive({ catalogId: CULINARY_CATALOG_ID, components: [...basicCatalog.components.values(), ...] })`.

### Dual Renderer Modes & Strict Catalog Isolation (`App.tsx`, `A2UIRenderer.tsx`, `DefaultA2UIRenderer.tsx`)
`App.tsx` includes a header toggle (`rendererMode`: `'custom'` vs `'default'`):

1. **Custom Catalog Mode — `frontend/src/components/A2UIRenderer.tsx`**
   - Calls `injectBasicCatalogStyles()` and instantiates `new MessageProcessor([culinaryCatalog])` (**does NOT include `basicCatalog`**).
   - **Strict rejection on catalog mismatch**: If `messages` contains `createSurface.catalogId === basicCatalog.id`, or if `MessageProcessor([culinaryCatalog])` throws/fails to build a surface, `A2UIRenderer` sets `catalogError` and renders a red **`Catalog Mismatch Error`** alert (`role="alert"`) instead of falling back to `BasicCatalog` primitives.
   - Because backend `SendA2uiToClientToolset` guarantees v1.0 compliance and `culinaryCatalog` derives from `basicCatalog` for standard layout wrappers (`Column`, `Row`, `Text`, `Button`, etc.), no client-side schema normalization or manual `renderComponent` fallback exists here.

2. **Default Renderer Mode — `frontend/src/components/DefaultA2UIRenderer.tsx`**
   - Strictly Stage 3 (`BasicCatalog` only).
   - Calls `injectBasicCatalogStyles()` and uses `new MessageProcessor([basicCatalog])` + `<A2uiSurface />` styled via `--a2ui-*` CSS custom properties in `frontend/src/index.css` (`.a2ui-default-surface`).
   - Passes backend-validated `messages` directly with **zero client-side adapters or schema normalization** (`adaptCustomCatalogIfNeeded` and `customToBasicAdapter.ts` were intentionally removed).
   - If toggled onto a Stage 4 custom-catalog payload (`surfaces.length === 0`), displays an amber notice telling the user to switch the header toggle back to **Custom Catalog**.

### Custom Domain Components (`frontend/src/components/`) & Action Loop (`App.tsx`)
- `RecipeSummaryCard.tsx`: Discovery card with dish image, timing/calorie metadata, and **View** (`view_recipe`) / **Let's Cook This** (`start_cooking`) buttons.
- `RecipeDetailCard.tsx`: Full ingredients list + cook button.
- `GuidedCookingCard.tsx` + `CookingTimer.tsx`: Bundles all cooking steps into one card with client-side **Next** / **Previous** pagination (zero extra LLM turns) and interactive countdown timers when `timerMinutes` is present. Uses `finish_cooking` at completion.
- `DefaultCard.tsx` + `MarkdownRenderer.tsx`: Markdown card using `marked`.
- `InstructionStepCard.tsx` + `InstructionStepFlow.tsx`: Unused step-card components left in `components/` from earlier standalone step rendering (replaced by `GuidedCookingCard.tsx`).
- `App.tsx` (`handleAction`): Converts `view_recipe`, `start_cooking`, and `finish_cooking` action events into follow-up ADK prompts (`next_step` is a no-op).

---

## 4. Key Invariants & Guidelines for Agents

1. **Keep schema validation on the backend**: Use `SendA2uiToClientToolset` in `recipe_agent/agent.py`. Do not reintroduce client-side A2UI payload patching (`usageHint -> variant`, hyphen sanitization, etc.) in `DefaultA2UIRenderer.tsx` or `A2UIRenderer.tsx`.
2. **Keep v1.0 strict**: Do not add `v0.8` (`beginRendering`, `surfaceUpdate`, `dataModelUpdate`, nested component dicts, `explicitList`, `literalString`) or `v0.9` (`usageHint`, `distribution`, `theme`, `0.9.x` versions) compatibility code back into `frontend/src/`.
3. **Preserve strict catalog separation**:
   - `A2UIRenderer.tsx` must register `[culinaryCatalog]` only and surface an error if the agent returns `basicCatalog`.
   - `DefaultA2UIRenderer.tsx` must register `[basicCatalog]` only and stay free of Stage 4 custom component expansion adapters.
4. **Match Python & Zod catalogs**: Any schema change in `recipe_agent/catalog.py` must be mirrored in `frontend/src/catalog/culinaryCatalog.tsx` (using the same `CULINARY_CATALOG_ID` and field names) and reflected in `recipe_agent/agent.py` prompt examples.
5. **Preserve relative `/images/...` URLs** in `recipe_agent/recipes.py` and Vite's `/images` proxy in `frontend/vite.config.ts`.

---

## 5. Development & Verification Commands

- **Run ADK Backend (port 8080)**:
  ```bash
  .venv/bin/adk web --port 8080 --allow_origins "*" --reload_agents
  ```
- **Verify Backend Imports & Toolset**:
  ```bash
  .venv/bin/python3 -c "import recipe_agent.agent as a; print(len(a.root_agent.tools))"
  ```
- **Run React Frontend Dev Server (port 3000)**:
  ```bash
  npm run dev --prefix frontend
  ```
- **Type-check & Build Frontend**:
  ```bash
  npm run build --prefix frontend
  ```
