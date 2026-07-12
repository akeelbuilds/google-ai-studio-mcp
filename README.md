# Google AI Studio MCP Server

A universal, open-source Model Context Protocol (MCP) server that exposes the granular features of Google AI Studio (Gemini, Imagen, Veo) directly to your code editors and local LLM clients.

## Features
- **Full Model Support**: Use any Google AI Studio model (e.g., `gemini-1.5-pro`, `gemini-exp`).
- **Granular Imagen Controls**: Control Aspect Ratio, Number of Images, Output Format, and Person Generation settings.
- **Veo Video Generation**: Built-in support for Veo (requires approved API key).
- **Cross-Editor Compatibility**: Works out of the box with VS Code, Cursor, Cloud Code, Claude Desktop, and local Ollama clients.

### Important Limitations & Versioning

- **Music Generation is NOT supported**: Music generation models (like Lyria or MusicFX) are currently locked behind Google's web UI and private Vertex endpoints. They are not exposed via the standard developer API.
- **Model Versioning (`-latest` vs Hardcoding)**: For Text and Multimodal models (like Flash and Pro), this MCP uses the `-latest` suffix (e.g., `gemini-1.5-pro-latest`). This ensures the server naturally pulls updated models without breaking when older versions are deprecated.
  - **CRITICAL EXCEPTION**: Video models (Veo) **do not support** the `-latest` suffix. If Veo video generation stalls out or throws a "Model Not Found" error, you must manually update the hardcoded numerical string in the source code (e.g., bump from `veo-3.1-generate-preview` to `veo-4.0-generate-001`).

## Installation

### Prerequisites
- Node.js (v18+)
- A Google AI Studio API Key

### Setup
1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/google-ai-studio-mcp.git
   cd google-ai-studio-mcp
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the server:
   ```bash
   npm run build
   ```
**Note:** For security, do not use a `.env` file. You will inject your API key directly into your editor's MCP configuration as shown below.

## Configuration

Inject your API key directly into your editor's protected global MCP configuration file.

### Antigravity / Cloud Code
Use the following JSON snippet in your `mcp_config.json`:
```json
"google-ai-studio": {
  "command": "node",
  "args": ["C:/GitHub/google-ai-studio-mcp/dist/index.js"],
  "env": {
    "GEMINI_API_KEY": "YOUR_ACTUAL_API_KEY"
  }
}
```

### Cursor / VS Code
Add to your settings:
```json
{
  "mcp.servers": {
    "google-ai-studio": {
      "command": "node",
      "args": ["/path/to/google-ai-studio-mcp/dist/index.js"]
    }
  }
}
```

### Claude Desktop
Add to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "google-ai-studio": {
      "command": "node",
      "args": ["/path/to/google-ai-studio-mcp/dist/index.js"]
    }
  }
}
```

## Tools Exposed
- `googleaistudio_generate_content`: Text generation with full parameter support (Temperature, System Instructions).
- `googleaistudio_generate_image`: Image generation (Imagen 3) with Aspect Ratio and MIME Type controls.
- `googleaistudio_generate_video`: Video generation (Veo). Includes automatic Long-Running Operation (LRO) polling with a 30-minute timeout protection and graceful crash/error catching.
- `googleaistudio_manage_outputs`: File management tool to prevent hard drive bloat in your local AI Outputs directory. Includes actions to `clear_all`, `clear_older_than_two_weeks`, and `get_folder_path`.

### Dynamic Project Output Directories
By default, global MCP servers often struggle to know which project you're currently working on, leading to all generated media being dumped into one messy global folder. 

This MCP solves that by exposing an optional `project_workspace_path` parameter to the AI models.

**Practical Use Cases:**
- 🍰 **The Cheesecake Website**: You're working in `~/projects/cheesecake-site` and ask the AI to generate a video of a cheesecake being sliced. The AI dynamically passes its workspace path. The MCP automatically creates a `Your_AI_Outputs_Downloaded_To_Your_Local_Machine` folder directly inside the `cheesecake-site` repo so your cheesecake assets stay with your cheesecake code.
- 🏕️ **The Camping Tents Store**: Later, you switch to `~/projects/camping-tents` and generate a video of a tent in the rain. The AI passes the new workspace path, and the media is cleanly saved within the camping project, completely separate from the cheesecakes!
