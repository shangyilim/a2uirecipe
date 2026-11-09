import React, { useMemo } from 'react';
import { marked } from 'marked';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
}) => {
  const htmlContent = useMemo(() => {
    if (!content) return '';
    try {
      return marked.parse(content, {
        breaks: true,
        gfm: true,
      }) as string;
    } catch {
      return content;
    }
  }, [content]);

  return (
    <div
      className={`markdown-body text-sm leading-relaxed text-slate-700 space-y-2 [&>h1]:text-lg [&>h1]:font-bold [&>h1]:text-slate-900 [&>h1]:mt-3 [&>h1]:mb-1.5 [&>h2]:text-base [&>h2]:font-bold [&>h2]:text-slate-800 [&>h2]:mt-2.5 [&>h2]:mb-1 [&>h3]:text-sm [&>h3]:font-semibold [&>h3]:text-slate-800 [&>h3]:mt-2 [&>p]:leading-relaxed [&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:my-2 [&>ul>li]:mb-1 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:my-2 [&>ol>li]:mb-1 [&>strong]:font-semibold [&>strong]:text-slate-900 [&>blockquote]:border-l-4 [&>blockquote]:border-emerald-500 [&>blockquote]:pl-3 [&>blockquote]:py-1 [&>blockquote]:italic [&>blockquote]:text-slate-600 [&>blockquote]:bg-emerald-50/50 [&>blockquote]:rounded-r-lg [&>pre]:bg-slate-900 [&>pre]:text-slate-100 [&>pre]:p-3 [&>pre]:rounded-xl [&>pre]:overflow-x-auto [&>code]:bg-slate-100 [&>code]:text-emerald-700 [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded-md [&>code]:text-xs [&>code]:font-mono [&>a]:text-emerald-600 [&>a]:underline hover:[&>a]:text-emerald-700 ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};
