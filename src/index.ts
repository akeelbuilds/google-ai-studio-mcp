import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerVideoGenTool } from "./tools/video-gen.js";
import { registerImageGenTool } from "./tools/image-gen.js";
import { registerContentGenTool } from "./tools/content-gen.js";
import { registerManageOutputsTool } from "./tools/manage-outputs.js";

async function main() {
    const server = new McpServer({
        name: "google-ai-studio-mcp",
        version: "1.2.0",
    });

    registerVideoGenTool(server);
    registerImageGenTool(server);
    registerContentGenTool(server);
    registerManageOutputsTool(server);

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Google AI Studio MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
