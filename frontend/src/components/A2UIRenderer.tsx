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
    throw new Error('Not Implemented yet. See step 7 in codelab.')

  };

  return (
    <div className="a2ui-surface w-full">
      {renderComponent(surface.rootId)}
    </div>
  );
};
