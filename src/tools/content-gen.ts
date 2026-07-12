import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ai } from "../gemini-client.js";

export function registerContentGenTool(server: McpServer) {
    server.tool("googleaistudio_generate_content", {
        prompt: z.string().describe("The prompt to send to the model."),
        model: z.string().default("gemini-2.5-flash").describe("The text model to use. e.g. gemini-2.5-flash (fast, default), gemini-2.5-pro (highest quality), or gemini-flash-latest."),
        systemInstruction: z.string().optional().describe("System instructions for the model."),
        temperature: z.number().optional().describe("Temperature for generation."),
        thinkingLevel: z.enum(["minimal", "low", "medium", "high"]).optional().describe("Thinking level (for supported Gemini models)."),
    }, async ({ prompt, model, systemInstruction, temperature, thinkingLevel }) => {
        try {
            const config: Record<string, unknown> = {};
            if (systemInstruction) config.systemInstruction = systemInstruction;
            if (temperature !== undefined) config.temperature = temperature;
            if (thinkingLevel) config.thinkingConfig = { thinkingLevel };

            const response = await ai.models.generateContent({
                model,
                contents: prompt,
                config
            });

            return {
                content: [{ type: "text", text: response.text || "No response generated." }]
            };
        } catch (error: any) {
            return {
                content: [{ type: "text", text: `Error generating content: ${error.message || String(error)}` }],
                isError: true,
            };
        }
    });
}
