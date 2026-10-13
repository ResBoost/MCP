import { SITE_NAME } from "~/lib/site";

/** Marks drawn by `AssistantIcon`. */
export type AssistantIconKey = "claude" | "openai" | "copilot" | "gemini" | "cursor" | "windsurf" | "mcp";

/**
 * How to connect each assistant to the MCP server, for the /mcp page's picker and its HowTo
 * JSON-LD. Framework-free; the server address is passed in so it's right in every environment.
 */
export interface AssistantGuide {
  key: string;
  name: string;
  maker: string;
  icon: AssistantIconKey;
  steps: string[];
  snippet: { label: string; code: string } | null;
}

/** The name the server is added under in config files and commands. */
const SERVER_KEY = "resboost";

const json = (value: unknown) => JSON.stringify(value, null, 2);

export function assistantGuides(serverUrl: string): AssistantGuide[] {
  return [
    {
      key: "claude",
      name: "Claude",
      maker: "Anthropic",
      icon: "claude",
      steps: [
        "Open Settings → Connectors and choose Add custom connector.",
        `Name it ${SITE_NAME} and paste the server address.`,
        `In a new chat, turn ${SITE_NAME} on from the tools menu and ask about homes for sale.`,
      ],
      snippet: null,
    },
    {
      key: "chatgpt",
      name: "ChatGPT",
      maker: "OpenAI",
      icon: "openai",
      steps: [
        "Open Settings → Apps & Connectors. Custom connectors may need developer mode, under Advanced settings.",
        `Create a connector named ${SITE_NAME}, paste the server address and choose no authentication.`,
        `Add ${SITE_NAME} to a chat from the + menu and ask your question.`,
      ],
      snippet: null,
    },
    {
      key: "copilot",
      name: "GitHub Copilot",
      maker: "GitHub · VS Code",
      icon: "copilot",
      steps: [
        "Add the file below to your project as .vscode/mcp.json, or run “MCP: Add Server” from the command palette.",
        `Start the server, then choose ${SITE_NAME} in Copilot Chat’s tools list (agent mode).`,
      ],
      snippet: {
        label: ".vscode/mcp.json",
        code: json({
          servers: { [SERVER_KEY]: { type: "http", url: serverUrl } },
        }),
      },
    },
    {
      key: "gemini",
      name: "Gemini CLI",
      maker: "Google",
      icon: "gemini",
      steps: [`Add ${SITE_NAME} to ~/.gemini/settings.json as below.`, "Restart Gemini CLI. The /mcp command lists the tools."],
      snippet: {
        label: "~/.gemini/settings.json",
        code: json({ mcpServers: { [SERVER_KEY]: { httpUrl: serverUrl } } }),
      },
    },
    {
      key: "cursor",
      name: "Cursor",
      maker: "Anysphere",
      icon: "cursor",
      steps: ["Open Settings → MCP → Add new MCP server, or edit ~/.cursor/mcp.json as below."],
      snippet: {
        label: "~/.cursor/mcp.json",
        code: json({ mcpServers: { [SERVER_KEY]: { url: serverUrl } } }),
      },
    },
    {
      key: "claude-code",
      name: "Claude Code",
      maker: "Anthropic",
      icon: "claude",
      steps: [`Run the command below once. ${SITE_NAME} is then available in every session.`],
      snippet: {
        label: "Terminal",
        code: `claude mcp add --transport http ${SERVER_KEY} ${serverUrl}`,
      },
    },
    {
      key: "windsurf",
      name: "Windsurf",
      maker: "Cognition",
      icon: "windsurf",
      steps: [`Open the MCP settings and add ${SITE_NAME} to mcp_config.json as below.`],
      snippet: {
        label: "~/.codeium/windsurf/mcp_config.json",
        code: json({ mcpServers: { [SERVER_KEY]: { serverUrl } } }),
      },
    },
    {
      key: "other",
      name: "Any MCP client",
      maker: "Streamable HTTP",
      icon: "mcp",
      steps: [
        "Point your client at the server address over Streamable HTTP. No sign-in or API key.",
        "Connection details are also published in the server card and in /.well-known/mcp/server.json.",
      ],
      snippet: null,
    },
  ];
}

/** The three steps every assistant shares, shown above the picker. */
export const CONNECT_STEPS = [
  "Copy the server address.",
  "Add it as a custom connector or MCP server in your assistant. No sign-in or API key.",
  `Turn ${SITE_NAME} on in a chat and ask about homes for sale.`,
] as const;
