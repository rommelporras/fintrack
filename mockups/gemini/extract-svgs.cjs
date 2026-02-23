const fs = require('fs');
const path = require('path');

const mockupsDir = __dirname;
const assetsDir = path.join(mockupsDir, 'assets');

if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir);
}

const content = fs.readFileSync(path.join(mockupsDir, 'dashboard.html'), 'utf8');

// The dashboard has navigation links like:
// <a href="transactions.html" ...><svg ...>...</svg> Transactions</a>
const navRegex = /<a[^>]*href="([^"]+)\.html"[^>]*>[\s\n]*(<svg[^>]*>[\s\S]*?<\/svg>)/gi;

let match;
const extracted = [];

while ((match = navRegex.exec(content)) !== null) {
    const name = match[1]; // e.g. "transactions", "recurring"
    let svg = match[2];

    if (!svg.includes('xmlns=')) {
        svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    // Make it responsive/scalable
    svg = svg.replace(/width="[0-9]+"/, 'width="100%"').replace(/height="[0-9]+"/, 'height="100%"');

    const filename = `icon-${name}.svg`;
    fs.writeFileSync(path.join(assetsDir, filename), svg);
    extracted.push(filename);
}

// Check for the "Sign out" button
const signoutRegex = /<button[^>]*>[\s\n]*(<svg[^>]*>[\s\S]*?<\/svg>)[\s\n]*Sign out<\/button>/gi;
const soMatch = signoutRegex.exec(content);
if (soMatch) {
    let soSvg = soMatch[1];
    if (!soSvg.includes('xmlns=')) {
        soSvg = soSvg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    soSvg = soSvg.replace(/width="[0-9]+"/, 'width="100%"').replace(/height="[0-9]+"/, 'height="100%"');
    fs.writeFileSync(path.join(assetsDir, `icon-signout.svg`), soSvg);
    extracted.push('icon-signout.svg');
}

console.log(`Successfully extracted ${extracted.length} meaningful SVGs to assets/:\n  - ${extracted.join('\n  - ')}`);
