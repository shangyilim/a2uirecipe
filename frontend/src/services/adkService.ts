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
      if ('beginRendering' in msg && msg.beginRendering) {
        surface.surfaceId = msg.beginRendering.surfaceId || surface.surfaceId;
        surface.rootId = msg.beginRendering.root || surface.rootId;
      }
      if ('surfaceUpdate' in msg && msg.surfaceUpdate) {
        for (const comp of msg.surfaceUpdate.components || []) {
          surface.components[comp.id] = comp;
        }
      }
      if ('dataModelUpdate' in msg && msg.dataModelUpdate) {
        for (const item of msg.dataModelUpdate.contents || []) {
          surface.dataModel[item.key] =
            item.valueString ?? item.valueNumber ?? item.valueBoolean;
        }
      }

      // Also support direct format: { surfaceId, root, components: [...] }
      if (Array.isArray(msg.components)) {
        for (const comp of msg.components) {
          if (comp?.id) {
            surface.components[comp.id] = comp;
          }
        }
        if (msg.surfaceId) {
          surface.surfaceId = msg.surfaceId;
        }
        if (!surface.rootId) {
          if (msg.root) {
            surface.rootId = msg.root;
          } else if (surface.components['root-column']) {
            surface.rootId = 'root-column';
          } else if (surface.components['main-column']) {
            surface.rootId = 'main-column';
          } else if (msg.components.length > 0 && msg.components[0]?.id) {
            surface.rootId = msg.components[0].id;
          }
        }
      }
    }

    // Fallback: if components exist but no rootId is set, find the first Column or first component
    if (!surface.rootId && Object.keys(surface.components).length > 0) {
      const keys = Object.keys(surface.components);
      const columnKey = keys.find((k) => surface.components[k]?.component?.Column);
      surface.rootId = columnKey || keys[0];
    }
  }
}

export const adkService = new AdkService();
