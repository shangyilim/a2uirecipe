// A2UI Standard MIME Type (v1.0)
export const A2UI_MIME_TYPE = 'application/a2ui+json';

export type A2UIVersion = '1.0' | 'v1.0';

export type BoundValue<T = string> = T | { '@path'?: string; path?: string };

// v1.0 Flat Discriminator Component Interface
export interface A2UIComponent {
  id: string;
  component: string;
  [key: string]: any;
}

// v1.0 Lifecycle Messages
export interface CreateSurfaceMessage {
  version?: A2UIVersion;
  createSurface: {
    surfaceId: string;
    catalogId?: string;
    sendDataModel?: boolean;
    // v1.0 single-message creation support
    components?: A2UIComponent[];
    dataModel?: Record<string, any>;
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

export type A2UIMessage =
  | CreateSurfaceMessage
  | UpdateComponentsMessage
  | UpdateDataModelMessage
  | DeleteSurfaceMessage;

export interface SurfaceState {
  surfaceId: string;
  rootId: string | null;
  components: Record<string, A2UIComponent>;
  dataModel: Record<string, any>;
}
