# Google AI Studio MCP Server

A universal, open-source Model Context Protocol (MCP) server that exposes the granular features of Google AI Studio (Gemini, Imagen, Veo) directly to your code editors and local LLM clients.

## Features
- **Full Model Support**: Use any Google AI Studio model your API key has access to (e.g., `gemini-2.5-pro`, `gemini-2.5-flash`).
- **Granular Imagen Controls**: Control Aspect Ratio, Number of Images, Output Format, and Person Generation settings.
- **Veo Video Generation**: Built-in support for Veo (requires approved API key).
- **Cross-Editor Compatibility**: Works out of the box with VS Code, Cursor, Cloud Code, Claude Desktop, and local Ollama clients.

### Important Limitations & Versioning

- **Music Generation is NOT supported**: Music generation models (like Lyria or MusicFX) are currently locked behind Google's web UI and private Vertex endpoints. They are not exposed via the standard developer API.
- **Model Versioning (`-latest` vs Hardcoding)**: For Text and Multimodal models (like Flash and Pro), you can pass the `-latest` aliases (e.g., `gemini-flash-latest`, `gemini-pro-latest`). This ensures the server naturally pulls updated models without breaking when older versions are deprecated. Note that older families such as `gemini-1.5-*` have been retired and may 404 on newer keys.
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
- `googleaistudio_generate_content`: Text generation with full parameter support (Temperature, System Instructions, Thinking Level).
- `googleaistudio_generate_image`: Image generation (Imagen) with Aspect Ratio, Number of Images, MIME Type, and Person Generation controls. Returns a native inline image plus the saved file path(s).
- `googleaistudio_start_video`: Starts a Veo video generation and immediately returns an **Operation ID** (non-blocking, avoids MCP execution timeouts).
- `googleaistudio_check_video`: Polls an Operation ID; when generation is done it downloads the MP4 to disk and returns the path. Poll every 30–60 seconds. Polling is durable — the Operation ID can be re-checked even after a server restart.
- `googleaistudio_manage_outputs`: File management tool to prevent hard drive bloat in a local AI Outputs directory. Actions: `clear_all`, `clear_older_than_two_weeks`, `get_folder_path` (subdirectories are skipped, not deleted).

### Where media is saved: `saveDirectory` & `artifactDirectory`
Media tools take an explicit, AI-supplied **absolute** path so generated assets land exactly where you want them:

- **`saveDirectory`** (required on `generate_image` / `check_video`, `targetDirectory` on `manage_outputs`): the absolute local directory to save the file into. The directory is created if it doesn't exist. E.g. `C:\Users\Name\Downloads` or a project repo folder.
- **`artifactDirectory`** (optional): the current conversation's brain/artifact directory, e.g. `<appDataDir>\brain\<conversation-id>`. When provided, the MCP writes a **second copy** of the media there so the host chat UI (e.g. Antigravity's Artifact renderer, which only renders files physically inside the brain directory) can display it inline. Images are also returned as a native MCP `image` block; videos rely on this copy since MCP has no native video block.

**Rule of thumb for agents:** pass `saveDirectory` for the durable/project copy, and pass `artifactDirectory` (your conversation's brain dir) whenever you want the user to see the media inline in chat.

## Development: Dual-Environment Build & Deploy
This server is developed in the public repo but mounted by the local agent from its config directory, so changes must be built and copied across:

1. Edit source in the GitHub repo (e.g. `C:\GitHub\google-ai-studio-mcp`).
2. `npm run build`.
3. Force-copy the built `dist/` into the active agent config path (e.g. `C:\Users\<you>\.gemini\config\google-ai-studio-mcp`).
4. Hard-restart the MCP server so the agent re-mounts the updated tools.
