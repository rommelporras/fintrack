const fs = require('fs');
const path = require('path');

const mockupsDir = __dirname;
const assetsDir = path.join(mockupsDir, 'assets');

if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir);
}

// Map to store unique SVGs and assign them meaningful names
// Key: SVG string content, Value: intended filename
const uniqueSvgs = new Map();

const files = fs.readdirSync(mockupsDir).filter(f => f.endsWith('.html'));
let counter = 1;

for (const file of files) {
    const content = fs.readFileSync(path.join(mockupsDir, file), 'utf8');

    // Regex to match <svg> tags and their inner content
    const svgRegex = /<svg[^>]*>[\s\S]*?<\/svg>/gi;
    let match;

    while ((match = svgRegex.exec(content)) !== null) {
        let svgContent = match[0];

        // Normalize SVG slightly (remove dynamic classes to find unique base shapes)
        const normalizedSvg = svgContent.replace(/class="[^"]*"/g, '').replace(/\s+/g, ' ').trim();

        if (!uniqueSvgs.has(normalizedSvg)) {
            // Clean up the SVG for standalone use
            // Ensure it has xmlns if missing
            if (!svgContent.includes('xmlns=')) {
                svgContent = svgContent.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
            }

            uniqueSvgs.set(normalizedSvg, {
                content: svgContent,
                originalFile: file,
                id: `icon-${counter++}`
            });
        }
    }
}

// We will save them with generic names first, then generate a mapping for the AI or user
const manifest = {};

for (const [key, data] of uniqueSvgs.entries()) {
    const filename = `${data.id}.svg`;
    fs.writeFileSync(path.join(assetsDir, filename), data.content);
    manifest[data.id] = {
        source: data.originalFile,
        svgLength: data.content.length
    };
}

fs.writeFileSync(path.join(assetsDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Extracted ${uniqueSvgs.size} unique SVGs to ${assetsDir}`);
