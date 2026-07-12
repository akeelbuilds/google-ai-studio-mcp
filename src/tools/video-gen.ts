import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ai, activeVideoOperations, geminiApiKey } from "../gemini-client.js";
import { saveBuffer, copyInto, fileUrl, MediaWriteError } from "./media-utils.js";

/** Minimal shape of a long-running video operation we depend on. */
interface VideoOperation {
    name?: string;
    done?: boolean;
    error?: unknown;
    response?: any;
}

/** Narrow view of the SDK's operations API across versions. */
interface OperationsApi {
    get?: (args: { operation: VideoOperation }) => Promise<VideoOperation>;
    getVideosOperation?: (args: { name: string }) => Promise<VideoOperation>;
}

export function registerVideoGenTool(server: McpServer) {
    server.tool("googleaistudio_start_video", {
        prompt: z.string().describe("Description of the video to generate."),
        model: z.string().default("veo-3.1-generate-preview").describe("The model to use (default: veo-3.1-generate-preview)."),
    }, async ({ prompt, model }) => {
        try {
            const operation: VideoOperation = await ai.models.generateVideos({
                model,
                prompt,
            });

            // A nameless operation cannot be polled by check_video, so fail fast
            // rather than storing an unusable synthetic key.
            if (!operation.name) {
                return {
                    content: [{ type: "text", text: "Video generation started but the API returned no operation name to poll. Please retry." }],
                    isError: true,
                };
            }

            activeVideoOperations.set(operation.name, operation);

            return {
                content: [{
                    type: "text",
                    text: `Video generation started!

**Operation ID:** \`${operation.name}\`

Video generation takes 1-5 minutes. Use the \`googleaistudio_check_video\` tool with this Operation ID and a saveDirectory to check progress and download the MP4 when complete. Do not block or wait indefinitely; poll every 30-60 seconds.`
                }]
            };
        } catch (error: any) {
            let errorMessage = error.message || String(error);
            if (error.status === 404 || errorMessage.includes('404')) {
                errorMessage += `\n\nNote: If using Veo, it does not support '-latest' suffix.`;
            }
            return {
                content: [{ type: "text", text: `Error starting video: ${errorMessage}` }],
                isError: true,
            };
        }
    });

    server.tool("googleaistudio_check_video", {
        operationId: z.string().describe("The Operation ID returned by start_video."),
        saveDirectory: z.string().describe("The absolute local directory path where the MP4 should be saved. E.g. C:\\Users\\Name\\Downloads"),
        artifactDirectory: z.string().optional().describe("Optional. The conversation's brain/artifact directory (e.g. <appDataDir>\\brain\\<conversation-id>). If provided, a copy of the MP4 is placed here so it renders inline in the chat UI."),
    }, async ({ operationId, saveDirectory, artifactDirectory }) => {
        try {
            // The in-memory map is an optimization, not a requirement: if the
            // operation isn't cached (e.g. after a server restart) we poll by
            // name using just the Operation ID the caller still holds.
            let operation: VideoOperation = activeVideoOperations.get(operationId) || { name: operationId };
            const operations = (ai as unknown as { operations?: OperationsApi }).operations;

            if (operations?.get) {
                operation = await operations.get({ operation });
            } else if (operations?.getVideosOperation) {
                operation = await operations.getVideosOperation({ name: operation.name || operationId });
            } else {
                return {
                    content: [{ type: "text", text: "SDK polling method not found (expected ai.operations.get or getVideosOperation)." }],
                    isError: true,
                };
            }

            activeVideoOperations.set(operationId, operation);

            if (operation.error) {
                activeVideoOperations.delete(operationId);
                return {
                    content: [{ type: "text", text: `Video generation failed: ${JSON.stringify(operation.error)}` }],
                    isError: true,
                };
            }

            if (!operation.done) {
                return {
                    content: [{ type: "text", text: `Video is still generating... (Operation ID: ${operationId}). Please wait and check again.` }]
                };
            }

            activeVideoOperations.delete(operationId);

            const videoResponse = operation.response;
            const generatedVideos: any[] = videoResponse?.generatedVideos || videoResponse?.videos || [];

            if (generatedVideos.length === 0) {
                return {
                    content: [{ type: "text", text: "Video finished but no videos were returned." }],
                    isError: true,
                };
            }

            const savedLines: string[] = [];
            let renderTarget = "";

            for (const entry of generatedVideos) {
                const videoContent = entry?.video || entry;
                const videoUri: string | undefined = videoContent?.uri;
                const inlineBytes: string | undefined = videoContent?.videoBytes || videoContent?.bytes;

                let buffer: Buffer;
                if (videoUri) {
                    const response = await fetch(videoUri, {
                        headers: { 'x-goog-api-key': geminiApiKey },
                    });
                    if (!response.ok) {
                        savedLines.push(`Failed to download a video: ${response.status} ${response.statusText}`);
                        continue;
                    }
                    buffer = Buffer.from(await response.arrayBuffer());
                } else if (inlineBytes) {
                    buffer = Buffer.from(inlineBytes, "base64");
                } else {
                    savedLines.push("A video finished but had no URI or bytes.");
                    continue;
                }

                try {
                    const { path: savedPath, filename } = saveBuffer(saveDirectory, buffer, "video", "mp4");
                    savedLines.push(`**Saved to:** ${savedPath}`);
                    // Prefer the brain/artifact copy as the render target.
                    if (artifactDirectory) {
                        const artifactPath = copyInto(artifactDirectory, buffer, filename);
                        savedLines.push(`**Artifact copy:** ${artifactPath}`);
                        if (!renderTarget) renderTarget = artifactPath;
                    } else if (!renderTarget) {
                        renderTarget = savedPath;
                    }
                } catch (writeErr) {
                    const msg = writeErr instanceof MediaWriteError ? writeErr.message : String(writeErr);
                    savedLines.push(`Video generated but not saved: ${msg}`);
                }
            }

            const linkLine = renderTarget ? `\n\n[Open video](${fileUrl(renderTarget)})` : "";
            return {
                content: [{
                    type: "text",
                    text: `Video generation complete!\n\n${savedLines.join("\n")}${linkLine}`
                }]
            };
        } catch (error: any) {
            return {
                content: [{ type: "text", text: `Error checking video: ${error.message || String(error)}` }],
                isError: true,
            };
        }
    });
}
