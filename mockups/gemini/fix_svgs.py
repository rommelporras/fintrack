import os
import glob
import re

html_files = glob.glob('/home/wsl/personal/fintrack/mockups/gemini/*.html')
for file in html_files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Update Sun SVG circle
    content = content.replace('<circle cx="12" cy="12" r="5"/>', '<circle cx="12" cy="12" r="5" fill="currentColor"/>')
    content = content.replace('<circle cx="12" cy="12" r="5" />', '<circle cx="12" cy="12" r="5" fill="currentColor"/>')

    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

print(f"Updated {len(html_files)} files with solid Sun SVG.")
