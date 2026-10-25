import type { FC, ReactNode } from 'react';
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
  surface: SurfaceState;
  onAction?: (action: { type: string; parameters?: Record<string, any>; context?: Record<string, any> }) => void;
}

export const A2UIRenderer: FC<Props> = ({ surface, onAction }) => {
  if (!surface.rootId || !surface.components[surface.rootId]) {
    return null;
  }

  const resolveValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value.literalString !== undefined) return value.literalString;
    if (value.literalNumber !== undefined) return String(value.literalNumber);
    if (value.literalBoolean !== undefined) return String(value.literalBoolean);
    if (value.path) {
      const cleanPath = String(value.path).replace(/^\//, '');
      if (surface.dataModel[cleanPath] !== undefined) {
        return String(surface.dataModel[cleanPath]);
      }
      if (surface.dataModel[value.path] !== undefined) {
        return String(surface.dataModel[value.path]);
      }
    }
    return '';
  };

  const getComponentInfo = (item: A2UIComponent): { type: string; props: any } => {
    if (!item) return { type: '', props: {} };
    // v0.9: item.component is string (e.g. "Text", "Column", "RecipeSummaryCard")
    if (typeof item.component === 'string') {
      return { type: item.component, props: item };
    }
    // v0.8: item.component is object (e.g. { Text: { ... } })
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
      return (
        <DefaultCard key={componentId}>
          {childId ? renderComponent(childId) : null}
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
      const label = resolveValue(props.label || props.text);
      const action = props.action;
      const isBorderless = props.variant === 'borderless';
      return (
        <button
          key={componentId}
          onClick={() => {
            if (action) {
              const params = action.context || action.parameters || {};
              onAction?.({ type: action.type, parameters: params, context: params });
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

    // Custom Simplified RecipeSummaryCard Primitive
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

    // Custom Full RecipeDetailCard Primitive
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

    // Custom CookingTimer Primitive
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

    // Custom InstructionStepCard Primitive
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

    // Custom GuidedCookingCard Primitive
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

    // Custom DefaultCard Primitive
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
