export type BoundValue<T = string> = 
  | T 
  | { literalString?: string; literalNumber?: number; literalBoolean?: boolean; path?: string };

export interface A2UIComponent {
  id: string;
  component: {
    Text?: {
      text: BoundValue<string>;
      usageHint?: 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'badge';
    };
    Card?: {
      child: string;
    };
    Column?: {
      children: { explicitList: string[] };
      alignment?: 'start' | 'center' | 'end' | 'stretch';
    };
    Row?: {
      children: { explicitList: string[] };
      distribution?: 'start' | 'center' | 'end' | 'spaceBetween' | 'spaceAround';
      alignment?: 'start' | 'center' | 'end' | 'stretch';
    };
    Button?: {
      label: BoundValue<string>;
      action?: {
        type: string;
        parameters?: Record<string, any>;
      };
    };
    Icon?: {
      name: BoundValue<string>;
      size?: number;
      color?: string;
    };
    Image?: {
      url: BoundValue<string>;
      alt?: BoundValue<string>;
    };
    Divider?: Record<string, never>;
    List?: {
      children: { explicitList: string[] };
    };
    RecipeSummaryCard?: {
      id?: string;
      name: BoundValue<string>;
      description?: BoundValue<string>;
      cookTime?: BoundValue<string>;
      prepTime?: BoundValue<string>;
      difficulty?: BoundValue<string>;
      calories?: BoundValue<string>;
      cuisine?: BoundValue<string>;
      badge?: BoundValue<string>;
      imageUrl?: BoundValue<string>;
    };
    RecipeDetailCard?: {
      name: BoundValue<string>;
      id?: string;
      description?: BoundValue<string>;
      prepTime?: BoundValue<string>;
      cookTime?: BoundValue<string>;
      servings?: BoundValue<number | string>;
      difficulty?: BoundValue<string>;
      calories?: BoundValue<string>;
      cuisine?: BoundValue<string>;
      badge?: BoundValue<string>;
      imageUrl?: BoundValue<string>;
      ingredients?: Array<BoundValue<string>> | { path: string };
      showCookButton?: boolean;
    };
    CookingTimer?: {
      minutes: BoundValue<number | string>;
      label?: BoundValue<string>;
      dish?: BoundValue<string>;
    };
    [key: string]: any;
  };
}

export interface BeginRenderingMessage {
  beginRendering: {
    surfaceId: string;
    root: string;
  };
}

export interface SurfaceUpdateMessage {
  surfaceUpdate: {
    surfaceId: string;
    components: A2UIComponent[];
  };
}

export interface DataModelUpdateMessage {
  dataModelUpdate: {
    surfaceId: string;
    contents: Array<{
      key: string;
      valueString?: string;
      valueNumber?: number;
      valueBoolean?: boolean;
    }>;
  };
}

export type A2UIMessage = BeginRenderingMessage | SurfaceUpdateMessage | DataModelUpdateMessage;

export interface SurfaceState {
  surfaceId: string;
  rootId: string | null;
  components: Record<string, A2UIComponent>;
  dataModel: Record<string, any>;
}
