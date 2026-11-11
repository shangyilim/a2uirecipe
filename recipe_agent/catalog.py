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
