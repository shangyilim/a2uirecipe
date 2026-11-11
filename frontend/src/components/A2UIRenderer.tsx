import { useState, useEffect, type FC } from 'react';
import { MessageProcessor, basicCatalog, injectBasicCatalogStyles } from '@a2ui/web_core/v1_0';
import { A2uiSurface } from '@a2ui/react';
import { culinaryCatalog, CULINARY_CATALOG_ID } from '../catalog/culinaryCatalog';
import { AlertCircle } from 'lucide-react';

if (typeof document !== 'undefined') {
  injectBasicCatalogStyles();
}

interface Props {
  messages?: any[];
  onAction?: (action: { type: string; parameters?: Record<string, any>; context?: Record<string, any> }) => void;
}

export const A2UIRenderer: FC<Props> = ({ messages, onAction }) => {
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

  if (catalogSurfaces.length === 0) {
    return null;
  }

  return (
    <div className="a2ui-surface w-full space-y-4">
      {catalogSurfaces.map((surf) => (
        <A2uiSurface key={surf.id} surface={surf as any} />
      ))}
    </div>
  );
};
