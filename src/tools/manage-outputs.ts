import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as fs from "fs";
import * as path from "path";

export function registerManageOutputsTool(server: McpServer) {
    server.tool("googleaistudio_manage_outputs", {
        action: z.enum(["clear_all", "clear_older_than_two_weeks", "get_folder_path"]).describe("The action to perform on the output directory."),
        targetDirectory: z.string().describe("The absolute path to the AI outputs directory to manage."),
    }, async ({ action, targetDirectory }) => {
        try {
            if (action === "get_folder_path") {
                return {
                    content: [{ type: "text", text: `The AI Outputs directory is located at:\n${targetDirectory}` }]
                };
            }

            if (!fs.existsSync(targetDirectory)) {
                return {
                    content: [{ type: "text", text: `The directory does not exist yet. No files to clear.\nPath: ${targetDirectory}` }]
                };
            }

            const files = fs.readdirSync(targetDirectory);
            let deletedCount = 0;
            let skippedDirs = 0;

            if (action === "clear_all") {
                for (const file of files) {
                    const filePath = path.join(targetDirectory, file);
                    if (fs.statSync(filePath).isDirectory()) {
                        skippedDirs++;
                        continue;
                    }
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
                const note = skippedDirs > 0 ? ` Skipped ${skippedDirs} subdirectory(ies).` : "";
                return {
                    content: [{ type: "text", text: `Successfully deleted all ${deletedCount} file(s) from the outputs directory.${note}` }]
                };
            }

            if (action === "clear_older_than_two_weeks") {
                const now = Date.now();
                const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
                for (const file of files) {
                    const filePath = path.join(targetDirectory, file);
                    const stats = fs.statSync(filePath);
                    if (stats.isDirectory()) {
                        skippedDirs++;
                        continue;
                    }
                    if (now - stats.mtimeMs > twoWeeksMs) {
                        fs.unlinkSync(filePath);
                        deletedCount++;
                    }
                }
                const note = skippedDirs > 0 ? ` Skipped ${skippedDirs} subdirectory(ies).` : "";
                return {
                    content: [{ type: "text", text: `Successfully deleted ${deletedCount} file(s) older than two weeks from the outputs directory.${note}` }]
                };
            }
            
            return {
                content: [{ type: "text", text: `Unknown action: ${action}` }],
                isError: true,
            };
        } catch (error: any) {
            return {
                content: [{ type: "text", text: `Error: ${error.message || String(error)}` }],
                isError: true,
            };
        }
    });
}
