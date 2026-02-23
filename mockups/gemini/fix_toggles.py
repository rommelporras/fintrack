import glob, re

for file_path in glob.glob("/home/wsl/personal/fintrack/mockups/gemini/*.html"):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove any button with "fixed bottom-4 right-4" and "toggle('dark')"
    content = re.sub(
        r'<button onclick="document\.documentElement\.classList\.toggle\(\'dark\'\);"[\s\S]*?class="fixed bottom-4 right-4[\s\S]*?</button>',
        '',
        content
    )
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Fixed toggles globally.")
