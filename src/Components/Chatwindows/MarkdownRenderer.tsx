import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  MarkdownParagraph,
  MarkdownList,
  MarkdownOrderedList,
  MarkdownListItem,
  MarkdownInlineCode,
  MarkdownCodeBlock,
  MarkdownBlockquote,
  MarkdownH1,
  MarkdownH2,
  MarkdownH3
} from './styled';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <ReactMarkdown 
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <MarkdownParagraph>{children}</MarkdownParagraph>,
        ul: ({ children }) => <MarkdownList>{children}</MarkdownList>,
        ol: ({ children }) => <MarkdownOrderedList>{children}</MarkdownOrderedList>,
        li: ({ children }) => <MarkdownListItem>{children}</MarkdownListItem>,
        code: ({ children }) => <MarkdownInlineCode>{children}</MarkdownInlineCode>,
        pre: ({ children }) => <MarkdownCodeBlock>{children}</MarkdownCodeBlock>,
        blockquote: ({ children }) => <MarkdownBlockquote>{children}</MarkdownBlockquote>,
        h1: ({ children }) => <MarkdownH1>{children}</MarkdownH1>,
        h2: ({ children }) => <MarkdownH2>{children}</MarkdownH2>,
        h3: ({ children }) => <MarkdownH3>{children}</MarkdownH3>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

export default MarkdownRenderer;
