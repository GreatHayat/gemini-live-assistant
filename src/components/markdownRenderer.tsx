import React from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]} // Add GitHub Flavored Markdown support
        children={content}
        components={{
          // Code blocks and inline code
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");

            if (!inline && match) {
              // Block code (with language specification)
              return (
                <div className="code-block-container w-full my-4">
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    className="rounded-md"
                    customStyle={{
                      padding: "1rem",
                      margin: 0,
                      overflow: "auto",
                    }}
                    codeTagProps={{
                      style: {
                        whiteSpace: "pre",
                        wordBreak: "normal",
                      },
                    }}
                    {...props}
                  >
                    {String(children).replace(/\n$/, "")}
                  </SyntaxHighlighter>
                </div>
              );
            } else {
              // Inline code
              return (
                <code
                  className="bg-gray-100 text-black rounded px-1 py-0.5 font-mono text-sm"
                  {...props}
                >
                  {children}
                </code>
              );
            }
          },

          // Lists - Special handling to ensure nested markup works
          ul({ children }) {
            return (
              <ul className="list-disc pl-6 mb-4 space-y-2">{children}</ul>
            );
          },

          ol({ children }) {
            return (
              <ol className="list-decimal pl-6 mb-4 space-y-2">{children}</ol>
            );
          },

          li({ children, ...props }) {
            return (
              <li className="mb-1" {...props}>
                {children}
              </li>
            );
          },

          // Paragraph handling
          p({ children }) {
            return <p className="mb-4 last:mb-0">{children}</p>;
          },

          // Text formatting
          strong({ children }) {
            return <strong className="font-semibold">{children}</strong>;
          },

          em({ children }) {
            return <em className="italic">{children}</em>;
          },

          // Links
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 underline"
              >
                {children}
              </a>
            );
          },

          // Blockquotes
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600 mb-4">
                {children}
              </blockquote>
            );
          },

          // Headings
          h1({ children }) {
            return <h1 className="text-2xl font-bold mb-4 mt-6">{children}</h1>;
          },

          h2({ children }) {
            return <h2 className="text-xl font-bold mb-3 mt-6">{children}</h2>;
          },

          h3({ children }) {
            return <h3 className="text-lg font-bold mb-3 mt-5">{children}</h3>;
          },

          h4({ children }) {
            return (
              <h4 className="text-base font-bold mb-2 mt-4">{children}</h4>
            );
          },

          // Tables
          table({ children }) {
            return (
              <div className="overflow-x-auto mb-4">
                <table className="min-w-full divide-y divide-gray-200">
                  {children}
                </table>
              </div>
            );
          },

          thead({ children }) {
            return <thead className="bg-gray-50">{children}</thead>;
          },

          tbody({ children }) {
            return (
              <tbody className="divide-y divide-gray-200">{children}</tbody>
            );
          },

          tr({ children }) {
            return <tr>{children}</tr>;
          },

          th({ children }) {
            return (
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {children}
              </th>
            );
          },

          td({ children }) {
            return (
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {children}
              </td>
            );
          },

          // Pre-formatted text blocks
          pre({ children }) {
            return <div className="overflow-visible">{children}</div>;
          },
        }}
      />
    </div>
  );
};

export default MarkdownRenderer;
