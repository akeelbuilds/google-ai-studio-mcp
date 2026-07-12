import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ai } from "../gemini-client.js";
import { saveBuffer, copyInto, MediaWriteError } from "./media-utils.js";

type ImageContent =
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string };

export function registerImageGenTool(server: McpServer) {
    server.tool("googleaistudio_generate_image", {
        prompt: z.string().describe("Description of the image to generate."),
        saveDirectory: z.string().describe("The absolute local directory path where the generated image should be saved. E.g. C:\\Users\\Name\\Downloads"),
        artifactDirectory: z.string().optional().describe("Optional. The conversation's brain/artifact directory (e.g. <appDataDir>\\brain\\<conversation-id>). If provided, a copy of each image is placed here so it renders inline in the chat UI. Pass the current conversation's artifact directory."),
        model: z.string().default("imagen-4.0-generate-001").describe("The Imagen model to use. e.g. imagen-4.0-generate-001 (standard), imagen-4.0-fast-generate-001 (faster), or imagen-4.0-ultra-generate-001 (highest quality)."),
        aspectRatio: z.enum(["1:1", "3:4", "4:3", "9:16", "16:9"]).optional().describe("Aspect ratio of the image. Will be auto-inferred if omitted."),
        numberOfImages: z.number().min(1).max(4).default(1).describe("Number of images to generate (1-4). Defaults to 1."),
        outputMimeType: z.enum(["image/jpeg", "image/png"]).default("image/jpeg").describe("Output format. Defaults to image/jpeg."),
        personGeneration: z.enum(["DONT_ALLOW", "ALLOW_ADULT"]).optional().describe("Person generation setting."),
    }, async ({ prompt, saveDirectory, artifactDirectory, model, aspectRatio, numberOfImages, outputMimeType, personGeneration }) => {
        try {
            const config: Record<string, unknown> = { numberOfImages, outputMimeType };
            if (aspectRatio) config.aspectRatio = aspectRatio;
            if (personGeneration) config.personGeneration = personGeneration;

            const response = await ai.models.generateImages({
                model,
                prompt,
                config,
            });

            const content: ImageContent[] = [];
            const ext = outputMimeType === "image/png" ? "png" : "jpeg";

            for (const image of response.generatedImages || []) {
                if (!image.image?.imageBytes) continue;

                const base64 = image.image.imageBytes;
                const buffer = Buffer.from(base64, "base64");

                // Native MCP image block: renders inline in hosts that support it.
                content.push({ type: "image", data: base64, mimeType: outputMimeType });

                // Persist to disk; attribute write failures to the save step.
                try {
                    const { path: savedPath, filename } = saveBuffer(saveDirectory, buffer, "image", ext);
                    const lines = [`**Saved to:** ${savedPath}`];

                    // Also copy into the brain/artifact dir so the file-based
                    // Artifact UI renders it even if native blocks are ignored.
                    if (artifactDirectory) {
                        const artifactPath = copyInto(artifactDirectory, buffer, filename);
                        lines.push(`**Artifact copy:** ${artifactPath}`);
                    }
                    content.push({ type: "text", text: lines.join("\n") });
                } catch (writeErr) {
                    const msg = writeErr instanceof MediaWriteError ? writeErr.message : String(writeErr);
                    content.push({ type: "text", text: `Image generated but not saved: ${msg}` });
                }
            }

            if (content.length === 0) {
                content.push({ type: "text", text: "No images were returned by the API." });
            }

            return { content };
        } catch (error: any) {
            let errorMessage = error.message || String(error);
            if (error.status === 404 || errorMessage.includes('404')) {
                errorMessage += `\n\nNote: Make sure the model exists and is available on your API key (e.g. imagen-4.0-generate-001). Older imagen-3.0 models may not be enabled.`;
            }
            return {
                content: [{ type: "text", text: `Error generating image: ${errorMessage}` }],
                isError: true,
            };
        }
    });
}
