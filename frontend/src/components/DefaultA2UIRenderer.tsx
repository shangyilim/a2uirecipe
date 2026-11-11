import { useState, useEffect, type FC } from 'react';
import { MessageProcessor, basicCatalog, injectBasicCatalogStyles } from '@a2ui/web_core/v1_0';
import { A2uiSurface } from '@a2ui/react';

// Inject default basic catalog structural CSS once into document head
if (typeof document !== 'undefined') {
  injectBasicCatalogStyles();
}

interface Props {
  messages?: any[];
  onAction?: (action: { type: string; parameters?: Record<string, any>; context?: Record<string, any> }) => void;
}

export const DefaultA2UIRenderer: FC<Props> = ({ messages, onAction }) => {
  const [surfaces, setSurfaces] = useState<any[]>([]);

  useEffect(() => {
    if (!messages || messages.length === 0) {
      setSurfaces([]);
      return;
    }

    // Fresh MessageProcessor per batch avoids duplicate surface errors on re-renders
    const processor = new MessageProcessor([basicCatalog]);
    const actionSubs: Array<{ unsubscribe: () => void }> = [];

    const sync = () => {
      const activeSurfaces = Array.from(processor.model.surfacesMap.values());
      setSurfaces(activeSurfaces);

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
    } catch (err) {
      console.warn('Default A2UI v1.0 renderer failed to process messages:', err);
      setSurfaces([]);
    }

    return () => {
      createdSub.unsubscribe();
      deletedSub.unsubscribe();
      actionSubs.forEach((sub) => sub.unsubscribe());
    };
  }, [messages, onAction]);

  if (!messages || messages.length === 0) {
    return null;
  }

  if (surfaces.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900">
        This response uses a custom catalog rather than standard <code className="font-mono">BasicCatalog</code> primitives. Switch the header toggle to <strong>Custom Catalog</strong> to render it.
      </div>
    );
  }

  return (
    <div className="a2ui-default-surface w-full space-y-4">
      {surfaces.map((surface) => (
        <A2uiSurface key={surface.id} surface={surface as any} />
      ))}
    </div>
  );
};
