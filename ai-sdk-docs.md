# Chatbot

The `useChat` hook makes it effortless to create a conversational user interface for your chatbot application. It enables the streaming of chat messages from your AI provider, manages the chat state, and updates the UI automatically as new messages arrive.

To summarize, the `useChat` hook provides the following features:

- **Message Streaming**: All the messages from the AI provider are streamed to the chat UI in real-time.
- **Managed States**: The hook manages the states for input, messages, status, error and more for you.
- **Seamless Integration**: Easily integrate your chat AI into any design or layout with minimal effort.

In this guide, you will learn how to use the `useChat` hook to create a chatbot application with real-time message streaming.
Check out our [chatbot with tools guide](/docs/ai-sdk-ui/chatbot-with-tool-calling) to learn how to use tools in your chatbot.
Let's start with the following example first.

## Example

```tsx filename='app/page.tsx'
'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';

export default function Page() {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  });
  const [input, setInput] = useState('');

  return (
    <>
      {messages.map(message => (
        <div key={message.id}>
          {message.role === 'user' ? 'User: ' : 'AI: '}
          {message.parts.map((part, index) =>
            part.type === 'text' ? <span key={index}>{part.text}</span> : null,
          )}
        </div>
      ))}

      <form
        onSubmit={e => {
          e.preventDefault();
          if (input.trim()) {
            sendMessage({ text: input });
            setInput('');
          }
        }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={status !== 'ready'}
          placeholder="Say something..."
        />
        <button type="submit" disabled={status !== 'ready'}>
          Submit
        </button>
      </form>
    </>
  );
}
```

```ts filename='app/api/chat/route.ts'
import { convertToModelMessages, streamText, UIMessage } from 'ai';
__PROVIDER_IMPORT__;

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: __MODEL__,
    system: 'You are a helpful assistant.',
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
```

<Note>
  The UI messages have a new `parts` property that contains the message parts.
  We recommend rendering the messages using the `parts` property instead of the
  `content` property. The parts property supports different message types,
  including text, tool invocation, and tool result, and allows for more flexible
  and complex chat UIs.
</Note>

In the `Page` component, the `useChat` hook will request to your AI provider endpoint whenever the user sends a message using `sendMessage`.
The messages are then streamed back in real-time and displayed in the chat UI.

This enables a seamless chat experience where the user can see the AI response as soon as it is available,
without having to wait for the entire response to be received.

## Customized UI

`useChat` also provides ways to manage the chat message states via code, show status, and update messages without being triggered by user interactions.

### Status

The `useChat` hook returns a `status`. It has the following possible values:

- `submitted`: The message has been sent to the API and we're awaiting the start of the response stream.
- `streaming`: The response is actively streaming in from the API, receiving chunks of data.
- `ready`: The full response has been received and processed; a new user message can be submitted.
- `error`: An error occurred during the API request, preventing successful completion.

You can use `status` for e.g. the following purposes:

- To show a loading spinner while the chatbot is processing the user's message.
- To show a "Stop" button to abort the current message.
- To disable the submit button.

```tsx filename='app/page.tsx' highlight="6,22-29,36"
'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';

export default function Page() {
  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  });
  const [input, setInput] = useState('');

  return (
    <>
      {messages.map(message => (
        <div key={message.id}>
          {message.role === 'user' ? 'User: ' : 'AI: '}
          {message.parts.map((part, index) =>
            part.type === 'text' ? <span key={index}>{part.text}</span> : null,
          )}
        </div>
      ))}

      {(status === 'submitted' || status === 'streaming') && (
        <div>
          {status === 'submitted' && <Spinner />}
          <button type="button" onClick={() => stop()}>
            Stop
          </button>
        </div>
      )}

      <form
        onSubmit={e => {
          e.preventDefault();
          if (input.trim()) {
            sendMessage({ text: input });
            setInput('');
          }
        }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={status !== 'ready'}
          placeholder="Say something..."
        />
        <button type="submit" disabled={status !== 'ready'}>
          Submit
        </button>
      </form>
    </>
  );
}
```

### Error State

Similarly, the `error` state reflects the error object thrown during the fetch request.
It can be used to display an error message, disable the submit button, or show a retry button:

<Note>
  We recommend showing a generic error message to the user, such as "Something
  went wrong." This is a good practice to avoid leaking information from the
  server.
</Note>

```tsx file="app/page.tsx" highlight="6,20-27,33"
'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';

export default function Chat() {
  const { messages, sendMessage, error, reload } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  });
  const [input, setInput] = useState('');

  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>
          {m.role}:{' '}
          {m.parts.map((part, index) =>
            part.type === 'text' ? <span key={index}>{part.text}</span> : null,
          )}
        </div>
      ))}

      {error && (
        <>
          <div>An error occurred.</div>
          <button type="button" onClick={() => reload()}>
            Retry
          </button>
        </>
      )}

      <form
        onSubmit={e => {
          e.preventDefault();
          if (input.trim()) {
            sendMessage({ text: input });
            setInput('');
          }
        }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={error != null}
        />
      </form>
    </div>
  );
}
```

Please also see the [error handling](/docs/ai-sdk-ui/error-handling) guide for more information.

### Modify messages

Sometimes, you may want to directly modify some existing messages. For example, a delete button can be added to each message to allow users to remove them from the chat history.

The `setMessages` function can help you achieve these tasks:

```tsx
const { messages, setMessages } = useChat()

const handleDelete = (id) => {
  setMessages(messages.filter(message => message.id !== id))
}

return <>
  {messages.map(message => (
    <div key={message.id}>
      {message.role === 'user' ? 'User: ' : 'AI: '}
      {message.parts.map((part, index) => (
        part.type === 'text' ? (
          <span key={index}>{part.text}</span>
        ) : null
      ))}
      <button onClick={() => handleDelete(message.id)}>Delete</button>
    </div>
  ))}
  ...
```

You can think of `messages` and `setMessages` as a pair of `state` and `setState` in React.

### Cancellation and regeneration

It's also a common use case to abort the response message while it's still streaming back from the AI provider. You can do this by calling the `stop` function returned by the `useChat` hook.

```tsx
const { stop, status } = useChat()

return <>
  <button onClick={stop} disabled={!(status === 'streaming' || status === 'submitted')}>Stop</button>
  ...
```

When the user clicks the "Stop" button, the fetch request will be aborted. This avoids consuming unnecessary resources and improves the UX of your chatbot application.

Similarly, you can also request the AI provider to reprocess the last message by calling the `regenerate` function returned by the `useChat` hook:

```tsx
const { regenerate, status } = useChat();

return (
  <>
    <button
      onClick={regenerate}
      disabled={!(status === 'ready' || status === 'error')}
    >
      Regenerate
    </button>
    ...
  </>
);
```

When the user clicks the "Regenerate" button, the AI provider will regenerate the last message and replace the current one correspondingly.

### Throttling UI Updates

<Note>This feature is currently only available for React.</Note>

By default, the `useChat` hook will trigger a render every time a new chunk is received.
You can throttle the UI updates with the `experimental_throttle` option.

```tsx filename="page.tsx" highlight="2-3"
const { messages, ... } = useChat({
  // Throttle the messages and data updates to 50ms:
  experimental_throttle: 50
})
```

## Event Callbacks

`useChat` provides optional event callbacks that you can use to handle different stages of the chatbot lifecycle:

- `onFinish`: Called when the assistant response is completed. The event includes the response message, all messages, and flags for abort, disconnect, and errors.
- `onError`: Called when an error occurs during the fetch request.
- `onData`: Called whenever a data part is received.

These callbacks can be used to trigger additional actions, such as logging, analytics, or custom UI updates.

```tsx
import { UIMessage } from 'ai';

const {
  /* ... */
} = useChat({
  onFinish: ({ message, messages, isAbort, isDisconnect, isError }) => {
    // use information to e.g. update other UI states
  },
  onError: error => {
    console.error('An error occurred:', error);
  },
  onData: data => {
    console.log('Received data part from server:', data);
  },
});
```

It's worth noting that you can abort the processing by throwing an error in the `onData` callback. This will trigger the `onError` callback and stop the message from being appended to the chat UI. This can be useful for handling unexpected responses from the AI provider.

## Request Configuration

### Custom headers, body, and credentials

By default, the `useChat` hook sends a HTTP POST request to the `/api/chat` endpoint with the message list as the request body. You can customize the request in two ways:

#### Hook-Level Configuration (Applied to all requests)

You can configure transport-level options that will be applied to all requests made by the hook:

```tsx
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

const { messages, sendMessage } = useChat({
  transport: new DefaultChatTransport({
    api: '/api/custom-chat',
    headers: {
      Authorization: 'your_token',
    },
    body: {
      user_id: '123',
    },
    credentials: 'same-origin',
  }),
});
```

#### Dynamic Hook-Level Configuration

You can also provide functions that return configuration values. This is useful for authentication tokens that need to be refreshed, or for configuration that depends on runtime conditions:

```tsx
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

const { messages, sendMessage } = useChat({
  transport: new DefaultChatTransport({
    api: '/api/custom-chat',
    headers: () => ({
      Authorization: `Bearer ${getAuthToken()}`,
      'X-User-ID': getCurrentUserId(),
    }),
    body: () => ({
      sessionId: getCurrentSessionId(),
      preferences: getUserPreferences(),
    }),
    credentials: () => 'include',
  }),
});
```

<Note>
  For component state that changes over time, use `useRef` to store the current
  value and reference `ref.current` in your configuration function, or prefer
  request-level options (see next section) for better reliability.
</Note>

#### Request-Level Configuration (Recommended)

<Note>
  **Recommended**: Use request-level options for better flexibility and control.
  Request-level options take precedence over hook-level options and allow you to
  customize each request individually.
</Note>

```tsx
// Pass options as the second parameter to sendMessage
sendMessage(
  { text: input },
  {
    headers: {
      Authorization: 'Bearer token123',
      'X-Custom-Header': 'custom-value',
    },
    body: {
      temperature: 0.7,
      max_tokens: 100,
      user_id: '123',
    },
    metadata: {
      userId: 'user123',
      sessionId: 'session456',
    },
  },
);
```

The request-level options are merged with hook-level options, with request-level options taking precedence. On your server side, you can handle the request with this additional information.

### Setting custom body fields per request

You can configure custom `body` fields on a per-request basis using the second parameter of the `sendMessage` function.
This is useful if you want to pass in additional information to your backend that is not part of the message list.

```tsx filename="app/page.tsx" highlight="20-25"
'use client';

import { useChat } from '@ai-sdk/react';
import { useState } from 'react';

export default function Chat() {
  const { messages, sendMessage } = useChat();
  const [input, setInput] = useState('');

  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>
          {m.role}:{' '}
          {m.parts.map((part, index) =>
            part.type === 'text' ? <span key={index}>{part.text}</span> : null,
          )}
        </div>
      ))}

      <form
        onSubmit={event => {
          event.preventDefault();
          if (input.trim()) {
            sendMessage(
              { text: input },
              {
                body: {
                  customKey: 'customValue',
                },
              },
            );
            setInput('');
          }
        }}
      >
        <input value={input} onChange={e => setInput(e.target.value)} />
      </form>
    </div>
  );
}
```

You can retrieve these custom fields on your server side by destructuring the request body:

```ts filename="app/api/chat/route.ts" highlight="3,4"
export async function POST(req: Request) {
  // Extract additional information ("customKey") from the body of the request:
  const { messages, customKey }: { messages: UIMessage[]; customKey: string } =
    await req.json();
  //...
}
```

## Message Metadata

You can attach custom metadata to messages for tracking information like timestamps, model details, and token usage.

```ts
// Server: Send metadata about the message
return result.toUIMessageStreamResponse({
  messageMetadata: ({ part }) => {
    if (part.type === 'start') {
      return {
        createdAt: Date.now(),
        model: 'gpt-5.1',
      };
    }

    if (part.type === 'finish') {
      return {
        totalTokens: part.totalUsage.totalTokens,
      };
    }
  },
});
```

```tsx
// Client: Access metadata via message.metadata
{
  messages.map(message => (
    <div key={message.id}>
      {message.role}:{' '}
      {message.metadata?.createdAt &&
        new Date(message.metadata.createdAt).toLocaleTimeString()}
      {/* Render message content */}
      {message.parts.map((part, index) =>
        part.type === 'text' ? <span key={index}>{part.text}</span> : null,
      )}
      {/* Show token count if available */}
      {message.metadata?.totalTokens && (
        <span>{message.metadata.totalTokens} tokens</span>
      )}
    </div>
  ));
}
```

For complete examples with type safety and advanced use cases, see the [Message Metadata documentation](/docs/ai-sdk-ui/message-metadata).

## Transport Configuration

You can configure custom transport behavior using the `transport` option to customize how messages are sent to your API:

```tsx filename="app/page.tsx"
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

export default function Chat() {
  const { messages, sendMessage } = useChat({
    id: 'my-chat',
    transport: new DefaultChatTransport({
      prepareSendMessagesRequest: ({ id, messages }) => {
        return {
          body: {
            id,
            message: messages[messages.length - 1],
          },
        };
      },
    }),
  });

  // ... rest of your component
}
```

The corresponding API route receives the custom request format:

```ts filename="app/api/chat/route.ts"
export async function POST(req: Request) {
  const { id, message } = await req.json();

  // Load existing messages and add the new one
  const messages = await loadMessages(id);
  messages.push(message);

  const result = streamText({
    model: __MODEL__,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
```

### Advanced: Trigger-based routing

For more complex scenarios like message regeneration, you can use trigger-based routing:

```tsx filename="app/page.tsx"
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

export default function Chat() {
  const { messages, sendMessage, regenerate } = useChat({
    id: 'my-chat',
    transport: new DefaultChatTransport({
      prepareSendMessagesRequest: ({ id, messages, trigger, messageId }) => {
        if (trigger === 'submit-user-message') {
          return {
            body: {
              trigger: 'submit-user-message',
              id,
              message: messages[messages.length - 1],
              messageId,
            },
          };
        } else if (trigger === 'regenerate-assistant-message') {
          return {
            body: {
              trigger: 'regenerate-assistant-message',
              id,
              messageId,
            },
          };
        }
        throw new Error(`Unsupported trigger: ${trigger}`);
      },
    }),
  });

  // ... rest of your component
}
```

The corresponding API route would handle different triggers:

```ts filename="app/api/chat/route.ts"
export async function POST(req: Request) {
  const { trigger, id, message, messageId } = await req.json();

  const chat = await readChat(id);
  let messages = chat.messages;

  if (trigger === 'submit-user-message') {
    // Handle new user message
    messages = [...messages, message];
  } else if (trigger === 'regenerate-assistant-message') {
    // Handle message regeneration - remove messages after messageId
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex !== -1) {
      messages = messages.slice(0, messageIndex);
    }
  }

  const result = streamText({
    model: __MODEL__,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
```

To learn more about building custom transports, refer to the [Transport API documentation](/docs/ai-sdk-ui/transport).

### Direct Agent Transport

For scenarios where you want to communicate directly with an Agent without going through HTTP, you can use `DirectChatTransport`. This is useful for:

- Server-side rendering scenarios
- Testing without network
- Single-process applications

```tsx filename="app/page.tsx"
import { useChat } from '@ai-sdk/react';
import { DirectChatTransport, ToolLoopAgent } from 'ai';
__PROVIDER_IMPORT__;

const agent = new ToolLoopAgent({
  model: __MODEL__,
  instructions: 'You are a helpful assistant.',
});

export default function Chat() {
  const { messages, sendMessage, status } = useChat({
    transport: new DirectChatTransport({ agent }),
  });

  return (
    <>
      {messages.map(message => (
        <div key={message.id}>
          {message.role === 'user' ? 'User: ' : 'AI: '}
          {message.parts.map((part, index) =>
            part.type === 'text' ? <span key={index}>{part.text}</span> : null,
          )}
        </div>
      ))}

      <button
        onClick={() => sendMessage({ text: 'Hello!' })}
        disabled={status !== 'ready'}
      >
        Send
      </button>
    </>
  );
}
```

The `DirectChatTransport` invokes the agent's `stream()` method directly, converting UI messages to model messages and streaming the response back as UI message chunks.

For more details, see the [DirectChatTransport reference](/docs/reference/ai-sdk-ui/direct-chat-transport).

## Controlling the response stream

With `streamText`, you can control how error messages and usage information are sent back to the client.

### Error Messages

By default, the error message is masked for security reasons.
The default error message is "An error occurred."
You can forward error messages or send your own error message by providing a `getErrorMessage` function:

```ts filename="app/api/chat/route.ts" highlight="13-27"
import { convertToModelMessages, streamText, UIMessage } from 'ai';
__PROVIDER_IMPORT__;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: __MODEL__,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse({
    onError: error => {
      if (error == null) {
        return 'unknown error';
      }

      if (typeof error === 'string') {
        return error;
      }

      if (error instanceof Error) {
        return error.message;
      }

      return JSON.stringify(error);
    },
  });
}
```

### Usage Information

Track token consumption and resource usage with [message metadata](/docs/ai-sdk-ui/message-metadata):

1. Define a custom metadata type with usage fields (optional, for type safety)
2. Attach usage data using `messageMetadata` in your response
3. Display usage metrics in your UI components

Usage data is attached as metadata to messages and becomes available once the model completes its response generation.

```ts
import { openai } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  streamText,
  UIMessage,
  type LanguageModelUsage,
} from 'ai';
__PROVIDER_IMPORT__;

// Create a new metadata type (optional for type-safety)
type MyMetadata = {
  totalUsage: LanguageModelUsage;
};

// Create a new custom message type with your own metadata
export type MyUIMessage = UIMessage<MyMetadata>;

export async function POST(req: Request) {
  const { messages }: { messages: MyUIMessage[] } = await req.json();

  const result = streamText({
    model: __MODEL__,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    messageMetadata: ({ part }) => {
      // Send total usage when generation is finished
      if (part.type === 'finish') {
        return { totalUsage: part.totalUsage };
      }
    },
  });
}
```

Then, on the client, you can access the message-level metadata.

```tsx
'use client';

import { useChat } from '@ai-sdk/react';
import type { MyUIMessage } from './api/chat/route';
import { DefaultChatTransport } from 'ai';

export default function Chat() {
  // Use custom message type defined on the server (optional for type-safety)
  const { messages } = useChat<MyUIMessage>({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  });

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      {messages.map(m => (
        <div key={m.id} className="whitespace-pre-wrap">
          {m.role === 'user' ? 'User: ' : 'AI: '}
          {m.parts.map(part => {
            if (part.type === 'text') {
              return part.text;
            }
          })}
          {/* Render usage via metadata */}
          {m.metadata?.totalUsage && (
            <div>Total usage: {m.metadata?.totalUsage.totalTokens} tokens</div>
          )}
        </div>
      ))}
    </div>
  );
}
```

You can also access your metadata from the `onFinish` callback of `useChat`:

```tsx
'use client';

import { useChat } from '@ai-sdk/react';
import type { MyUIMessage } from './api/chat/route';
import { DefaultChatTransport } from 'ai';

export default function Chat() {
  // Use custom message type defined on the server (optional for type-safety)
  const { messages } = useChat<MyUIMessage>({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
    onFinish: ({ message }) => {
      // Access message metadata via onFinish callback
      console.log(message.metadata?.totalUsage);
    },
  });
}
```

### Text Streams

`useChat` can handle plain text streams by setting the `streamProtocol` option to `text`:

```tsx filename="app/page.tsx" highlight="7"
'use client';

import { useChat } from '@ai-sdk/react';
import { TextStreamChatTransport } from 'ai';

export default function Chat() {
  const { messages } = useChat({
    transport: new TextStreamChatTransport({
      api: '/api/chat',
    }),
  });

  return <>...</>;
}
```

This configuration also works with other backend servers that stream plain text.
Check out the [stream protocol guide](/docs/ai-sdk-ui/stream-protocol) for more information.

<Note>
  When using `TextStreamChatTransport`, tool calls, usage information and finish
  reasons are not available.
</Note>

## Reasoning

Some models such as as DeepSeek `deepseek-r1`
and Anthropic `claude-3-7-sonnet-20250219` support reasoning tokens.
These tokens are typically sent before the message content.
You can forward them to the client with the `sendReasoning` option:

```ts filename="app/api/chat/route.ts" highlight="13"
import { convertToModelMessages, streamText, UIMessage } from 'ai';

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: 'deepseek/deepseek-r1',
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
  });
}
```

On the client side, you can access the reasoning parts of the message object.

Reasoning parts have a `text` property that contains the reasoning content.

```tsx filename="app/page.tsx"
messages.map(message => (
  <div key={message.id}>
    {message.role === 'user' ? 'User: ' : 'AI: '}
    {message.parts.map((part, index) => {
      // text parts:
      if (part.type === 'text') {
        return <div key={index}>{part.text}</div>;
      }

      // reasoning parts:
      if (part.type === 'reasoning') {
        return <pre key={index}>{part.text}</pre>;
      }
    })}
  </div>
));
```

## Sources

Some providers such as [Perplexity](/providers/ai-sdk-providers/perplexity#sources) and
[Google Generative AI](/providers/ai-sdk-providers/google-generative-ai#sources) include sources in the response.

Currently sources are limited to web pages that ground the response.
You can forward them to the client with the `sendSources` option:

```ts filename="app/api/chat/route.ts" highlight="13"
import { convertToModelMessages, streamText, UIMessage } from 'ai';

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: 'perplexity/sonar-pro',
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse({
    sendSources: true,
  });
}
```

On the client side, you can access source parts of the message object.
There are two types of sources: `source-url` for web pages and `source-document` for documents.
Here is an example that renders both types of sources:

```tsx filename="app/page.tsx"
messages.map(message => (
  <div key={message.id}>
    {message.role === 'user' ? 'User: ' : 'AI: '}

    {/* Render URL sources */}
    {message.parts
      .filter(part => part.type === 'source-url')
      .map(part => (
        <span key={`source-${part.id}`}>
          [
          <a href={part.url} target="_blank">
            {part.title ?? new URL(part.url).hostname}
          </a>
          ]
        </span>
      ))}

    {/* Render document sources */}
    {message.parts
      .filter(part => part.type === 'source-document')
      .map(part => (
        <span key={`source-${part.id}`}>
          [<span>{part.title ?? `Document ${part.id}`}</span>]
        </span>
      ))}
  </div>
));
```

## Image Generation

Some models such as Google `gemini-2.5-flash-image-preview` support image generation.
When images are generated, they are exposed as files to the client.
On the client side, you can access file parts of the message object
and render them as images.

```tsx filename="app/page.tsx"
messages.map(message => (
  <div key={message.id}>
    {message.role === 'user' ? 'User: ' : 'AI: '}
    {message.parts.map((part, index) => {
      if (part.type === 'text') {
        return <div key={index}>{part.text}</div>;
      } else if (part.type === 'file' && part.mediaType.startsWith('image/')) {
        return <img key={index} src={part.url} alt="Generated image" />;
      }
    })}
  </div>
));
```

## Attachments

The `useChat` hook supports sending file attachments along with a message as well as rendering them on the client. This can be useful for building applications that involve sending images, files, or other media content to the AI provider.

There are two ways to send files with a message: using a `FileList` object from file inputs or using an array of file objects.

### FileList

By using `FileList`, you can send multiple files as attachments along with a message using the file input element. The `useChat` hook will automatically convert them into data URLs and send them to the AI provider.

<Note>
  Currently, only `image/*` and `text/*` content types get automatically
  converted into [multi-modal content
  parts](/docs/foundations/prompts#multi-modal-messages). You will need to
  handle other content types manually.
</Note>

```tsx filename="app/page.tsx"
'use client';

import { useChat } from '@ai-sdk/react';
import { useRef, useState } from 'react';

export default function Page() {
  const { messages, sendMessage, status } = useChat();

  const [input, setInput] = useState('');
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <div>
        {messages.map(message => (
          <div key={message.id}>
            <div>{`${message.role}: `}</div>

            <div>
              {message.parts.map((part, index) => {
                if (part.type === 'text') {
                  return <span key={index}>{part.text}</span>;
                }

                if (
                  part.type === 'file' &&
                  part.mediaType?.startsWith('image/')
                ) {
                  return <img key={index} src={part.url} alt={part.filename} />;
                }

                return null;
              })}
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={event => {
          event.preventDefault();
          if (input.trim()) {
            sendMessage({
              text: input,
              files,
            });
            setInput('');
            setFiles(undefined);

            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
          }
        }}
      >
        <input
          type="file"
          onChange={event => {
            if (event.target.files) {
              setFiles(event.target.files);
            }
          }}
          multiple
          ref={fileInputRef}
        />
        <input
          value={input}
          placeholder="Send message..."
          onChange={e => setInput(e.target.value)}
          disabled={status !== 'ready'}
        />
      </form>
    </div>
  );
}
```

### File Objects

You can also send files as objects along with a message. This can be useful for sending pre-uploaded files or data URLs.

```tsx filename="app/page.tsx"
'use client';

import { useChat } from '@ai-sdk/react';
import { useState } from 'react';
import { FileUIPart } from 'ai';

export default function Page() {
  const { messages, sendMessage, status } = useChat();

  const [input, setInput] = useState('');
  const [files] = useState<FileUIPart[]>([
    {
      type: 'file',
      filename: 'earth.png',
      mediaType: 'image/png',
      url: 'https://example.com/earth.png',
    },
    {
      type: 'file',
      filename: 'moon.png',
      mediaType: 'image/png',
      url: 'data:image/png;base64,iVBORw0KGgo...',
    },
  ]);

  return (
    <div>
      <div>
        {messages.map(message => (
          <div key={message.id}>
            <div>{`${message.role}: `}</div>

            <div>
              {message.parts.map((part, index) => {
                if (part.type === 'text') {
                  return <span key={index}>{part.text}</span>;
                }

                if (
                  part.type === 'file' &&
                  part.mediaType?.startsWith('image/')
                ) {
                  return <img key={index} src={part.url} alt={part.filename} />;
                }

                return null;
              })}
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={event => {
          event.preventDefault();
          if (input.trim()) {
            sendMessage({
              text: input,
              files,
            });
            setInput('');
          }
        }}
      >
        <input
          value={input}
          placeholder="Send message..."
          onChange={e => setInput(e.target.value)}
          disabled={status !== 'ready'}
        />
      </form>
    </div>
  );
}
```

## Type Inference for Tools

When working with tools in TypeScript, AI SDK UI provides type inference helpers to ensure type safety for your tool inputs and outputs.

### InferUITool

The `InferUITool` type helper infers the input and output types of a single tool for use in UI messages:

```tsx
import { InferUITool } from 'ai';
import { z } from 'zod';

const weatherTool = {
  description: 'Get the current weather',
  inputSchema: z.object({
    location: z.string().describe('The city and state'),
  }),
  execute: async ({ location }) => {
    return `The weather in ${location} is sunny.`;
  },
};

// Infer the types from the tool
type WeatherUITool = InferUITool<typeof weatherTool>;
// This creates a type with:
// {
//   input: { location: string };
//   output: string;
// }
```

### InferUITools

The `InferUITools` type helper infers the input and output types of a `ToolSet`:

```tsx
import { InferUITools, ToolSet } from 'ai';
import { z } from 'zod';

const tools = {
  weather: {
    description: 'Get the current weather',
    inputSchema: z.object({
      location: z.string().describe('The city and state'),
    }),
    execute: async ({ location }) => {
      return `The weather in ${location} is sunny.`;
    },
  },
  calculator: {
    description: 'Perform basic arithmetic',
    inputSchema: z.object({
      operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
      a: z.number(),
      b: z.number(),
    }),
    execute: async ({ operation, a, b }) => {
      switch (operation) {
        case 'add':
          return a + b;
        case 'subtract':
          return a - b;
        case 'multiply':
          return a * b;
        case 'divide':
          return a / b;
      }
    },
  },
} satisfies ToolSet;

// Infer the types from the tool set
type MyUITools = InferUITools<typeof tools>;
// This creates a type with:
// {
//   weather: { input: { location: string }; output: string };
//   calculator: { input: { operation: 'add' | 'subtract' | 'multiply' | 'divide'; a: number; b: number }; output: number };
// }
```

### Using Inferred Types

You can use these inferred types to create a custom UIMessage type and pass it to various AI SDK UI functions:

```tsx
import { InferUITools, UIMessage, UIDataTypes } from 'ai';

type MyUITools = InferUITools<typeof tools>;
type MyUIMessage = UIMessage<never, UIDataTypes, MyUITools>;
```

Pass the custom type to `useChat` or `createUIMessageStream`:

```tsx
import { useChat } from '@ai-sdk/react';
import { createUIMessageStream } from 'ai';
import type { MyUIMessage } from './types';

// With useChat
const { messages } = useChat<MyUIMessage>();

// With createUIMessageStream
const stream = createUIMessageStream<MyUIMessage>(/* ... */);
```

This provides full type safety for tool inputs and outputs on the client and server.



# Writing a Custom Provider

The AI SDK provides a [Language Model Specification](https://github.com/vercel/ai/tree/main/packages/provider/src/language-model/v2) that enables you to create custom providers compatible with the AI SDK. This specification ensures consistency across different providers.

## Publishing Your Provider

Please publish your custom provider in your own GitHub repository and as an NPM package. You are responsible for hosting and maintaining your provider. Once published, you can submit a PR to the AI SDK repository to add your provider to the [Community Providers](/providers/community-providers) documentation section. Use the [OpenRouter provider documentation](https://github.com/vercel/ai/blob/main/content/providers/03-community-providers/13-openrouter.mdx) as a template for your documentation.

## Why the Language Model Specification?

The Language Model Specification V3 is a standardized specification for interacting with language models that provides a unified abstraction layer across all AI providers. This specification creates a consistent interface that works seamlessly with different language models, ensuring that developers can interact with any provider using the same patterns and methods. It enables:

<Note>
  If you open-source a provider, we'd love to promote it here. Please send us a
  PR to add it to the [Community Providers](/providers/community-providers)
  section.
</Note>

## Understanding the V3 Specification

The Language Model Specification V3 creates a robust abstraction layer that works across all current and future AI providers. By establishing a standardized interface, it provides the flexibility to support emerging LLM capabilities while ensuring your application code remains provider-agnostic and future-ready.

### Architecture

At its heart, the V2 specification defines three main interfaces:

1. **ProviderV3**: The top-level interface that serves as a factory for different model types
2. **LanguageModelV3**: The primary interface for text generation models
3. **EmbeddingModelV3** and **ImageModelV3**: Interfaces for embeddings and image generation

### `ProviderV3`

The `ProviderV3` interface acts as the entry point:

```ts
interface ProviderV3 {
  languageModel(modelId: string): LanguageModelV3;
  .embeddingModel(modelId: string): EmbeddingModelV3<string>;
  imageModel(modelId: string): ImageModelV3;
}
```

### `LanguageModelV3`

The `LanguageModelV3` interface defines the methods your provider must implement:

```ts
interface LanguageModelV3 {
  specificationVersion: 'V3';
  provider: string;
  modelId: string;
  supportedUrls: Record<string, RegExp[]>;

  doGenerate(options: LanguageModelV3CallOptions): Promise<GenerateResult>;
  doStream(options: LanguageModelV3CallOptions): Promise<StreamResult>;
}
```

Key aspects:

- **specificationVersion**: Must be 'V3'
- **supportedUrls**: Declares which URLs (for file parts) the provider can handle natively
- **doGenerate/doStream**: methods for non-streaming and streaming generation

### Understanding Input vs Output

Before diving into the details, it's important to understand the distinction between two key concepts in the V3 specification:

1. **LanguageModelV3Content**: The specification for what the models generate
2. **LanguageModelV3Prompt**: The specification for what you send to the model

### `LanguageModelV3Content`

The V3 specification supports five distinct content types that models can generate, each designed for specific use cases:

#### Text Content

The fundamental building block for all text generation:

```ts
type LanguageModelV3Text = {
  type: 'text';
  text: string;
};
```

This is used for standard model responses, system messages, and any plain text output.

#### Tool Calls

Enable models to invoke functions with structured arguments:

```ts
type LanguageModelV3ToolCall = {
  type: 'tool-call';
  toolCallType: 'function';
  toolCallId: string;
  toolName: string;
  args: string;
};
```

The `toolCallId` is crucial for correlating tool results back to their calls, especially in streaming scenarios.

#### File Generation

Support for multimodal output generation:

```ts
type LanguageModelV3File = {
  type: 'file';
  mediaType: string; // IANA media type (e.g., 'image/png', 'audio/mp3')
  data: string | Uint8Array; // Generated file data as base64 encoded strings or binary data
};
```

This enables models to generate images, audio, documents, and other file types directly.

#### Reasoning

Dedicated support for chain-of-thought reasoning (essential for models like OpenAI's o1):

```ts
type LanguageModelV3Reasoning = {
  type: 'reasoning';
  text: string;

  /**
   * Optional provider-specific metadata for the reasoning part.
   */
  providerMetadata?: SharedV2ProviderMetadata;
};
```

Reasoning content is tracked separately from regular text, allowing for proper token accounting and UI presentation.

#### Sources

```ts
type LanguageModelV3Source = {
  type: 'source';
  sourceType: 'url';
  id: string;
  url: string;
  title?: string;
  providerMetadata?: SharedV2ProviderMetadata;
};
```

### `LanguageModelV3Prompt`

The V3 prompt format (`LanguageModelV3Prompt`) is designed as a flexible message array that supports multimodal inputs:

#### Message Roles

Each message has a specific role with allowed content types:

- **System**: Model instructions (text only)

  ```ts
  { role: 'system', content: string }
  ```

- **User**: Human inputs supporting text and files

  ```ts
  { role: 'user', content: Array<LanguageModelV3TextPart | LanguageModelV3FilePart> }
  ```

- **Assistant**: Model outputs with full content type support

  ```ts
  { role: 'assistant', content: Array<LanguageModelV3TextPart | LanguageModelV3FilePart | LanguageModelV3ReasoningPart | LanguageModelV3ToolCallPart> }
  ```

- **Tool**: Results from tool executions
  ```ts
  { role: 'tool', content: Array<LanguageModelV3ToolResultPart> }
  ```

#### Prompt Parts

Prompt parts are the building blocks of messages in the prompt structure. While `LanguageModelV3Content` represents the model's output content, prompt parts are specifically designed for constructing input messages. Each message role supports different types of prompt parts:

- **System messages**: Only support text content
- **User messages**: Support text and file parts
- **Assistant messages**: Support text, file, reasoning, and tool call parts
- **Tool messages**: Only support tool result parts

Let's explore each prompt part type:

##### Text Parts

The most basic prompt part, containing plain text content:

```ts
interface LanguageModelV3TextPart {
  type: 'text';
  text: string;
  providerOptions?: SharedV2ProviderOptions;
}
```

##### Reasoning Parts

Used in assistant messages to capture the model's reasoning process:

```ts
interface LanguageModelV3ReasoningPart {
  type: 'reasoning';
  text: string;
  providerOptions?: SharedV2ProviderOptions;
}
```

##### File Parts

Enable multimodal inputs by including files in prompts:

```ts
interface LanguageModelV3FilePart {
  type: 'file';
  filename?: string;
  data: LanguageModelV3DataContent;
  mediaType: string;
  providerOptions?: SharedV2ProviderOptions;
}
```

The `data` field offers flexibility:

- **Uint8Array**: Direct binary data
- **string**: Base64-encoded data
- **URL**: Reference to external content (if supported by provider via `supportedUrls`)

##### Tool Call Parts

Represent tool calls made by the assistant:

```ts
interface LanguageModelV3ToolCallPart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: unknown;
  providerOptions?: SharedV2ProviderOptions;
}
```

##### Tool Result Parts

Contain the results of executed tool calls:

```ts
interface LanguageModelV3ToolResultPart {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  result: unknown;
  isError?: boolean;
  content?: Array<{
    type: 'text' | 'image';
    text?: string;
    data?: string; // base64 encoded image data
    mediaType?: string;
  }>;
  providerOptions?: SharedV2ProviderOptions;
}
```

The optional `content` field enables rich tool results including images, providing more flexibility than the basic `result` field.

### Streaming

#### Stream Parts

The streaming system uses typed events for different stages:

1. **Stream Lifecycle Events**:

   - `stream-start`: Initial event with any warnings about unsupported features
   - `response-metadata`: Model information and response headers
   - `finish`: Final event with usage statistics and finish reason
   - `error`: Error events that can occur at any point

2. **Content Events**:
   - All content types (`text`, `file`, `reasoning`, `source`, `tool-call`) stream directly
   - `tool-call-delta`: Incremental updates for tool call arguments
   - `reasoning-part-finish`: Explicit marker for reasoning section completion

Example stream sequence:

```ts
{ type: 'stream-start', warnings: [] }
{ type: 'text', text: 'Hello' }
{ type: 'text', text: ' world' }
{ type: 'tool-call', toolCallId: '1', toolName: 'search', args: {...} }
{ type: 'response-metadata', modelId: 'gpt-4.1', ... }
{ type: 'finish', usage: { inputTokens: 10, outputTokens: 20 }, finishReason: 'stop' }
```

#### Usage Tracking

Enhanced usage information:

```ts
type LanguageModelV3Usage = {
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  totalTokens: number | undefined;
  reasoningTokens?: number | undefined;
  cachedInputTokens?: number | undefined;
};
```

### Tools

The V3 specification supports two types of tools:

#### Function Tools

Standard user-defined functions with JSON Schema validation:

```ts
type LanguageModelV3FunctionTool = {
  type: 'function';
  name: string;
  description?: string;
  parameters: JSONSchema7; // Full JSON Schema support
};
```

#### Provider-Defined Client Tools

Native provider capabilities exposed as tools:

```ts
export type LanguageModelV3ProviderClientDefinedTool = {
  type: 'provider-defined-client';
  id: string; // e.g., 'anthropic.computer-use'
  name: string; // Human-readable name
  args: Record<string, unknown>;
};
```

Tool choice can be controlled via:

```ts
toolChoice: 'auto' | 'none' | 'required' | { type: 'tool', toolName: string };
```

### Native URL Support

Providers can declare URLs they can access directly:

```ts
supportedUrls: {
  'image/*': [/^https:\/\/cdn\.example\.com\/.*/],
  'application/pdf': [/^https:\/\/docs\.example\.com\/.*/],
  'audio/*': [/^https:\/\/media\.example\.com\/.*/]
}
```

The AI SDK checks these patterns before downloading any URL-based content.

### Provider Options

The specification includes a flexible system for provider-specific features without breaking the standard interface:

```ts
providerOptions: {
  anthropic: {
    cacheControl: true,
    maxTokens: 4096
  },
  openai: {
    parallelToolCalls: false,
    responseFormat: { type: 'json_object' }
  }
}
```

Provider options can be specified at multiple levels:

- **Call level**: In `LanguageModelV3CallOptions`
- **Message level**: On individual messages
- **Part level**: On specific content parts (text, file, etc.)

This layered approach allows fine-grained control while maintaining compatibility.

### Error Handling

The V2 specification emphasizes robust error handling:

1. **Streaming Errors**: Can be emitted at any point via `{ type: 'error', error: unknown }`
2. **Warnings**: Non-fatal issues reported in `stream-start` and response objects
3. **Finish Reasons**: Clear indication of why generation stopped:
   - `'stop'`: Natural completion
   - `'length'`: Hit max tokens
   - `'content-filter'`: Safety filtering
   - `'tool-calls'`: Stopped to execute tools
   - `'error'`: Generation failed
   - `'other'`: Provider-specific reasons

## Provider Implementation Guide

To implement a custom language model provider, you'll need to install the required packages:

```bash
npm install @ai-sdk/provider @ai-sdk/provider-utils
```

Implementing a custom language model provider involves several steps:

- Creating an entry point
- Adding a language model implementation
- Mapping the input (prompt, tools, settings)
- Processing the results (generate, streaming, tool calls)
- Supporting object generation

<Note>
  The best way to get started is to use the [Mistral
  provider](https://github.com/vercel/ai/tree/main/packages/mistral) as a
  reference implementation.
</Note>

### Step 1: Create the Provider Entry Point

Start by creating a `provider.ts` file that exports a factory function and a default instance:

```ts filename="provider.ts"
import {
  generateId,
  loadApiKey,
  withoutTrailingSlash,
} from '@ai-sdk/provider-utils';
import { ProviderV3 } from '@ai-sdk/provider';
import { CustomChatLanguageModel } from './custom-chat-language-model';

// Define your provider interface extending ProviderV3
interface CustomProvider extends ProviderV3 {
  (modelId: string, settings?: CustomChatSettings): CustomChatLanguageModel;

  // Add specific methods for different model types
  languageModel(
    modelId: string,
    settings?: CustomChatSettings,
  ): CustomChatLanguageModel;
}

// Provider settings
interface CustomProviderSettings {
  /**
   * Base URL for API calls
   */
  baseURL?: string;

  /**
   * API key for authentication
   */
  apiKey?: string;

  /**
   * Custom headers for requests
   */
  headers?: Record<string, string>;
}

// Factory function to create provider instance
function createCustom(options: CustomProviderSettings = {}): CustomProvider {
  const createChatModel = (
    modelId: string,
    settings: CustomChatSettings = {},
  ) =>
    new CustomChatLanguageModel(modelId, settings, {
      provider: 'custom',
      baseURL:
        withoutTrailingSlash(options.baseURL) ?? 'https://api.custom.ai/v1',
      headers: () => ({
        Authorization: `Bearer ${loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'CUSTOM_API_KEY',
          description: 'Custom Provider',
        })}`,
        ...options.headers,
      }),
      generateId: options.generateId ?? generateId,
    });

  const provider = function (modelId: string, settings?: CustomChatSettings) {
    if (new.target) {
      throw new Error(
        'The model factory function cannot be called with the new keyword.',
      );
    }

    return createChatModel(modelId, settings);
  };

  provider.languageModel = createChatModel;

  return provider as CustomProvider;
}

// Export default provider instance
const custom = createCustom();
```

### Step 2: Implement the Language Model

Create a `custom-chat-language-model.ts` file that implements `LanguageModelV3`:

```ts filename="custom-chat-language-model.ts"
import { LanguageModelV3, LanguageModelV3CallOptions } from '@ai-sdk/provider';
import { postJsonToApi } from '@ai-sdk/provider-utils';

class CustomChatLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = 'V3';
  readonly provider: string;
  readonly modelId: string;

  constructor(
    modelId: string,
    settings: CustomChatSettings,
    config: CustomChatConfig,
  ) {
    this.provider = config.provider;
    this.modelId = modelId;
    // Initialize with settings and config
  }

  // Convert AI SDK prompt to provider format
  private getArgs(options: LanguageModelV3CallOptions) {
    const warnings: SharedV3Warning[] = [];

    // Map messages to provider format
    const messages = this.convertToProviderMessages(options.prompt);

    // Handle tools if provided
    const tools = options.tools
      ? this.prepareTools(options.tools, options.toolChoice)
      : undefined;

    // Build request body
    const body = {
      model: this.modelId,
      messages,
      temperature: options.temperature,
      max_tokens: options.maxOutputTokens,
      stop: options.stopSequences,
      tools,
      // ... other parameters
    };

    return { args: body, warnings };
  }

  async doGenerate(options: LanguageModelV3CallOptions) {
    const { args, warnings } = this.getArgs(options);

    // Make API call
    const response = await postJsonToApi({
      url: `${this.config.baseURL}/chat/completions`,
      headers: this.config.headers(),
      body: args,
      abortSignal: options.abortSignal,
    });

    // Convert provider response to AI SDK format
    const content: LanguageModelV3Content[] = [];

    // Extract text content
    if (response.choices[0].message.content) {
      content.push({
        type: 'text',
        text: response.choices[0].message.content,
      });
    }

    // Extract tool calls
    if (response.choices[0].message.tool_calls) {
      for (const toolCall of response.choices[0].message.tool_calls) {
        content.push({
          type: 'tool-call',
          toolCallType: 'function',
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
          args: JSON.stringify(toolCall.function.arguments),
        });
      }
    }

    return {
      content,
      finishReason: this.mapFinishReason(response.choices[0].finish_reason),
      usage: {
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens,
      },
      request: { body: args },
      response: { body: response },
      warnings,
    };
  }

  async doStream(options: LanguageModelV3CallOptions) {
    const { args, warnings } = this.getArgs(options);

    // Create streaming response
    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        ...this.config.headers(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...args, stream: true }),
      signal: options.abortSignal,
    });

    // Transform stream to AI SDK format
    const stream = response
      .body!.pipeThrough(new TextDecoderStream())
      .pipeThrough(this.createParser())
      .pipeThrough(this.createTransformer(warnings));

    return { stream, warnings };
  }

  // Supported URL patterns for native file handling
  get supportedUrls() {
    return {
      'image/*': [/^https:\/\/example\.com\/images\/.*/],
    };
  }
}
```

### Step 3: Implement Message Conversion

Map AI SDK messages to your provider's format:

```ts filename="custom-chat-language-model.ts#L50-100"
private convertToProviderMessages(prompt: LanguageModelV3Prompt) {
  return prompt.map((message) => {
    switch (message.role) {
      case 'system':
        return { role: 'system', content: message.content };

      case 'user':
        return {
          role: 'user',
          content: message.content.map((part) => {
            switch (part.type) {
              case 'text':
                return { type: 'text', text: part.text };
              case 'file':
                return {
                  type: 'image_url',
                  image_url: {
                    url: this.convertFileToUrl(part.data),
                  },
                };
              default:
                throw new Error(`Unsupported part type: ${part.type}`);
            }
          }),
        };

      case 'assistant':
        // Handle assistant messages with text, tool calls, etc.
        return this.convertAssistantMessage(message);

      case 'tool':
        // Handle tool results
        return this.convertToolMessage(message);

      default:
        throw new Error(`Unsupported message role: ${message.role}`);
    }
  });
}
```

### Step 4: Implement Streaming

Create a streaming transformer that converts provider chunks to AI SDK stream parts:

```ts filename="custom-chat-language-model.ts#L150-200"
private createTransformer(warnings: SharedV3Warning[]) {
  let isFirstChunk = true;

  return new TransformStream<ParsedChunk, LanguageModelV3StreamPart>({
    async transform(chunk, controller) {
      // Send warnings with first chunk
      if (isFirstChunk) {
        controller.enqueue({ type: 'stream-start', warnings });
        isFirstChunk = false;
      }

      // Handle different chunk types
      if (chunk.choices?.[0]?.delta?.content) {
        controller.enqueue({
          type: 'text',
          text: chunk.choices[0].delta.content,
        });
      }

      if (chunk.choices?.[0]?.delta?.tool_calls) {
        for (const toolCall of chunk.choices[0].delta.tool_calls) {
          controller.enqueue({
            type: 'tool-call-delta',
            toolCallType: 'function',
            toolCallId: toolCall.id,
            toolName: toolCall.function.name,
            argsTextDelta: toolCall.function.arguments,
          });
        }
      }

      // Handle finish reason
      if (chunk.choices?.[0]?.finish_reason) {
        controller.enqueue({
          type: 'finish',
          finishReason: this.mapFinishReason(chunk.choices[0].finish_reason),
          usage: {
            inputTokens: chunk.usage?.prompt_tokens,
            outputTokens: chunk.usage?.completion_tokens,
            totalTokens: chunk.usage?.total_tokens,
          },
        });
      }
    },
  });
}
```

### Step 5: Handle Errors

Use standardized AI SDK errors for consistent error handling:

```ts filename="custom-chat-language-model.ts#L250-280"
import {
  APICallError,
  InvalidResponseDataError,
  TooManyRequestsError,
} from '@ai-sdk/provider';

private handleError(error: unknown): never {
  if (error instanceof Response) {
    const status = error.status;

    if (status === 429) {
      throw new TooManyRequestsError({
        cause: error,
        retryAfter: this.getRetryAfter(error),
      });
    }

    throw new APICallError({
      statusCode: status,
      statusText: error.statusText,
      cause: error,
      isRetryable: status >= 500 && status < 600,
    });
  }

  throw error;
}
```

## Next Steps

- Dig into the [Language Model Specification V3](https://github.com/vercel/ai/tree/main/packages/provider/src/language-model/v3)
- Check out the [Mistral provider](https://github.com/vercel/ai/tree/main/packages/mistral) reference implementation
- Check out [provider utilities](https://github.com/vercel/ai/tree/main/packages/provider-utils) for helpful functions
- Test your provider with the AI SDK's built-in examples
- Explore the V2 types in detail at [`@ai-sdk/provider`](https://github.com/vercel/ai/tree/main/packages/provider/src/language-model/V2)



# Writing a Custom Provider

You can create your own provider package that leverages the AI SDK's [OpenAI Compatible package](https://www.npmjs.com/package/@ai-sdk/openai-compatible). Publishing your provider package to [npm](https://www.npmjs.com/) can give users an easy way to use the provider's models and stay up to date with any changes you may have. Here's an example structure:

### File Structure

```bash
packages/example/
├── src/
│   ├── example-chat-settings.ts       # Chat model types and settings
│   ├── example-completion-settings.ts # Completion model types and settings
│   ├── example-embedding-settings.ts  # Embedding model types and settings
│   ├── example-image-settings.ts      # Image model types and settings
│   ├── example-provider.ts            # Main provider implementation
│   ├── example-provider.test.ts       # Provider tests
│   └── index.ts                       # Public exports
├── package.json
├── tsconfig.json
├── tsup.config.ts                     # Build configuration
└── README.md
```

### Key Files

1. **example-chat-settings.ts** - Define chat model IDs and settings:

```ts
export type ExampleChatModelId =
  | 'example/chat-model-1'
  | 'example/chat-model-2'
  | (string & {});
```

The completion, embedding, and image settings are implemented similarly to the chat settings.

2. **example-provider.ts** - Main provider implementation:

```ts
import { LanguageModelV1, EmbeddingModelV3 } from '@ai-sdk/provider';
import {
  OpenAICompatibleChatLanguageModel,
  OpenAICompatibleCompletionLanguageModel,
  OpenAICompatibleEmbeddingModel,
  OpenAICompatibleImageModel,
} from '@ai-sdk/openai-compatible';
import {
  FetchFunction,
  loadApiKey,
  withoutTrailingSlash,
} from '@ai-sdk/provider-utils';
// Import your model id and settings here.

export interface ExampleProviderSettings {
  /**
Example API key.
*/
  apiKey?: string;
  /**
Base URL for the API calls.
*/
  baseURL?: string;
  /**
Custom headers to include in the requests.
*/
  headers?: Record<string, string>;
  /**
Optional custom url query parameters to include in request urls.
*/
  queryParams?: Record<string, string>;
  /**
Custom fetch implementation. You can use it as a middleware to intercept requests,
or to provide a custom fetch implementation for e.g. testing.
*/
  fetch?: FetchFunction;
}

export interface ExampleProvider {
  /**
Creates a model for text generation.
*/
  (
    modelId: ExampleChatModelId,
    settings?: ExampleChatSettings,
  ): LanguageModelV1;

  /**
Creates a chat model for text generation.
*/
  chatModel(
    modelId: ExampleChatModelId,
    settings?: ExampleChatSettings,
  ): LanguageModelV1;

  /**
Creates a completion model for text generation.
*/
  completionModel(
    modelId: ExampleCompletionModelId,
    settings?: ExampleCompletionSettings,
  ): LanguageModelV1;

  /**
Creates a text embedding model for text generation.
*/
  .embeddingModel(
    modelId: ExampleEmbeddingModelId,
    settings?: ExampleEmbeddingSettings,
  ): EmbeddingModelV3<string>;

  /**
Creates an image model for image generation.
*/
  imageModel(
    modelId: ExampleImageModelId,
    settings?: ExampleImageSettings,
  ): ImageModelV3;
}

export function createExample(
  options: ExampleProviderSettings = {},
): ExampleProvider {
  const baseURL = withoutTrailingSlash(
    options.baseURL ?? 'https://api.example.com/v1',
  );
  const getHeaders = () => ({
    Authorization: `Bearer ${loadApiKey({
      apiKey: options.apiKey,
      environmentVariableName: 'EXAMPLE_API_KEY',
      description: 'Example API key',
    })}`,
    ...options.headers,
  });

  interface CommonModelConfig {
    provider: string;
    url: ({ path }: { path: string }) => string;
    headers: () => Record<string, string>;
    fetch?: FetchFunction;
  }

  const getCommonModelConfig = (modelType: string): CommonModelConfig => ({
    provider: `example.${modelType}`,
    url: ({ path }) => {
      const url = new URL(`${baseURL}${path}`);
      if (options.queryParams) {
        url.search = new URLSearchParams(options.queryParams).toString();
      }
      return url.toString();
    },
    headers: getHeaders,
    fetch: options.fetch,
  });

  const createChatModel = (
    modelId: ExampleChatModelId,
    settings: ExampleChatSettings = {},
  ) => {
    return new OpenAICompatibleChatLanguageModel(
      modelId,
      settings,
      getCommonModelConfig('chat'),
    );
  };

  const createCompletionModel = (
    modelId: ExampleCompletionModelId,
    settings: ExampleCompletionSettings = {},
  ) =>
    new OpenAICompatibleCompletionLanguageModel(
      modelId,
      settings,
      getCommonModelConfig('completion'),
    );

  const create.embeddingModel = (
    modelId: ExampleEmbeddingModelId,
    settings: ExampleEmbeddingSettings = {},
  ) =>
    new OpenAICompatibleEmbeddingModel(
      modelId,
      settings,
      getCommonModelConfig('embedding'),
    );

  const createImageModel = (
    modelId: ExampleImageModelId,
    settings: ExampleImageSettings = {},
  ) =>
    new OpenAICompatibleImageModel(
      modelId,
      settings,
      getCommonModelConfig('image'),
    );

  const provider = (
    modelId: ExampleChatModelId,
    settings?: ExampleChatSettings,
  ) => createChatModel(modelId, settings);

  provider.completionModel = createCompletionModel;
  provider.chatModel = createChatModel;
  provider.embeddingModel = create.embeddingModel;
  provider.imageModel = createImageModel;

  return provider;
}

// Export default instance
export const example = createExample();
```

3. **index.ts** - Public exports:

```ts
export { createExample, example } from './example-provider';
export type {
  ExampleProvider,
  ExampleProviderSettings,
} from './example-provider';
```

4. **package.json** - Package configuration:

```js
{
  "name": "@company-name/example",
  "version": "0.0.1",
  "dependencies": {
    "@ai-sdk/openai-compatible": "^0.0.7",
    "@ai-sdk/provider": "^1.0.2",
    "@ai-sdk/provider-utils": "^2.0.4",
    // ...additional dependencies
  },
  // ...additional scripts and module build configuration
}
```

### Usage

Once published, users can use your provider like this:

```ts
import { example } from '@company-name/example';
import { generateText } from 'ai';

const { text } = await generateText({
  model: example('example/chat-model-1'),
  prompt: 'Hello, how are you?',
});
```

This structure provides a clean, type-safe implementation that leverages the OpenAI Compatible package while maintaining consistency with the usage of other AI SDK providers.

### Internal API

As you work on your provider you may need to use some of the internal API of the OpenAI Compatible package. You can import these from the `@ai-sdk/openai-compatible/internal` package, for example:

```ts
import { convertToOpenAICompatibleChatMessages } from '@ai-sdk/openai-compatible/internal';
```

You can see the latest available exports in the AI SDK [GitHub repository](https://github.com/vercel/ai/blob/main/packages/openai-compatible/src/internal/index.ts).


---
title: Chatbot
description: An example of how to use the AI Elements to build a chatbot.
---

An example of how to use the AI Elements to build a chatbot.

<Preview path="chatbot" type="block" className="p-0" />

## Tutorial

Let's walk through how to build a chatbot using AI Elements and AI SDK. Our example will include reasoning, web search with citations, and a model picker.

### Setup

First, set up a new Next.js repo and cd into it by running the following command (make sure you choose to use Tailwind the project setup):

```bash title="Terminal"
npx create-next-app@latest ai-chatbot && cd ai-chatbot
```

Run the following command to install AI Elements. This will also set up shadcn/ui if you haven't already configured it:

```bash title="Terminal"
npx ai-elements@latest
```

Now, install the AI SDK dependencies:

```package-install
npm i ai @ai-sdk/react zod
```

In order to use the providers, let's configure an AI Gateway API key. Create a `.env.local` in your root directory and navigate [here](https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%2Fapi-keys&title=Get%20your%20AI%20Gateway%20key) to create a token, then paste it in your `.env.local`.

We're now ready to start building our app!

### Client

In your `app/page.tsx`, replace the code with the file below.

Here, we use the `PromptInput` component with its compound components to build a rich input experience with file attachments, model picker, and action menu. The input component uses the new `PromptInputMessage` type for handling both text and file attachments.

The whole chat lives in a `Conversation`. We switch on `message.parts` and render the respective part within `Message`, `Reasoning`, and `Sources`. We also use `status` from `useChat` to stream reasoning tokens, as well as render `Loader`.

```tsx title="app/page.tsx"
'use client';

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputButton,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input';
import { Fragment, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { CopyIcon, GlobeIcon, RefreshCcwIcon } from 'lucide-react';
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@/components/ai-elements/sources';
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning';
import { Loader } from '@/components/ai-elements/loader';

const models = [
  {
    name: 'GPT 4o',
    value: 'openai/gpt-4o',
  },
  {
    name: 'Deepseek R1',
    value: 'deepseek/deepseek-r1',
  },
];

const ChatBotDemo = () => {
  const [input, setInput] = useState('');
  const [model, setModel] = useState<string>(models[0].value);
  const [webSearch, setWebSearch] = useState(false);
  const { messages, sendMessage, status, regenerate } = useChat();

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    sendMessage(
      { 
        text: message.text || 'Sent with attachments',
        files: message.files 
      },
      {
        body: {
          model: model,
          webSearch: webSearch,
        },
      },
    );
    setInput('');
  };

  return (
    <div className="max-w-4xl mx-auto p-6 relative size-full h-screen">
      <div className="flex flex-col h-full">
        <Conversation className="h-full">
          <ConversationContent>
            {messages.map((message) => (
              <div key={message.id}>
                {message.role === 'assistant' && message.parts.filter((part) => part.type === 'source-url').length > 0 && (
                  <Sources>
                    <SourcesTrigger
                      count={
                        message.parts.filter(
                          (part) => part.type === 'source-url',
                        ).length
                      }
                    />
                    {message.parts.filter((part) => part.type === 'source-url').map((part, i) => (
                      <SourcesContent key={`${message.id}-${i}`}>
                        <Source
                          key={`${message.id}-${i}`}
                          href={part.url}
                          title={part.url}
                        />
                      </SourcesContent>
                    ))}
                  </Sources>
                )}
                {message.parts.map((part, i) => {
                  switch (part.type) {
                    case 'text':
                      return (
                        <Message key={`${message.id}-${i}`} from={message.role}>
                          <MessageContent>
                            <MessageResponse>
                              {part.text}
                            </MessageResponse>
                          </MessageContent>
                          {message.role === 'assistant' && i === messages.length - 1 && (
                            <MessageActions>
                              <MessageAction
                                onClick={() => regenerate()}
                                label="Retry"
                              >
                                <RefreshCcwIcon className="size-3" />
                              </MessageAction>
                              <MessageAction
                                onClick={() =>
                                  navigator.clipboard.writeText(part.text)
                                }
                                label="Copy"
                              >
                                <CopyIcon className="size-3" />
                              </MessageAction>
                            </MessageActions>
                          )}
                        </Message>
                      );
                    case 'reasoning':
                      return (
                        <Reasoning
                          key={`${message.id}-${i}`}
                          className="w-full"
                          isStreaming={status === 'streaming' && i === message.parts.length - 1 && message.id === messages.at(-1)?.id}
                        >
                          <ReasoningTrigger />
                          <ReasoningContent>{part.text}</ReasoningContent>
                        </Reasoning>
                      );
                    default:
                      return null;
                  }
                })}
              </div>
            ))}
            {status === 'submitted' && <Loader />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <PromptInput onSubmit={handleSubmit} className="mt-4" globalDrop multiple>
          <PromptInputHeader>
            <PromptInputAttachments>
              {(attachment) => <PromptInputAttachment data={attachment} />}
            </PromptInputAttachments>
          </PromptInputHeader>
          <PromptInputBody>
            <PromptInputTextarea
              onChange={(e) => setInput(e.target.value)}
              value={input}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
              <PromptInputButton
                variant={webSearch ? 'default' : 'ghost'}
                onClick={() => setWebSearch(!webSearch)}
              >
                <GlobeIcon size={16} />
                <span>Search</span>
              </PromptInputButton>
              <PromptInputSelect
                onValueChange={(value) => {
                  setModel(value);
                }}
                value={model}
              >
                <PromptInputSelectTrigger>
                  <PromptInputSelectValue />
                </PromptInputSelectTrigger>
                <PromptInputSelectContent>
                  {models.map((model) => (
                    <PromptInputSelectItem key={model.value} value={model.value}>
                      {model.name}
                    </PromptInputSelectItem>
                  ))}
                </PromptInputSelectContent>
              </PromptInputSelect>
            </PromptInputTools>
            <PromptInputSubmit disabled={!input && !status} status={status} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
};

export default ChatBotDemo;
```

### Server

Create a new route handler `app/api/chat/route.ts` and paste in the following code. We're using `perplexity/sonar` for web search because by default the model returns search results. We also pass `sendSources` and `sendReasoning` to `toUIMessageStreamResponse` in order to receive as parts on the frontend. The handler now also accepts file attachments from the client.

```ts title="app/api/chat/route.ts"
import { streamText, UIMessage, convertToModelMessages } from 'ai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    messages,
    model,
    webSearch,
  }: { 
    messages: UIMessage[]; 
    model: string; 
    webSearch: boolean;
  } = await req.json();

  const result = streamText({
    model: webSearch ? 'perplexity/sonar' : model,
    messages: convertToModelMessages(messages),
    system:
      'You are a helpful assistant that can answer questions and help with tasks',
  });

  // send sources and reasoning back to the client
  return result.toUIMessageStreamResponse({
    sendSources: true,
    sendReasoning: true,
  });
}
```

You now have a working chatbot app with file attachment support! The chatbot can handle both text and file inputs through the action menu. Feel free to explore other components like [`Tool`](/elements/components/tool) or [`Task`](/elements/components/task) to extend your app, or view the other examples.