import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

/**
 * Error thrown when generation succeeded but writing the bytes to disk failed.
 * Callers catch this to attribute the failure to the *save* step rather than to
 * the model call (which already succeeded).
 */
export class MediaWriteError extends Error {
    constructor(public readonly dir: string, cause: unknown) {
        const reason = cause instanceof Error ? cause.message : String(cause);
        super(`Failed to write media to "${dir}": ${reason}`);
        this.name = "MediaWriteError";
    }
}

/** Create a directory (and parents) if it does not already exist. */
export function ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/** Collision-safe filename, e.g. `image_3f2b...-.jpeg`. */
export function uniqueName(prefix: string, ext: string): string {
    return `${prefix}_${randomUUID()}.${ext}`;
}

/**
 * Write a buffer into `dir` under a unique name. Directory-creation and write
 * failures are re-thrown as {@link MediaWriteError} so the caller can report a
 * save failure distinctly from a generation failure.
 */
export function saveBuffer(
    dir: string,
    buffer: Buffer,
    prefix: string,
    ext: string,
): { path: string; filename: string } {
    try {
        ensureDir(dir);
        const filename = uniqueName(prefix, ext);
        const filePath = path.join(dir, filename);
        fs.writeFileSync(filePath, buffer);
        return { path: filePath, filename };
    } catch (err) {
        throw new MediaWriteError(dir, err);
    }
}

/**
 * Write the same bytes into an artifact/brain directory under an explicit
 * filename (so both copies share a name). Returns the destination path.
 */
export function copyInto(artifactDir: string, buffer: Buffer, filename: string): string {
    try {
        ensureDir(artifactDir);
        const dest = path.join(artifactDir, filename);
        fs.writeFileSync(dest, buffer);
        return dest;
    } catch (err) {
        throw new MediaWriteError(artifactDir, err);
    }
}

/** Convert a local path to a `file:///` URL with normalized separators. */
export function fileUrl(p: string): string {
    return `file:///${p.replace(/\\/g, "/")}`;
}
