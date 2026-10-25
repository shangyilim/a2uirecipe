# ADK + A2UI Recipe Codelab

Interactive recipe assistant demonstrating **Agent Development Kit (ADK)** and **A2UI** (Agent-to-User Interface) powered by **Gemini 3.5 Flash-Lite**.

## Project Structure
- [CODELAB.md](file:///Users/limshangyi/Downloads/a2uirecipecodelab/CODELAB.md): Complete step-by-step tutorial guide following the Google Codelab format.
- [recipe_agent/](file:///Users/limshangyi/Downloads/a2uirecipecodelab/recipe_agent): The recipe agent package.
  - [recipes.py](file:///Users/limshangyi/Downloads/a2uirecipecodelab/recipe_agent/recipes.py): Curated recipes mock data and `get_recipes()` tool.
  - [agent.py](file:///Users/limshangyi/Downloads/a2uirecipecodelab/recipe_agent/agent.py): The agent evolved through Stages 1, 2, and 3.
- [frontend/](file:///Users/limshangyi/Downloads/a2uirecipecodelab/frontend): React + TypeScript + Tailwind CSS chat application connecting to ADK and rendering A2UI components.

## Quick Start

1. Add your Gemini API key in [.env](file:///Users/limshangyi/Downloads/a2uirecipecodelab/.env):
   ```bash
   GEMINI_API_KEY=your_gemini_api_key
   ```

2. Start the ADK Web UI:
   ```bash
   .venv/bin/adk web --port 8080 --allow_origins "*" --reload_agents
   ```

3. Open `http://127.0.0.1:8080` in your browser and select **`recipe_assistant`** from the agent dropdown.

4. Follow [CODELAB.md](file:///Users/limshangyi/Downloads/a2uirecipecodelab/CODELAB.md) to walk through:
   - **Stage 1**: Plain text recipe responses.
   - **Stage 2**: Structured A2UI JSON output.
   - **Stage 3**: Interactive rendered UI components in the browser.

5. Run the custom React Frontend:
   ```bash
   cd frontend
   npm run dev
   ```
   Open `http://localhost:3000` to interact with the custom React chat UI.
