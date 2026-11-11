import { useState, useEffect, type FC, type ReactNode } from 'react';
import { MessageProcessor, basicCatalog } from '@a2ui/web_core/v1_0';
import { A2uiSurface } from '@a2ui/react';
import { culinaryCatalog, CULINARY_CATALOG_ID } from '../catalog/culinaryCatalog';
import { A2UIComponent, SurfaceState } from '../types/a2ui';
import { Clock, Star, Flame, ChefHat, AlertCircle } from 'lucide-react';
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
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    if (!messages || messages.length === 0) {
      setCatalogSurfaces([]);
      setCatalogError(null);
      return;
    }

    const returnedBasicCatalog = messages.some(
      (msg) => msg?.createSurface?.catalogId === basicCatalog.id
    );
    if (returnedBasicCatalog) {
      setCatalogSurfaces([]);
      setCatalogError(
        `Custom Catalog mode expected ${CULINARY_CATALOG_ID}, but the agent returned BasicCatalog (${basicCatalog.id}). Switch the header toggle to "Default (@a2ui/react)" or enable CulinaryCatalog on the agent.`
      );
      return;
    }

    const processor = new MessageProcessor([culinaryCatalog]);
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
      if (processor.model.surfacesMap.size === 0) {
        setCatalogError(
          `Custom Catalog renderer could not create a surface for ${CULINARY_CATALOG_ID}.`
        );
      } else {
        setCatalogError(null);
      }
    } catch (err) {
      console.warn('Formal Culinary Catalog processor error:', err);
      setCatalogSurfaces([]);
      setCatalogError(
        err instanceof Error
          ? err.message
          : `Failed to validate payload against Custom Catalog (${CULINARY_CATALOG_ID}).`
      );
    }

    return () => {
      createdSub.unsubscribe();
      deletedSub.unsubscribe();
      actionSubs.forEach((sub) => sub.unsubscribe());
    };
  }, [messages, onAction]);

  if (catalogError) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900"
      >
        <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
        <div className="space-y-1">
          <p className="font-semibold">Catalog Mismatch Error</p>
          <p className="leading-relaxed text-red-800">{catalogError}</p>
        </div>
      </div>
    );
  }

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

  // Fallback: only when raw A2UI messages were not supplied (e.g., direct SurfaceState rendering)
  if (!surface || !surface.rootId || !surface.components[surface.rootId]) {
    return null;
  }

  const resolveValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
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

  const normalizeImageUrl = (url?: string): string => {
    if (!url) return '';
    return url.replace(/^http:\/\/(?:127\.0\.0\.1|localhost):8080/, '');
  };

  const getComponentInfo = (item: A2UIComponent): { type: string; props: any } => {
    if (!item || typeof item.component !== 'string') return { type: '', props: {} };
    // v1.0 flat discriminator model: item.component is a string (e.g. "Text", "Column", "RecipeSummaryCard")
    return { type: item.component, props: item };
  };

  const getChildIds = (props: any): string[] => {
    if (Array.isArray(props.children)) {
      return props.children.map(String);
    }
    return [];
  };

  const renderComponent = (componentId: string): ReactNode => {
    const item: A2UIComponent = surface.components[componentId];
    if (!item) return null;

    const { type, props } = getComponentInfo(item);

    // Text Primitive
    if (type === 'Text') {
      const textVal = resolveValue(props.text);
      const variant = props.variant;
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
      const justifyAttr = props.justify;
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
                action.functionCall?.['@call'] ||
                action.functionCall?.call ||
                action.name ||
                action.type ||
                '';
              const params =
                action.event?.context ||
                action.functionCall?.args ||
                action.context ||
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
          src={normalizeImageUrl(resolveValue(props.url))}
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
          imageUrl={normalizeImageUrl(resolveValue(props.imageUrl))}
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
          imageUrl={normalizeImageUrl(resolveValue(props.imageUrl))}
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
