import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

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
            model: { type: "string", description: "The model to use (default: veo-0.1-generate-001)." }
          },
          required: ["prompt"]
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
        const { prompt, model = "veo-2.0-generate-001" } = request.params.arguments as any;
        const operation = await ai.models.generateVideos({
            model,
            prompt
        });
        return {
            content: [{ type: "text", text: `Video generation triggered successfully!\nModel: ${model}\nNote: Video generation is a long-running operation and can take several minutes. Check your AI Studio dashboard or use polling for the final output file.` }]
        };
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
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
