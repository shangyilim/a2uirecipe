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
  onAction?: (action: { type: string; parameters?: Record<string, any> }) => void;
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
    if (value.path && surface.dataModel[value.path] !== undefined) {
      return String(surface.dataModel[value.path]);
    }
    return '';
  };

  const renderComponent = (componentId: string): ReactNode => {
    const item: A2UIComponent = surface.components[componentId];
    if (!item || !item.component) return null;

    const {
      Text,
      Card,
      Column,
      Row,
      Button,
      Icon,
      Image,
      Divider,
      List,
    } = item.component;

    // Text Primitive
    if (Text) {
      const textVal = resolveValue(Text.text);
      switch (Text.usageHint) {
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
    if (Card) {
      return (
        <DefaultCard key={componentId}>
          {renderComponent(Card.child)}
        </DefaultCard>
      );
    }

    // Column Primitive
    if (Column) {
      const childrenIds = Column.children.explicitList;
      const stepItems: { id: string; stepData: any }[] = [];
      const nonStepIds: string[] = [];

      for (const id of childrenIds) {
        const comp = surface.components[id];
        if (comp && (comp.component.InstructionStepCard || comp.component.StepCard)) {
          stepItems.push({
            id,
            stepData: comp.component.InstructionStepCard || comp.component.StepCard,
          });
        } else {
          nonStepIds.push(id);
        }
      }

      // If there are multiple step cards, render non-step children first, then the GuidedCookingCard (all steps in 1 single card)
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
    if (Row) {
      const justify =
        Row.distribution === 'spaceBetween'
          ? 'justify-between'
          : Row.distribution === 'center'
          ? 'justify-center'
          : Row.distribution === 'end'
          ? 'justify-end'
          : 'justify-start';

      return (
        <div
          key={componentId}
          className={`flex flex-row items-center gap-2.5 ${justify} flex-wrap w-full`}
        >
          {Row.children.explicitList.map((childId) => renderComponent(childId))}
        </div>
      );
    }

    // Button Primitive
    if (Button) {
      const label = resolveValue(Button.label);
      return (
        <button
          key={componentId}
          onClick={() => Button.action && onAction?.(Button.action)}
          className="inline-flex items-center justify-center px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 rounded-xl border border-slate-200 shadow-sm transition-all focus:outline-none"
        >
          {label}
        </button>
      );
    }

    // Icon Primitive
    if (Icon) {
      const iconName = resolveValue(Icon.name).toLowerCase();
      const props = { size: Icon.size || 16, className: 'inline-block text-amber-500' };
      if (iconName.includes('clock') || iconName.includes('schedule')) {
        return <Clock key={componentId} {...props} />;
      }
      if (iconName.includes('star')) {
        return <Star key={componentId} {...props} />;
      }
      if (iconName.includes('flame') || iconName.includes('spicy')) {
        return <Flame key={componentId} {...props} />;
      }
      return <ChefHat key={componentId} {...props} />;
    }

    // Image Primitive
    if (Image) {
      return (
        <img
          key={componentId}
          src={resolveValue(Image.url)}
          alt={resolveValue(Image.alt) || 'Recipe'}
          className="rounded-xl object-cover max-h-52 w-full mb-2 border border-slate-100"
        />
      );
    }

    // Divider Primitive
    if (Divider) {
      return <hr key={componentId} className="my-2 border-slate-100" />;
    }

    // List Primitive
    if (List) {
      return (
        <ul key={componentId} className="list-disc pl-5 text-xs text-slate-600 space-y-1">
          {List.children.explicitList.map((childId) => (
            <li key={childId}>{renderComponent(childId)}</li>
          ))}
        </ul>
      );
    }

    // Custom Simplified RecipeSummaryCard Primitive (for recipe list discovery)
    if (item.component.RecipeSummaryCard) {
      const summary = item.component.RecipeSummaryCard;
      return (
        <RecipeSummaryCard
          key={componentId}
          id={summary.id}
          name={resolveValue(summary.name)}
          description={resolveValue(summary.description)}
          cookTime={resolveValue(summary.cookTime)}
          prepTime={resolveValue(summary.prepTime)}
          difficulty={resolveValue(summary.difficulty)}
          calories={resolveValue(summary.calories)}
          cuisine={resolveValue(summary.cuisine)}
          badge={resolveValue(summary.badge)}
          imageUrl={resolveValue(summary.imageUrl)}
          onAction={onAction}
        />
      );
    }

    // Custom Full RecipeDetailCard Primitive (shown after selecting Let's Cook This)
    if (item.component.RecipeDetailCard) {
      const card = item.component.RecipeDetailCard;
      let ingList: string[] = [];
      if (Array.isArray(card.ingredients)) {
        ingList = card.ingredients.map((ing) => resolveValue(ing));
      } else if (card.ingredients && 'path' in card.ingredients && surface.dataModel[card.ingredients.path]) {
        const fromModel = surface.dataModel[card.ingredients.path];
        ingList = Array.isArray(fromModel) ? fromModel.map(String) : [];
      }

      return (
        <RecipeDetailCard
          key={componentId}
          id={card.id}
          name={resolveValue(card.name)}
          description={resolveValue(card.description)}
          prepTime={resolveValue(card.prepTime)}
          cookTime={resolveValue(card.cookTime)}
          servings={resolveValue(card.servings)}
          difficulty={resolveValue(card.difficulty)}
          calories={resolveValue(card.calories)}
          cuisine={resolveValue(card.cuisine)}
          badge={resolveValue(card.badge)}
          imageUrl={resolveValue(card.imageUrl)}
          ingredients={ingList}
          showCookButton={card.showCookButton ?? true}
          onAction={onAction}
        />
      );
    }

    // Custom CookingTimer Primitive
    if (item.component.CookingTimer) {
      const timer = item.component.CookingTimer;
      return (
        <CookingTimer
          key={componentId}
          minutes={resolveValue(timer.minutes) || 5}
          label={resolveValue(timer.label)}
          dish={resolveValue(timer.dish)}
        />
      );
    }

    // Custom InstructionStepCard Primitive (for guided cooking steps, with optional live timer)
    if (item.component.InstructionStepCard || item.component.StepCard) {
      const stepData = item.component.InstructionStepCard || item.component.StepCard;
      return (
        <InstructionStepCard
          key={componentId}
          step={resolveValue(stepData.step)}
          totalSteps={resolveValue(stepData.totalSteps)}
          title={resolveValue(stepData.title)}
          instruction={resolveValue(stepData.instruction || stepData.text || stepData.description)}
          duration={resolveValue(stepData.duration)}
          timerMinutes={resolveValue(stepData.timerMinutes || stepData.minutes)}
          dish={resolveValue(stepData.dish)}
          tip={resolveValue(stepData.tip)}
          isLastStep={Boolean(stepData.isLastStep)}
          onAction={onAction}
        />
      );
    }

    // Custom GuidedCookingCard Primitive (all steps in 1 single card with Next/Previous navigation)
    if (item.component.GuidedCookingCard) {
      const gcc = item.component.GuidedCookingCard;
      return (
        <GuidedCookingCard
          key={componentId}
          dish={resolveValue(gcc.dish || gcc.recipeName)}
          steps={gcc.steps || []}
          onAction={onAction}
        />
      );
    }

    // Custom DefaultCard Primitive
    if (item.component.DefaultCard) {
      const cardData = item.component.DefaultCard;
      return (
        <DefaultCard
          key={componentId}
          title={resolveValue(cardData.title)}
          text={resolveValue(cardData.text || cardData.content || cardData.body)}
        />
      );
    }

    // Fallback if no other specialized cards can be used: render default card with formatted markdown!
    const fallbackText =
      resolveValue(item.component?.text) ||
      resolveValue(item.component?.content) ||
      resolveValue(item.component?.message) ||
      resolveValue(item.component?.description);

    if (fallbackText) {
      return (
        <DefaultCard
          key={componentId}
          title={resolveValue(item.component?.title)}
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
