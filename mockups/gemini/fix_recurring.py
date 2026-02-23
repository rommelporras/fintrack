import re

file_path = '/home/wsl/personal/fintrack/mockups/gemini/recurring.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace hardcoded light mode hex colors with tailwind variables for Dark mode compatibility
# The SVG edit icons
content = content.replace('stroke="#64748b"', 'class="text-muted-foreground"')
# The list-item wrappers that were using generic classes
content = content.replace('class="flex items-center justify-between p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all"', 'class="flex items-center justify-between p-4 bg-card hover:bg-muted border border-border rounded-xl transition-all"')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated recurring.html classes for dark mode support.")
