import glob

html_files = glob.glob('/home/wsl/personal/fintrack/mockups/gemini/*.html')
for file in html_files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # The badge string
    old_badge = 'class="absolute right-3 bg-red-500 text-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-4 text-center"'
    new_badge = 'class="absolute right-3 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-4 text-center"'
    
    content = content.replace(old_badge, new_badge)

    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

print(f"Updated notification badges to text-white in {len(html_files)} files.")
