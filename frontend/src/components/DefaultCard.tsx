import React from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ChefHat } from 'lucide-react';

export interface DefaultCardProps {
  title?: string;
  text?: string;
  content?: string;
  children?: React.ReactNode;
  className?: string;
}

export const DefaultCard: React.FC<DefaultCardProps> = ({
  title,
  text,
  content,
  children,
  className = '',
}) => {
  const markdownText = text || content || '';

  return (
    <div
      className={`bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all my-2.5 overflow-hidden ${className}`}
    >
      {title && (
        <div className="flex items-center gap-2 pb-2.5 mb-3 border-b border-slate-100">
          <ChefHat size={18} className="text-emerald-600 shrink-0" />
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">{title}</h3>
        </div>
      )}

      {markdownText ? (
        <MarkdownRenderer content={markdownText} />
      ) : null}

      {children}
    </div>
  );
};
