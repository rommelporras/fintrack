import os

injection = """    <!-- Pull to Refresh -->
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const pTrContainer = document.createElement('div');
            pTrContainer.id = 'ptr-container';
            pTrContainer.innerHTML = `<div id="ptr-icon" style="transition: transform 0.2s; display:flex; align-items:center; justify-content:center; width: 40px; height: 40px; border-radius: 50%; background: var(--card, white); box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin: 0 auto; color: var(--primary);">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
        </div>`;
            pTrContainer.style.cssText = 'position:fixed; top:-60px; left:0; right:0; z-index:9999; display:flex; justify-content:center; pointer-events:none; transition: top 0.3s;';
            document.body.appendChild(pTrContainer);
            
            let ptrStartY = 0;
            let ptrCurrentY = 0;
            let isPtr = false;

            document.addEventListener('touchstart', (e) => {
                if (window.scrollY === 0) {
                    ptrStartY = e.touches[0].clientY;
                    isPtr = true;
                    pTrContainer.style.transition = 'none';
                }
            }, { passive: true });

            document.addEventListener('touchmove', (e) => {
                if (!isPtr) return;
                ptrCurrentY = e.touches[0].clientY;
                const deltaY = ptrCurrentY - ptrStartY;
                if (deltaY > 0 && window.scrollY === 0) {
                    const pull = Math.min(deltaY * 0.4, 80);
                    pTrContainer.style.top = `${-60 + pull}px`;
                    const icon = document.getElementById('ptr-icon');
                    if (icon) icon.style.transform = `rotate(${pull * 3}deg)`;
                } else {
                    isPtr = false;
                }
            }, { passive: true });

            document.addEventListener('touchend', (e) => {
                if (!isPtr) return;
                isPtr = false;
                const deltaY = ptrCurrentY - ptrStartY;
                pTrContainer.style.transition = 'top 0.3s';
                if (deltaY > 120) {
                    pTrContainer.style.top = '20px';
                    const icon = document.getElementById('ptr-icon');
                    if (!document.querySelector('#ptr-style')) {
                        const style = document.createElement('style');
                        style.id = 'ptr-style';
                        style.textContent = '@keyframes spin-ptr { 100% { transform: rotate(360deg); } }';
                        document.head.appendChild(style);
                    }
                    if (icon) icon.style.animation = 'spin-ptr 1s linear infinite';
                    setTimeout(() => {
                        location.reload();
                    }, 600);
                } else {
                    pTrContainer.style.top = '-60px';
                }
            });
        });
    </script>
"""

html_files = [f for f in os.listdir('.') if f.endswith('.html')]

for file in html_files:
    with open(file, 'r') as f:
        content = f.read()
    
    if "<-ls Pull to Refresh -->" not in content:
        content = content.replace("</body>", f"{injection}</body>")
        with open(file, 'w') as f:
            f.write(content)
        print(f"Injected PTR into {file}")

