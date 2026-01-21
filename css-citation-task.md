# CSS Task: Render Citations Inline with Markdown

## Objective
Make citation badges `[1]`, `[2]` etc. flow inline with surrounding text while preserving markdown block structure (headings, lists, code blocks).

## Current Behavior (Broken)
Citations appear on their own line:
```
The definition and examples vary depending on the context
[2]
.
```

## Desired Behavior
Citations should flow inline with text:
```
The definition and examples vary depending on the context [2].
```

## Technical Context

### Component Structure
File: `frontend/components/citation-pill.tsx`

The `CitationMarkdownRenderer` component:
1. Splits markdown text by citation markers like `[1]`, `[2]` using regex: `/(\[\d+\])/g`
2. For each text segment: renders via `<MessageResponse>` (which converts markdown to HTML)
3. For each citation marker: renders an `<InlineCitation>` component (a hoverable badge)

### The Problem
When text is split by citations, each segment gets wrapped in block elements by the markdown renderer:

**Input:** `"Some text [1] more text."`

**After split:** `["Some text ", "[1]", " more text."]`

**Rendered structure:**
```html
<div class="citation-content">
  <span>
    <div class="markdown-body">
      <p>Some text </p>  <!-- Block element -->
    </div>
  </span>
  <span class="inline-citation">  <!-- InlineCitation badge -->
    <badge>[1]</badge>
  </span>
  <span>
    <div class="markdown-body">
      <p> more text.</p>  <!-- Block element -->
    </div>
  </span>
</div>
```

The `<p>` tags create line breaks between segments.

### Constraints
- Must preserve block-level markdown: headings (`<h1>`-`<h6>`), lists (`<ul>`, `<ol>`), code blocks (`<pre>`), blockquotes
- Only paragraph text should flow inline with citations
- The `InlineCitation` component renders as `<span class="group inline">` containing a `<Badge>`

### Current CSS Attempts (in citation-pill.tsx)
```tsx
// Container
<div className="citation-content [&_.markdown-body]:contents">

// Text segments
<span className="contents [&_p]:inline [&_p]:m-0">
  <MessageResponse>{part}</MessageResponse>
</span>
```

This doesn't fully work - either everything becomes one line (breaking markdown) or citations still break to new lines.

## Files to Reference
- `frontend/components/citation-pill.tsx` - The component to fix
- `frontend/components/ai-elements/inline-citation.tsx` - The InlineCitation component structure (in `/Users/richard.samuelsson/projects/build-it-now/src/components/ai-elements/`)

## Acceptance Criteria
1. Text like `"context [2]."` renders as `context [2].` on one line
2. Headings remain as block elements (own line)
3. Lists render correctly as block elements
4. Code blocks render correctly as block elements
5. Multiple paragraphs still have paragraph breaks between them
6. Citations at end of paragraphs don't cause extra line breaks
