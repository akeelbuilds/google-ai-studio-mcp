const fs = require('fs');
const files = ['src/tools/video-gen.ts', 'src/tools/image-gen.ts', 'src/tools/content-gen.ts', 'src/tools/manage-outputs.ts'];

for (const f of files) {
    let text = fs.readFileSync(f, 'utf8');
    text = text.replace(/type: "text"/g, 'type: "text" as const');
    fs.writeFileSync(f, text);
}
console.log("Done");
