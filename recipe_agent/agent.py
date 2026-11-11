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