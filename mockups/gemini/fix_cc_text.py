import re

file_path = '/home/wsl/personal/fintrack/mockups/gemini/credit-cards.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace classes inside the cc-visual blocks
content = content.replace('class="text-foreground font-medium drop-shadow-sm truncate pr-4"', 'class="text-white font-medium drop-shadow-sm truncate pr-4"')
content = content.replace('class="flex justify-between text-xs text-foreground/70 z-10 relative"', 'class="flex justify-between text-xs text-white/80 z-10 relative"')
content = content.replace('class="font-medium text-foreground shadow-sm"', 'class="font-medium text-white shadow-sm"')
content = content.replace('class="font-medium text-foreground shadow-sm text-right"', 'class="font-medium text-white shadow-sm text-right"')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated credit-cards.html text colors.")
