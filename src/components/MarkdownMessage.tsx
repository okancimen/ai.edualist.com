import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        h1: ({ children }) => <h1 className="text-lg font-bold mb-2 mt-1">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-1">{children}</h2>,
        h3: ({ children }) => <h3 className="font-bold mb-1 mt-1">{children}</h3>,
        ul: ({ children }) => (
          <ul className="list-disc list-outside pl-4 mb-2 space-y-0.5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-outside pl-4 mb-2 space-y-0.5">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-gray-300 pl-3 text-gray-500 my-2 italic">
            {children}
          </blockquote>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-blue-600 underline underline-offset-2 hover:text-blue-800"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        hr: () => <hr className="my-3 border-gray-200" />,
        pre: ({ children }) => (
          <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto my-2 text-xs font-mono leading-relaxed">
            {children}
          </pre>
        ),
        code: ({ className, children, ...props }) => {
          const isBlock = /language-(\w+)/.test(className || "");
          if (isBlock) {
            return <code className={className}>{children}</code>;
          }
          return (
            <code
              className="bg-gray-100 text-gray-800 rounded px-1 py-0.5 text-xs font-mono"
              {...props}
            >
              {children}
            </code>
          );
        },
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="text-xs border-collapse w-full">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-gray-200 px-3 py-1.5 bg-gray-50 font-semibold text-left">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-gray-200 px-3 py-1.5">{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
