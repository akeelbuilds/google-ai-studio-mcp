import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY environment variable is missing.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

const server = new Server(
  {
    name: "google-ai-studio-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "googleaistudio_generate_content",
        description: "Generate text or content using Gemini models.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "The prompt to send to the model." },
            model: { type: "string", description: "The model to use (default: gemini-1.5-pro)." },
            systemInstruction: { type: "string", description: "System instructions for the model." },
            temperature: { type: "number", description: "Temperature for generation." }
          },
          required: ["prompt"]
        }
      },
      {
        name: "googleaistudio_generate_image",
        description: "Generate images using Imagen models.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "The prompt for the image." },
            model: { type: "string", description: "The model to use (default: imagen-3.0-generate-001)." },
            aspectRatio: { type: "string", enum: ["1:1", "3:4", "4:3", "9:16", "16:9"], description: "Aspect ratio of the image." },
            numberOfImages: { type: "number", description: "Number of images to generate (1-4)." },
            outputMimeType: { type: "string", enum: ["image/jpeg", "image/png"], description: "Output format." },
            personGeneration: { type: "string", enum: ["DONT_ALLOW", "ALLOW_ADULT"], description: "Person generation setting." }
          },
          required: ["prompt"]
        }
      },
      {
        name: "googleaistudio_generate_video",
        description: "Generate videos using Veo models. Note: Veo access is restricted to approved API keys.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "The prompt for the video." },
            model: { type: "string", description: "The model to use (default: veo-3.1-generate-preview)." },
            project_workspace_path: { type: "string", description: "Optional. The absolute path of the current project workspace. LLMs should always pass their active directory here to isolate media to the specific project." }
          },
          required: ["prompt"]
        }
      },
      {
        name: "googleaistudio_manage_outputs",
        description: "Manage the local AI Outputs directory to prevent hard drive bloat.",
        inputSchema: {
          type: "object",
          properties: {
            action: { 
              type: "string", 
              enum: ["clear_all", "clear_older_than_two_weeks", "get_folder_path"],
              description: "The action to perform on the output directory."
            },
            project_workspace_path: { type: "string", description: "Optional. The absolute path of the current project workspace. LLMs should always pass their active directory here." }
          },
          required: ["action"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    if (request.params.name === "googleaistudio_generate_content") {
      const { prompt, model = "gemini-1.5-pro", systemInstruction, temperature } = request.params.arguments as any;
      const config: any = {};
      if (systemInstruction) config.systemInstruction = systemInstruction;
      if (temperature !== undefined) config.temperature = temperature;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config
      });

      return {
        content: [{ type: "text", text: response.text || "No response generated." }]
      };
    }

    if (request.params.name === "googleaistudio_generate_image") {
      const { prompt, model = "imagen-3.0-generate-001", aspectRatio, numberOfImages, outputMimeType, personGeneration } = request.params.arguments as any;
      
      const config: any = {};
      if (aspectRatio) config.aspectRatio = aspectRatio;
      if (numberOfImages) config.numberOfImages = numberOfImages;
      if (outputMimeType) config.outputMimeType = outputMimeType;
      if (personGeneration) config.personGeneration = personGeneration;

      const response = await ai.models.generateImages({
        model,
        prompt,
        config
      });

      const content = [];
      let resultText = "Images generated successfully.\n";
      for (const image of response.generatedImages || []) {
          if (image.image?.imageBytes) {
              content.push({
                  type: "image",
                  data: image.image.imageBytes,
                  mimeType: outputMimeType || "image/jpeg"
              });
          }
      }

      if (content.length === 0) {
          content.push({ type: "text", text: resultText || "No images returned." });
      }

      return { content };
    }

    if (request.params.name === "googleaistudio_generate_video") {
        const { prompt, model = "veo-3.1-generate-preview", project_workspace_path } = request.params.arguments as any;
        let operation = await ai.models.generateVideos({
            model,
            prompt
        });

        // Polling loop for Long-Running Operation (LRO)
        let maxLoops = 120; // 30 minutes at 15s per loop
        let loopCount = 0;
        let timeoutReached = false;
        let apiError: any = null;

        while (!operation.done) {
            loopCount++;
            if (loopCount > maxLoops) {
                timeoutReached = true;
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 15000));
            try {
                if ((ai as any).operations?.get) {
                    operation = await (ai as any).operations.get({ name: operation.name });
                } else if ((ai as any).operations?.getVideosOperation) {
                    operation = await (ai as any).operations.getVideosOperation({ name: operation.name });
                } else {
                    break;
                }

                if (operation.error) {
                    apiError = operation.error;
                    break;
                }
            } catch (pollErr) {
                console.error("Polling error:", pollErr);
                apiError = pollErr;
                break;
            }
        }

        if (apiError) {
            return {
                content: [{ type: "text", text: `Video generation failed due to an API error during polling: ${JSON.stringify(apiError)}` }],
                isError: true
            };
        }

        if (timeoutReached) {
            return {
                content: [{ type: "text", text: `Video generation timed out after 30 minutes. Please check your AI Studio dashboard manually.` }],
                isError: true
            };
        }

        const videoResponse = operation.response;
        const generatedVideos = videoResponse?.generatedVideos || (videoResponse as any)?.videos;
        const videoContent = generatedVideos?.[0]?.video || generatedVideos?.[0];
        let videoPathStr = "";

        if (videoContent?.uri || videoContent?.videoBytes || videoContent?.bytes) {
            const baseDir = project_workspace_path || process.cwd();
            const outDir = path.join(baseDir, "Your_AI_Outputs_Downloaded_To_Your_Local_Machine");
            if (!fs.existsSync(outDir)) {
                fs.mkdirSync(outDir, { recursive: true });
            }
            const fileName = `video_${Date.now()}.mp4`;
            videoPathStr = path.join(outDir, fileName);

            const bytes = videoContent.videoBytes || videoContent.bytes;
            if (bytes) {
                fs.writeFileSync(videoPathStr, Buffer.from(bytes, 'base64'));
            } else if (videoContent.uri) {
                fs.writeFileSync(videoPathStr, "Please refer to the URI: " + videoContent.uri);
            }
        }

        if (videoPathStr) {
            return {
                content: [{ type: "text", text: `![Generated Video](file:///${videoPathStr.replace(/\\/g, '/')})` }]
            };
        } else {
            return {
                content: [{ type: "text", text: `Video generation finished, but no output bytes were found. Response: ${JSON.stringify(videoResponse)}` }]
            };
        }
    }

    if (request.params.name === "googleaistudio_manage_outputs") {
        const { action, project_workspace_path } = request.params.arguments as any;
        const baseDir = project_workspace_path || process.cwd();
        const outDir = path.join(baseDir, "Your_AI_Outputs_Downloaded_To_Your_Local_Machine");

        if (action === "get_folder_path") {
            return {
                content: [{ type: "text", text: `The AI Outputs directory is located at:\n${outDir}` }]
            };
        }

        if (!fs.existsSync(outDir)) {
            return {
                content: [{ type: "text", text: `The directory does not exist yet. No files to clear.\nPath: ${outDir}` }]
            };
        }

        const files = fs.readdirSync(outDir);
        let deletedCount = 0;

        if (action === "clear_all") {
            for (const file of files) {
                fs.unlinkSync(path.join(outDir, file));
                deletedCount++;
            }
            return {
                content: [{ type: "text", text: `Successfully deleted all ${deletedCount} file(s) from the outputs directory.` }]
            };
        }

        if (action === "clear_older_than_two_weeks") {
            const now = Date.now();
            const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
            for (const file of files) {
                const filePath = path.join(outDir, file);
                const stats = fs.statSync(filePath);
                if (now - stats.mtimeMs > twoWeeksMs) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
            }
            return {
                content: [{ type: "text", text: `Successfully deleted ${deletedCount} file(s) older than two weeks from the outputs directory.` }]
            };
        }
        
        throw new Error(`Unknown action: ${action}`);
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
  } catch (error: any) {
    let errorMessage = `Error: ${error.message}`;
    if (error.status === 404 || errorMessage.includes('404') || errorMessage.toLowerCase().includes('not found')) {
        errorMessage += `\n\nNote: If you are using Veo video models, they do NOT support the '-latest' suffix. You may need to manually update the model string in the source code (e.g., bump to 'veo-4.0-generate-001' or similar).`;
    }
    return {
      content: [{ type: "text", text: errorMessage }],
      isError: true,
    };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Google AI Studio MCP Server running on stdio");
}

run().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
