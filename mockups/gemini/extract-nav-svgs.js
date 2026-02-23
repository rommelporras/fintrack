const fs = require('fs');
const path = require('path');

const mockupsDir = __dirname;
const assetsDir = path.join(mockupsDir, 'assets');

if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir);
}

const content = fs.readFileSync(path.join(mockupsDir, 'dashboard.html'), 'utf8');
const navRegex = /<a[^>]*href="([^"]+)\.html"[^>]*>[\s\n]*(<svg[^>]*>[\s\S]*?<\/svg>)/gi;

let match;
const extracted = [];

while ((match = navRegex.exec(content)) !== null) {
    const name = match[1]; // e.g. "transactions", "recurring"
    let svg = match[2];

    // Add xmlns if missing
    if (!svg.includes('xmlns=')) {
        svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    // Save as icon-{name}.svg
    const filename = `icon-${name}.svg`;
    fs.writeFileSync(path.join(assetsDir, filename), svg);
    extracted.push(filename);
}

// Other essential icons (like edit, delete, add)
const otherRegex = /<button[^>]*>[\s\n]*(<svg[^>]*>[\s\S]*?<\/svg>)[\s\n]*(Edit|Delete|Add|Save)/gi;
let counter = 1;
while ((match = otherRegex.exec(content)) !== null) {
    const action = match[2].toLowerCase();
    let svg = match[1];
    if (!svg.includes('xmlns=')) {
        svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    fs.writeFileSync(path.join(assetsDir, `icon-${action}-${counter++}.svg`), svg);
}

console.log(`Successfully extracted meaningful SVGs: \n${extracted.join('\n')}`);
