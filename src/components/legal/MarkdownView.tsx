"use client";

import ReactMarkdown from "react-markdown";

// Rendu Markdown des documents légaux (section 150) — stylé via la classe .legal-prose
// (globals.css). Les liens externes s'ouvrent dans un nouvel onglet.
export default function MarkdownView({ children }: { children: string }) {
  return (
    <div className="legal-prose">
      <ReactMarkdown
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
