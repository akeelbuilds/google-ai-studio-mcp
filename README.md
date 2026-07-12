# Google AI Studio MCP Server

A universal, open-source Model Context Protocol (MCP) server that exposes the granular features of Google AI Studio (Gemini, Imagen, Veo) directly to your code editors and local LLM clients.

## Features
- **Full Model Support**: Use any Google AI Studio model (e.g., `gemini-1.5-pro`, `gemini-exp`).
- **Granular Imagen Controls**: Control Aspect Ratio, Number of Images, Output Format, and Person Generation settings.
- **Veo Video Generation**: Built-in support for Veo (requires approved API key).
- **Cross-Editor Compatibility**: Works out of the box with VS Code, Cursor, Cloud Code, Claude Desktop, and local Ollama clients.

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
4. Create a `.env` file in the root directory and add your API key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

## Configuration

### Antigravity / Cloud Code
Add a new JSON schema file in your MCP config directory (e.g., `~/.gemini/antigravity/mcp/google-ai-studio/config.json`):
```json
{
  "mcpServers": {
    "google-ai-studio": {
      "command": "node",
      "args": ["C:/GitHub/google-ai-studio-mcp/dist/index.js"]
    }
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
- `googleaistudio_generate_video`: Video generation (Veo).
