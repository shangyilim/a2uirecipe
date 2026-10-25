// A2UI Standard MIME Types (v0.9.1 standardized to application/a2ui+json)
export const A2UI_MIME_TYPE = 'application/a2ui+json';
export const DEPRECATED_A2UI_MIME_TYPE = 'application/json+a2ui';

export type A2UIVersion = 'v0.9.1' | 'v0.9' | '0.9.1' | '0.9' | string;

export type BoundValue<T = string> = 
  | T 
  | { literalString?: string; literalNumber?: number; literalBoolean?: boolean; path?: string };

// v0.9 & v0.9.1 Component Interface
export interface A2UIComponent {
  id: string;
  // v0.9+ uses flat discriminator: component: "Text"
  // v0.8 uses nested object: component: { Text: { ... } }
  component: string | Record<string, any>;
  [key: string]: any;
}

// v0.9 & v0.9.1 Lifecycle Messages
export interface CreateSurfaceMessage {
  version?: A2UIVersion;
  createSurface: {
    surfaceId: string;
    catalogId?: string;
    theme?: Record<string, any>;
    sendDataModel?: boolean;
  };
}

export interface UpdateComponentsMessage {
  version?: A2UIVersion;
  updateComponents: {
    surfaceId: string;
    components: A2UIComponent[];
  };
}

export interface UpdateDataModelMessage {
  version?: A2UIVersion;
  updateDataModel: {
    surfaceId: string;
    value?: Record<string, any>;
    path?: string;
  };
}

export interface DeleteSurfaceMessage {
  version?: A2UIVersion;
  deleteSurface: {
    surfaceId: string;
  };
}

// v0.8 Legacy Messages (for backwards compatibility)
export interface BeginRenderingMessage {
  beginRendering: {
    surfaceId: string;
    root: string;
    styles?: Record<string, any>;
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

export type A2UIMessage = 
  | CreateSurfaceMessage
  | UpdateComponentsMessage
  | UpdateDataModelMessage
  | DeleteSurfaceMessage
  | BeginRenderingMessage 
  | SurfaceUpdateMessage 
  | DataModelUpdateMessage;

export interface SurfaceState {
  surfaceId: string;
  rootId: string | null;
  components: Record<string, A2UIComponent>;
  dataModel: Record<string, any>;
}
