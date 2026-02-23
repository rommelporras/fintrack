import glob
import re

html_files = glob.glob('/home/wsl/personal/fintrack/mockups/gemini/*.html')
for file in html_files:
    if "dashboard.html" in file: continue
    
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # If it's scan.html or budgets.html, let's keep it intact for now 
    # as they have specific styles. But we can remove the global parts below via regex.
    # Actually, budgets uses .sheet-overlay, etc. Let's just remove the exact blocks:
    
    # Remove standard Modals / Sheets block
    content = re.sub(r'\s*/\*\s*Modals\s*/\s*Sheets\s*\*/\s*\.backdrop.*?\.modal-dialog\.open\s*\{\s*opacity:\s*1;\s*transform:\s*scale\(1\);\s*pointer-events:\s*auto;\s*\}', '', content, flags=re.DOTALL)
    
    # Remove Switch Component block
    content = re.sub(r'\s*/\*\s*Switch Component\s*\*/\s*\.switch.*?input:focus-visible\+\.slider\s*\{\s*outline:\s*2px solid var\(--primary\);\s*outline-offset:\s*2px;\s*\}', '', content, flags=re.DOTALL)
    
    # Remove empty style blocks
    content = re.sub(r'<style>\s*</style>', '', content, flags=re.DOTALL)

    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

print(f"Cleaned up redundant styles.")
