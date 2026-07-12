import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY environment variable is missing.");
  process.exit(1);
}

export const ai = new GoogleGenAI({ apiKey });
// Guaranteed non-empty: the process exits above if the key is missing.
export const geminiApiKey: string = apiKey;

// Store active video operations for polling
export const activeVideoOperations = new Map<string, any>();
