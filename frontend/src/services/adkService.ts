import { SurfaceState } from '../types/a2ui';

const ADK_BASE_URL = 'http://127.0.0.1:8080';
const USER_ID = 'demo_user';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text?: string;
  surfaceState?: SurfaceState;
}

export class AdkService {
  private sessionId: string | null = null;
  private resolvedAppName: string = 'recipe_agent';

  async getAppName(): Promise<string> {
    try {
      const res = await fetch(`${ADK_BASE_URL}/list-apps`);
      if (res.ok) {
        const apps = await res.json();
        if (Array.isArray(apps) && apps.length > 0) {
          this.resolvedAppName = apps[0];
        }
      }
    } catch {
      // fallback
    }
    return this.resolvedAppName;
  }

  async initSession(): Promise<string> {
    if (this.sessionId) return this.sessionId;
    
    const appName = await this.getAppName();
    const id = `session-${Date.now()}`;
    
    const res = await fetch(`${ADK_BASE_URL}/apps/${appName}/users/${USER_ID}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: id }),
    });

    if (!res.ok) {
      throw new Error(`Failed to create ADK session: ${res.statusText}`);
    }
    this.sessionId = id;
    return id;
  }

  async sendMessage(prompt: string): Promise<ChatMessage> {
    const sessionId = await this.initSession();
    const appName = this.resolvedAppName;

    const response = await fetch(`${ADK_BASE_URL}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_name: appName,
        user_id: USER_ID,
        session_id: sessionId,
        new_message: {
          role: 'user',
          parts: [{ text: prompt }],
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Agent run failed: ${response.statusText}`);
    }

    const events = await response.json();
    return this.parseEvents(events);
  }

  private parseEvents(events: any[]): ChatMessage {
    let combinedText = '';
    const surface: SurfaceState = {
      surfaceId: 'default',
      rootId: null,
      components: {},
      dataModel: {},
    };

    for (const evt of events) {
      const parts = evt.content?.parts || [];
      for (const part of parts) {
        if (part.text) {
          combinedText += part.text + '\n';
        }
      }
    }

    // Match <a2ui-json>...</a2ui-json> blocks
    const regex = /<a2ui-json>([\s\S]*?)<\/a2ui-json>/g;
    let match;
    let hasUi = false;
    let cleanText = combinedText;

    while ((match = regex.exec(combinedText)) !== null) {
      hasUi = true;
      try {
        const raw = JSON.parse(match[1].trim());
        const messages: any[] = Array.isArray(raw) ? raw : [raw];
        this.applyMessages(surface, messages);
      } catch (err) {
        console.error('Failed to parse A2UI JSON payload:', err);
      }
      cleanText = cleanText.replace(match[0], '').trim();
    }

    // Also handle case where Stage 2 output was code blocks or raw JSON array/object
    if (!hasUi && (combinedText.trim().startsWith('[') || combinedText.trim().startsWith('{') || combinedText.includes('```json'))) {
      const jsonCandidate = combinedText.includes('```json')
        ? combinedText.split('```json')[1]?.split('```')[0]?.trim()
        : combinedText.trim();
      if (jsonCandidate && (jsonCandidate.startsWith('[') || jsonCandidate.startsWith('{'))) {
        try {
          const raw = JSON.parse(jsonCandidate);
          const messages: any[] = Array.isArray(raw) ? raw : [raw];
          this.applyMessages(surface, messages);
          if (surface.rootId) {
            hasUi = true;
            cleanText = '';
          }
        } catch {
          // not valid A2UI json, keep as plain text
        }
      }
    }

    return {
      id: `msg-${Date.now()}`,
      sender: 'agent',
      text: cleanText || undefined,
      surfaceState: hasUi && surface.rootId ? surface : undefined,
    };
  }

  private applyMessages(surface: SurfaceState, messages: any[]) {
    for (const msg of messages) {
      if (!msg) continue;

      // v0.9 & v0.9.1 createSurface (scoped to active surfaces)
      if ('createSurface' in msg && msg.createSurface) {
        surface.surfaceId = msg.createSurface.surfaceId || surface.surfaceId;
        surface.rootId = null;
        surface.components = {};
        surface.dataModel = {};
      }

      // v0.9 & v0.9.1 deleteSurface (removes active surface, enabling ID reuse)
      if ('deleteSurface' in msg && msg.deleteSurface) {
        const delId = msg.deleteSurface.surfaceId;
        if (!delId || delId === surface.surfaceId) {
          surface.rootId = null;
          surface.components = {};
          surface.dataModel = {};
        }
      }

      // v0.9 & v0.9.1 updateComponents
      if ('updateComponents' in msg && msg.updateComponents) {
        if (msg.updateComponents.surfaceId) {
          surface.surfaceId = msg.updateComponents.surfaceId;
        }
        for (const comp of msg.updateComponents.components || []) {
          if (comp?.id) {
            surface.components[comp.id] = comp;
            if (comp.id === 'root') {
              surface.rootId = 'root';
            }
          }
        }
      }

      // v0.9 updateDataModel
      if ('updateDataModel' in msg && msg.updateDataModel) {
        const val = msg.updateDataModel.value;
        const path = msg.updateDataModel.path;
        if (val && typeof val === 'object') {
          if (!path || path === '/' || path === '') {
            Object.assign(surface.dataModel, val);
          } else {
            const cleanPath = path.replace(/^\//, '');
            surface.dataModel[cleanPath] = val;
          }
        }
      }

      // v0.8 legacy beginRendering
      if ('beginRendering' in msg && msg.beginRendering) {
        surface.surfaceId = msg.beginRendering.surfaceId || surface.surfaceId;
        surface.rootId = msg.beginRendering.root || surface.rootId;
      }

      // v0.8 legacy surfaceUpdate
      if ('surfaceUpdate' in msg && msg.surfaceUpdate) {
        for (const comp of msg.surfaceUpdate.components || []) {
          if (comp?.id) {
            surface.components[comp.id] = comp;
          }
        }
      }

      // v0.8 legacy dataModelUpdate
      if ('dataModelUpdate' in msg && msg.dataModelUpdate) {
        for (const item of msg.dataModelUpdate.contents || []) {
          surface.dataModel[item.key] =
            item.valueString ?? item.valueNumber ?? item.valueBoolean;
        }
      }

      // Direct components list format: { surfaceId, root?, components: [...] }
      if (Array.isArray(msg.components)) {
        for (const comp of msg.components) {
          if (comp?.id) {
            surface.components[comp.id] = comp;
            if (comp.id === 'root') {
              surface.rootId = 'root';
            }
          }
        }
        if (msg.surfaceId) {
          surface.surfaceId = msg.surfaceId;
        }
        if (!surface.rootId && msg.root) {
          surface.rootId = msg.root;
        }
      }
    }

    // Resolve rootId:
    // 1. v0.9 specification: exactly one component with id "root"
    if (surface.components['root']) {
      surface.rootId = 'root';
    } else if (!surface.rootId && Object.keys(surface.components).length > 0) {
      // 2. Fallbacks for named containers or first component
      const keys = Object.keys(surface.components);
      const rootCandidate = keys.find((k) => {
        const comp = surface.components[k];
        if (!comp) return false;
        if (k === 'root-column' || k === 'main-column') return true;
        if (comp.component === 'Column') return true;
        if (typeof comp.component === 'object' && comp.component !== null && 'Column' in comp.component) return true;
        return false;
      });
      surface.rootId = rootCandidate || keys[0];
    }
  }
}

export const adkService = new AdkService();
