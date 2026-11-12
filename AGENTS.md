# AGENTS.md

This document describes the architecture, design decisions (and *why* things are built this way), and key invariants across the Python ADK agent backend (`recipe_agent/`) and React client (`frontend/`) so contributors and agents can modify the repo safely.

---

## 1. Repository Overview & Branch Structure

This repo is an interactive **ADK + A2UI v1.0 Culinary Recipe Assistant** codelab structured in progressive stages:
- Branches: `stage0`, `stage1`, `stage2`, `stage3`, `final` (active implementation on `final`).
- Documentation: [`CODELAB.md`](CODELAB.md) (local setup) and [`CODELAB_GCP_CLOUDSHELL.md`](CODELAB_GCP_CLOUDSHELL.md) (Google Cloud Shell workflow), each organized into Sections 1–11 (inline `npm install` + `npm run dev` + `--reload_agents` startup in Section 7.2, `stage1`/`stage2`/`stage3` catch-up checkpoints, and optional Section 10 production sections). **Keep both codelab guides in sync** whenever updating code snippets, instructions, or architecture notes across Stages 1–4.

Progressive stage architecture:
1. **Stage 1**: Plain-text ADK agent (`get_recipes` tool).
2. **Stage 2**: Structured, backend-validated **A2UI v1.0** JSON via `A2uiRequestProcessor`, `A2uiInstruction`, and `SendA2uiToClientToolset` (`BasicCatalog`).
3. **Stage 3**: Client rendering of `BasicCatalog` payloads using `@a2ui/react` and `@a2ui/web_core` (`DefaultA2UIRenderer.tsx`).
4. **Stage 4**: Formal Custom **Culinary Catalog** across backend Pydantic (`recipe_agent/catalog.py`) and frontend Zod + React implementations (`frontend/src/catalog/culinaryCatalog.tsx`, `A2UIRenderer.tsx`).

### Why this stage progression & codelab scope
- **Default Renderer (Stage 3) before Custom Catalog authoring (Stage 4):** Learners first experience zero-JSX rendering with standard `BasicCatalog` primitives (`DefaultA2UIRenderer.tsx`), observe their UX limits for culinary workflows (no timers, no local step carousel), and then see *why* authoring a custom catalog in Stage 4 is worth the extra contract.
- **Pre-configured plumbing omitted from codelab steps:** Infrastructure files (`services.py`, `recipe_agent/services.py`, `frontend/vite.config.ts`, `frontend/package.json`, `DefaultA2UIRenderer.tsx`) come pre-configured so the codelab stays focused on ADK + A2UI rather than proxy or static-asset boilerplate.

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

**Why extend `BASIC_COMPONENTS` instead of creating a standalone catalog:** Extending `BASIC_COMPONENTS` lets the agent freely mix standard layout containers (`Column`, `Row`, `Text`, `Button`) with domain cards in the same surface without re-implementing layout primitives.

### `recipe_agent/agent.py`
- **Model**: `Gemini(model="gemini-3.5-flash-lite", retry_options=types.HttpRetryOptions(attempts=5))`.
- **Processors (`processor` vs. `create_turn_processor`)**:
  ```python
  catalogs = [create_culinary_catalog()]

  # Stateless processor for A2uiInstruction system prompt generation
  processor = A2uiRequestProcessor(
      catalogs,
      format_factory=DirectJsonFormatFactory(),
  )

  # Per-call processor with a fresh RendererState for SendA2uiToClientToolset
  def create_turn_processor(_ctx=None) -> A2uiRequestProcessor:
      return A2uiRequestProcessor(
          catalogs,
          format_factory=DirectJsonFormatFactory(),
          state=RendererState(catalogs),
      )
  ```
- **Instructions & Schema Validation (`a2ui.adk`)**:
  - `A2uiInstruction` wraps `ROLE_DESCRIPTION`, `WORKFLOW_DESCRIPTION`, and `UI_DESCRIPTION` with `a2ui_processor=processor`.
  - `a2ui_toolset = SendA2uiToClientToolset(a2ui_enabled=True, a2ui_processor=create_turn_processor)` exposes the `send_a2ui_json_to_client` tool.
  - `root_agent` registers `tools=[get_recipes, a2ui_toolset]`.

#### Key Backend Design Decisions ("Why")
1. **Why `SendA2uiToClientToolset` is used from Stage 2 onward (replacing `<a2ui-json>` text tags + `show_raw_json`):**
   `A2uiInstruction` alone only places schema instructions in the prompt—it does not validate model output, so Gemini can still emit `v0.9` fields (`usageHint`), hyphenated IDs, or malformed actions. `SendA2uiToClientToolset` runs backend schema validation (`validate_payload` / `RendererState`) on every payload, returns `{"error": "..."}` so Gemini self-corrects before replying, and sets `skip_summarization = True` to emit clean `{"validated_a2ui_json": [...]}` tool responses. Teaching it in Stage 2 avoids teaching throwaway `<a2ui-json>` parsing only to delete it in Stage 3.
2. **Why `create_turn_processor` uses a fresh `RendererState(catalogs)` per tool call (and why `processor` stays stateless):**
   - *Why not bind `RendererState` on module-level `processor`?* A single module-level `RendererState` would leak created `surfaceId`s across users/sessions and throw `"Surface ... already exists"`.
   - *Why not leave `SendA2uiToClientToolset` without any `RendererState`?* Without `RendererState`, `validate_payload` permits `updateComponents` without `createSurface` (assuming an earlier turn created the surface). Because our React chat UI gives each message bubble its own isolated `MessageProcessor`, an update-only Turn 2 response (e.g., updating `"recipe_catalog_surface"`) crashes on the client with `Surface not found for message: ...`. Giving each tool call an isolated `RendererState(catalogs)` via `create_turn_processor` rejects orphan `updateComponents` on the backend so Gemini self-corrects to emit a self-contained `createSurface` every turn.
   - *Why separate cards per turn instead of one persistent canvas surface?* In a chat-thread UI, users scroll back to compare earlier recipe cards after opening details or cooking steps; updating a single persistent surface in place would overwrite earlier bubbles.
3. **Why `UI_DESCRIPTION` stays minimal (no inline JSON schema examples):**
   `A2uiRequestProcessor` + `A2uiInstruction` automatically compile and inject ~44.8 KB of JSON Schema definitions and `Field(description=...)` docs directly from `recipe_agent/catalog.py` (and `SendA2uiToClientToolset` detects `processor.prompt_snippet` so it does not duplicate instructions). Duplicating 100+ lines of JSON examples in `UI_DESCRIPTION` wasted tokens and drifted out of sync with `catalog.py`. `UI_DESCRIPTION` therefore only specifies app-level rules not derivable from the schema: per-turn `createSurface` with unique `surfaceId`, `CULINARY_CATALOG_ID`, UAX #31 IDs, preferring custom cards, and `App.tsx`'s expected button action event names (`view_recipe`, `start_cooking`).

### `recipe_agent/recipes.py`, `recipe_agent/services.py`, and `services.py`
- `get_recipes()` returns curated dishes (`pasta-carbonara`, `thai-basil-chicken`, `mediterranean-quinoa-salad`, `creamy-tuscan-salmon`, `berry-chia-parfait`).
- All `image_url` values are **relative paths** (`/images/carbonara.jpg`, `/images/pad_krapow.jpg`, `/images/quinoa_bowl.jpg`, `/images/tuscan_salmon.jpg`, `/images/berry_parfait.jpg`).
- `recipe_agent/__init__.py` imports `recipe_agent/services.py`, and root `services.py` delegates to `recipe_agent.services`, patching `adk_api_server.ApiServer.get_fast_api_app` once to mount `/images` as FastAPI `StaticFiles`.

**Why relative `/images/...` URLs instead of `http://127.0.0.1:8080/images/...`:** Hardcoded localhost URLs break in Google Cloud Shell Web Preview (where port `3000` and port `8080` sit behind separate `cloudshell.dev` origins and auth cookies, triggering CORS/cookie-hop blocks). Relative `/images/...` paths resolve cleanly both via Vite's `/images` proxy (`:3000`) and directly via ADK's static mount (`:8080`).

---

## 3. Frontend Architecture (`frontend/`)

### Stack & Dev Proxy (`frontend/package.json`, `frontend/vite.config.ts`)
- Core packages: `react` `^18.3.1`, `@a2ui/react` `^0.15.0`, `@a2ui/web_core` `^0.15.0`, `zod` `^3.25.76`, `marked` `^18.1.1`, `lucide-react` `^1.16.0`, Tailwind CSS `^3.4.14`, Vite `^5.4.10`.
- `vite.config.ts` serves on port `3000` and proxies `/list-apps`, `/apps`, `/run`, and `/images` to `http://127.0.0.1:8080` (same-origin proxy avoids Cloud Shell CORS and auth-cookie redirects).

### Strictly A2UI v1.0 Protocol (`types/a2ui.ts`, `adkService.ts`, `A2UIRenderer.tsx`)
All **v0.8 and v0.9 legacy code has been removed** from `frontend/src/`.

**Why v0.8/v0.9 legacy branches and client schema normalizers were removed:** Backend `SendA2uiToClientToolset` guarantees strict A2UI v1.0 payloads (`version: "1.0"`, flat `component` string discriminator, `Text.variant: "caption" | "body"`, `Row.justify`, `Image.url`, `action.event` / `action.functionCall`). Keeping client-side `normalizeForBasicCatalog` / `prepareMessageForCatalog` / `v0.8` `beginRendering` / `v0.9` `usageHint` shims masked backend schema issues and added dead maintenance burden.

- **`frontend/src/types/a2ui.ts`**:
  - Keeps only `A2UI_MIME_TYPE = 'application/a2ui+json'` and `A2UIVersion = '1.0' | 'v1.0'`.
  - Removed: `DEPRECATED_A2UI_MIME_TYPE`, `v0.9`/`v0.9.1` strings, `CreateSurfaceMessage.theme`, `literalString`/`literalNumber`/`literalBoolean`, v0.8 `BeginRenderingMessage`/`SurfaceUpdateMessage`/`DataModelUpdateMessage`, and nested object `component: Record<string, any>`.
- **`frontend/src/services/adkService.ts`**:
  - `initSession()` discovers the app via `GET /list-apps` and creates a session via `POST /apps/{appName}/users/demo_user/sessions`.
  - `sendMessage()` posts to `POST /run` and passes returned ADK events to `parseEvents(events)`.
  - `parseEvents()` extracts `validated_a2ui_json` from `part.functionResponse` (and `part.function_response`) for `send_a2ui_json_to_client` into `collectedRawMessages` (`rawMessages`) and `applyMessages(surface, validated)`, retaining `<a2ui-json>` / raw JSON extraction only as a text fallback.
  - `applyMessages()` handles strictly v1.0 messages: `createSurface` (including embedded `components` and `dataModel`), `deleteSurface`, `updateComponents`, `updateDataModel`, plus direct `components` array fallback.

### Formal Frontend Catalog (`frontend/src/catalog/culinaryCatalog.tsx`)
- Exports `CULINARY_CATALOG_ID` matching `recipe_agent/catalog.py`.
- Defines Zod component APIs (`RecipeSummaryCardApi`, `RecipeDetailCardApi`, `GuidedCookingCardApi`, `DefaultCardApi`) matching the Python schemas.
- Wraps custom React components (`RecipeSummaryCard`, `RecipeDetailCard`, `GuidedCookingCard`, `DefaultCard`) via `createComponentImplementation(...)` and forwards user actions through `context.dispatchAction({ event: { name, context } })`.
- Derives `culinaryCatalog` using `basicCatalog.derive({ catalogId: CULINARY_CATALOG_ID, components: [...basicCatalog.components.values(), ...] })`.

### Dual Renderer Modes & Strict Catalog Isolation (`App.tsx`, `A2UIRenderer.tsx`, `DefaultA2UIRenderer.tsx`)
`App.tsx` includes a header toggle (`rendererMode`: `'custom'` vs `'default'`) and passes only `messages={msg.rawMessages}` and `onAction={handleAction}` to whichever renderer is active (one isolated `MessageProcessor` per chat bubble):

1. **Custom Catalog Mode — `frontend/src/components/A2UIRenderer.tsx`**
   - Calls `injectBasicCatalogStyles()` and instantiates `new MessageProcessor([culinaryCatalog])` (**does NOT include `basicCatalog`**).
   - **Strict rejection on catalog mismatch**: If `messages` contains `createSurface.catalogId === basicCatalog.id`, or if `MessageProcessor([culinaryCatalog])` throws/fails to build a surface, `A2UIRenderer` sets `catalogError` and renders a red **`Catalog Mismatch Error`** alert (`role="alert"`) instead of falling back.
   - **Why `basicCatalog` and manual `renderComponent` fallback were removed:** Including `basicCatalog` in `A2UIRenderer` would silently render Stage 3 payloads and hide catalog mismatches. Meanwhile, the legacy `renderComponent` fallback (including invalid v1.0 `Text` variants like `h1`/`h2`/`h3`/`badge`, which A2UI v1.0 restricts to `"caption" | "body"`) became dead code once `<A2uiSurface />` handled all `culinaryCatalog` and derived `basicCatalog` primitives natively.

2. **Default Renderer Mode — `frontend/src/components/DefaultA2UIRenderer.tsx`**
   - Strictly Stage 3 (`BasicCatalog` only).
   - Calls `injectBasicCatalogStyles()` and uses `new MessageProcessor([basicCatalog])` + `<A2uiSurface />` styled via `--a2ui-*` CSS custom properties in `frontend/src/index.css` (`.a2ui-default-surface`).
   - If toggled onto a Stage 4 custom-catalog payload (`surfaces.length === 0`), displays an amber notice telling the user to switch the header toggle back to **Custom Catalog**.
   - **Why `adaptCustomCatalogIfNeeded` / `customToBasicAdapter.ts` was removed:** A2UI catalog schemas define component prop contracts, not client-side fallback layouts. Maintaining a client translator from custom cards to `BasicCatalog` primitives defeated the clean separation between Stage 3 (`DefaultA2UIRenderer`, `BasicCatalog` only) and Stage 4 (`A2UIRenderer`, `culinaryCatalog`).

### Custom Domain Components (`frontend/src/components/`) & Action Loop (`App.tsx`)
- `RecipeSummaryCard.tsx`: Discovery card with dish image, timing/calorie metadata, and **View** (`view_recipe`) / **Let's Cook This** (`start_cooking`) buttons.
- `RecipeDetailCard.tsx`: Full ingredients list + cook button.
- `GuidedCookingCard.tsx` + `CookingTimer.tsx`: **Why single-card bundling?** Putting all cooking steps into one `GuidedCookingCard` lets users step forward/backward (`Next`/`Previous`) and run countdown timers locally in React with zero LLM latency or extra turns per step; `finish_cooking` triggers a final plating turn.
- `DefaultCard.tsx` + `MarkdownRenderer.tsx`: Markdown card using `marked` (supporting `#` headings and rich formatting within A2UI v1.0).
- `InstructionStepCard.tsx` + `InstructionStepFlow.tsx`: Unused step-card components left in `components/` from earlier multi-turn step rendering (superseded by `GuidedCookingCard.tsx`).
- `App.tsx` (`handleAction`): Converts `view_recipe`, `start_cooking`, and `finish_cooking` action events into follow-up ADK prompts (`next_step` is a no-op).

---

## 4. Key Invariants & Guidelines for Agents

1. **Keep schema validation on the backend**: Use `SendA2uiToClientToolset` in `recipe_agent/agent.py`. Do not reintroduce client-side A2UI payload patching (`usageHint -> variant`, hyphen sanitization, etc.) in `DefaultA2UIRenderer.tsx` or `A2UIRenderer.tsx`.
2. **Keep v1.0 strict**: Do not add `v0.8` (`beginRendering`, `surfaceUpdate`, `dataModelUpdate`, nested component dicts, `explicitList`, `literalString`) or `v0.9` (`usageHint`, `distribution`, `theme`, `0.9.x` versions) compatibility code back into `frontend/src/`.
3. **Preserve strict catalog separation**:
   - `A2UIRenderer.tsx` must register `[culinaryCatalog]` only and surface an error if the agent returns `basicCatalog`.
   - `DefaultA2UIRenderer.tsx` must register `[basicCatalog]` only and stay free of Stage 4 custom component expansion adapters.
4. **Match Python & Zod catalogs**: Any schema change in `recipe_agent/catalog.py` must be mirrored in `frontend/src/catalog/culinaryCatalog.tsx` (using the same `CULINARY_CATALOG_ID` and field names). Do not re-add duplicated JSON schema examples to `recipe_agent/agent.py`; `A2uiRequestProcessor` + `A2uiInstruction` auto-generate schemas from `catalog.py`.
5. **Preserve relative `/images/...` URLs** in `recipe_agent/recipes.py` and Vite's `/images` proxy in `frontend/vite.config.ts`.
6. **Enforce self-contained per-turn surfaces**: Keep `create_turn_processor` (a fresh `RendererState(catalogs)` per tool call) in `SendA2uiToClientToolset` and the per-turn `createSurface` prompt rule. Because each chat bubble instantiates its own `MessageProcessor`, update-only payloads missing `createSurface` would fail on the client (`Surface not found for message: ...`).

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
