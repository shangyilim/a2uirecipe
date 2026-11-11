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

// -----------------------------------------------------------------------------
// 1. Formal Zod Catalog Schemas (Matching recipe_agent/catalog.py)
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// 2. React Catalog Implementations via @a2ui/react createComponentImplementation
// -----------------------------------------------------------------------------

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
          event: {
            name: action.type,
            context: action.parameters || {},
          },
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
          event: {
            name: action.type,
            context: action.parameters || {},
          },
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
          event: {
            name: action.type,
            context: action.parameters || {},
          },
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

// -----------------------------------------------------------------------------
// 3. Derived Formal A2UI v1.0 Culinary Catalog
// -----------------------------------------------------------------------------

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
