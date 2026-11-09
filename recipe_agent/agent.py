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