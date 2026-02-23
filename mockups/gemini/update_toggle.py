import glob
import re

floating_button_pattern = re.compile(
    r'\s*<button onclick="document\.documentElement\.classList\.toggle\(\'dark\'\);" class="fixed bottom-4 right-4 p-3 rounded-full bg-primary text-primary-foreground shadow-lg z-50 flex items-center justify-center" aria-label="Toggle Dark Mode">.*?</button>',
    re.DOTALL
)

sidebar_button_html = """                <button onclick="document.documentElement.classList.toggle('dark');"
                    class="w-full flex items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors group">
                    <div class="flex items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="dark:hidden">
                            <circle cx="12" cy="12" r="5"/>
                            <line x1="12" y1="1" x2="12" y2="3"/>
                            <line x1="12" y1="21" x2="12" y2="23"/>
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                            <line x1="1" y1="12" x2="3" y2="12"/>
                            <line x1="21" y1="12" x2="23" y2="12"/>
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                        </svg>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="hidden dark:block">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                        </svg>
                        <span class="dark:hidden">Light Mode</span>
                        <span class="hidden dark:inline">Dark Mode</span>
                    </div>
                </button>
            </div>
        </aside>"""

for file_path in glob.glob("/home/wsl/personal/fintrack/mockups/gemini/*.html"):
    if file_path.endswith('theme-toggle.html'):
        continue
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Remove floating button
    content = floating_button_pattern.sub('', content)
    
    # 2. Inject sidebar button right before the closing aside tag
    # Assuming the structure is:
    #                 Settings
    #             </a>
    #         </div>
    #     </aside>
    
    content = re.sub(
        r'(\s*</div>\s*</aside>)',
        f'\n{sidebar_button_html}',
        content,
        count=1
    )
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Updated toggles successfully.")
