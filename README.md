# Smithery Typescript Framework [![npm version](https://badge.fury.io/js/@smithery%2Fsdk.svg)](https://badge.fury.io/js/@smithery%2Fsdk)

Smithery is a Typescript framework with utilities to make it easier to connect language models (LLMs) to [Model Context Protocols](https://modelcontextprotocol.io/) (MCPs), allowing you to build agents that use resources and tools without being overwhelmed by JSON schemas.

⚠️ _This repository is work in progress and in alpha. Not recommended for production use yet._ ⚠️

**Key Features**

- Connect to multiple MCPs with a single client
- Adapters to transform MCP responses for OpenAI and Anthropic clients
- Supports chaining tool calls until LLM completes

To find our registry of MCPs, visit [https://smithery.ai/](https://smithery.ai/).

# Quickstart

## Installation

```bash
npm install @smithery/sdk
```

## Usage

In this example, we'll connect use OpenAI client with Exa search capabilities.

```bash
npm install @smithery/mcp-exa
```

The following code sets up OpenAI and connects to an Exa MCP server. In this case, we're running the server locally within the same process, so it's just a simple passthrough.

```typescript
import { MultiClient } from "@smithery/sdk"
import { OpenAIChatAdapter } from "@smithery/sdk/integrations/llm/openai"
import * as exa from "@smithery/mcp-exa"
import { OpenAI } from "openai"
import { createTransport } from "@smithery/sdk/registry"

const openai = new OpenAI()
const exaServer = exa.createServer({
  apiKey: process.env.EXA_API_KEY,
})

const sequentialThinking = await createTransport(
  "@modelcontextprotocol/server-sequential-thinking",
)
const client = new MultiClient()
await client.connectAll({
  exa: exaServer,
  sequentialThinking: sequentialThinking,
})
```

Now you can make your LLM aware of the available tools from Exa.

```typescript
// Create an adapter
const adapter = new OpenAIChatAdapter(client)
const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "In 2024, did OpenAI release GPT-5?" }],
  // Pass the tools to OpenAI call
  tools: await adapter.listTools(),
})
// Obtain the tool outputs as new messages
const toolMessages = await adapter.callTool(response)
```

Using this, you can easily enable your LLM to call tools and obtain the results.

However, it's often the case where your LLM needs to call a tool, see its response, and continue processing output of the tool in order to give you a final response.

In this case, you have to loop your LLM call and update your messages until there are no more toolMessages to continue.

Example:

```typescript
let messages = [
  {
    role: "user",
    content:
      "Deduce Obama's age in number of days. It's November 28, 2024 today. Search to ensure correctness.",
  },
]
const adapter = new OpenAIChatAdapter(client)

while (!isDone) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    tools: await adapter.listTools(),
  })
  // Handle tool calls
  const toolMessages = await adapter.callTool(response)

  // Append new messages
  messages.push(response.choices[0].message)
  messages.push(...toolMessages)
  isDone = toolMessages.length === 0
}
```

See a full example in the [examples](./src/examples) directory.

# Troubleshooting

```
Error: ReferenceError: EventSource is not defined
```

This event means you're trying to use EventSource API (which is typically used in the browser) from Node. You'll have to install the following to use it:

```bash
npm install eventsource
npm install -D @types/eventsource
```

Patch the global EventSource object:

```typescript
import EventSource from "eventsource"
global.EventSource = EventSource as any
