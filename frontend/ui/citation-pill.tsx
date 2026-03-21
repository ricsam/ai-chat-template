import type { Citation } from "@/shared/types";
import { MessageResponse } from "@/components/ai-elements/message";
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationSource,
  InlineCitationQuote,
} from "@/components/ai-elements/inline-citation";
import { Badge } from "@/components/ui/badge";
import { HoverCardTrigger } from "@/components/ui/hover-card";
import { Link } from "@richie-router/react";
import { useRef, useState, useLayoutEffect, useMemo } from "react";
import { createPortal } from "react-dom";

interface CitationMarkdownRendererProps {
  text: string;
  citations?: Citation[];
}

// Unique placeholder that won't be transformed by markdown
const CITE_MARKER = "\u200B\u2063CITE:";
const CITE_END = "\u2063\u200B";

// Custom citation trigger that shows the citation number instead of hostname
function CitationTrigger({ citation }: { citation: Citation }) {
  return (
    <HoverCardTrigger asChild>
      <Badge className="ml-0.5 rounded-full cursor-pointer" variant="secondary">
        {citation.number}
      </Badge>
    </HoverCardTrigger>
  );
}

// Citation component to render in portals
function CitationPortalContent({ citation }: { citation: Citation }) {
  return (
    <InlineCitation>
      <InlineCitationCard>
        <CitationTrigger citation={citation} />
        <InlineCitationCardBody className="p-4">
          <InlineCitationSource
            title={citation.fileName}
            description={
              citation.pageNumber
                ? `Page ${citation.pageNumber} · ${Math.round(citation.similarity * 100)}% match`
                : `${Math.round(citation.similarity * 100)}% match`
            }
          >
            <Link
              to="/knowledge-base/files/$"
              params={{ _splat: citation.documentId }}
              className="text-xs text-primary hover:underline"
            >
              View document
            </Link>
          </InlineCitationSource>
          <InlineCitationQuote className="mt-2 line-clamp-4">
            {citation.content}
          </InlineCitationQuote>
        </InlineCitationCardBody>
      </InlineCitationCard>
    </InlineCitation>
  );
}

// Portal target: element + citation number
interface PortalTarget {
  element: Element;
  citationNumber: string;
  id: string;
}

// Find all text nodes in an element
function getTextNodes(element: Node): Text[] {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    textNodes.push(node);
  }
  return textNodes;
}

// Renders markdown text with inline citations using AI Elements InlineCitation components
export function CitationMarkdownRenderer({ text, citations }: CitationMarkdownRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [portalTargets, setPortalTargets] = useState<PortalTarget[]>([]);

  const hasCitations = citations && citations.length > 0;

  // Replace [N] markers with unique text placeholders
  const processedText = useMemo(() => {
    if (!hasCitations) return text;
    let idx = 0;
    return text.replace(
      /\[(\d+)\]/g,
      (_match, num) => `${CITE_MARKER}${num}:${idx++}${CITE_END}`
    );
  }, [text, hasCitations]);

  // Process text nodes to replace citation markers with portal targets
  const processTextNodes = (container: HTMLElement) => {
    const targets: PortalTarget[] = [];
    const textNodes = getTextNodes(container);
    const pattern = new RegExp(`${CITE_MARKER}(\\d+):(\\d+)${CITE_END}`, 'g');

    for (const textNode of textNodes) {
      const content = textNode.textContent || '';
      if (!content.includes(CITE_MARKER)) continue;

      // Split the text node by citation markers
      const parts: (string | { num: string; idx: string })[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      pattern.lastIndex = 0;
      while ((match = pattern.exec(content)) !== null) {
        if (match.index > lastIndex) {
          parts.push(content.slice(lastIndex, match.index));
        }
        parts.push({ num: match[1]!, idx: match[2]! });
        lastIndex = pattern.lastIndex;
      }
      if (lastIndex < content.length) {
        parts.push(content.slice(lastIndex));
      }

      // Replace text node with fragment containing text and placeholder spans
      const fragment = document.createDocumentFragment();
      for (const part of parts) {
        if (typeof part === 'string') {
          fragment.appendChild(document.createTextNode(part));
        } else {
          const span = document.createElement('span');
          span.className = 'citation-portal-target';
          span.dataset.citation = part.num;
          span.dataset.idx = part.idx;
          fragment.appendChild(span);
          targets.push({
            element: span,
            citationNumber: part.num,
            id: `${part.num}-${part.idx}`,
          });
        }
      }

      textNode.parentNode?.replaceChild(fragment, textNode);
    }

    return targets;
  };

  // Use MutationObserver to catch when MessageResponse finishes rendering
  useLayoutEffect(() => {
    if (!hasCitations || !containerRef.current) {
      setPortalTargets([]);
      return;
    }

    const container = containerRef.current;

    // Process immediately in case content is already there
    const initialTargets = processTextNodes(container);
    if (initialTargets.length > 0) {
      setPortalTargets(initialTargets);
    }

    // Watch for changes (streaming/async content)
    const observer = new MutationObserver(() => {
      const newTargets = processTextNodes(container);
      if (newTargets.length > 0) {
        setPortalTargets((prev) => [...prev, ...newTargets]);
      }
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [processedText, hasCitations]);

  // If no citations, use standard MessageResponse for markdown
  if (!hasCitations) {
    return <MessageResponse>{text}</MessageResponse>;
  }

  return (
    <>
      <div ref={containerRef} className="citation-content">
        <MessageResponse>{processedText}</MessageResponse>
      </div>
      {portalTargets.map((target) => {
        const citation = citations.find((c) => c.number === target.citationNumber);
        if (!citation) return null;
        return createPortal(
          <CitationPortalContent key={target.id} citation={citation} />,
          target.element
        );
      })}
    </>
  );
}
