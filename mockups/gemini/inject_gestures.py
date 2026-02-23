import os

injection = """    <!-- Mobile Touch Gestures -->
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            let startX = 0;
            let currentX = 0;
            let startY = 0;
            let isDraggingSidebar = false;
            let isDraggingSheet = false;
            let activeSheet = null;
            let startTime = 0;

            document.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                currentX = startX;
                startTime = e.timeStamp;

                // Check if starting an edge wipe to open sidebar
                const sidebar = document.getElementById('sidebar');
                const navOverlay = document.getElementById('sidebar-overlay');
                if (sidebar && navOverlay && startX < 30 && !sidebar.classList.contains('open')) {
                    isDraggingSidebar = true;
                    // pre-open overlay, but make it transparent
                    navOverlay.classList.add('open');
                    navOverlay.style.opacity = '0';
                    sidebar.style.transition = 'none';
                    sidebar.classList.add('open');
                    sidebar.style.transform = `translateX(-100%)`;
                }

                // Check if starting a swipe on an already open sidebar
                if (sidebar && sidebar.classList.contains('open') && startX > 0) {
                     // Only drag if touch started on the sidebar itself, not the overlay
                     if (e.target.closest('#sidebar')) {
                         isDraggingSidebar = true;
                         sidebar.style.transition = 'none';
                     }
                }

                // Check if dragging an open sheet
                document.querySelectorAll('.sheet.open').forEach(sheet => {
                    if (e.target.closest('.sheet') === sheet) {
                        isDraggingSheet = true;
                        activeSheet = sheet;
                        activeSheet.style.transition = 'none';
                    }
                });
            }, { passive: true });

            document.addEventListener('touchmove', (e) => {
                if (!isDraggingSidebar && !isDraggingSheet) return;

                const deltaX = e.touches[0].clientX - startX;
                const deltaY = e.touches[0].clientY - startY;

                // Stop horizontal dragging if scrolling vertically
                if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
                    // abort
                    if (isDraggingSidebar) {
                        const sidebar = document.getElementById('sidebar');
                        const navOverlay = document.getElementById('sidebar-overlay');
                        // reset sidebar
                        sidebar.style.transform = '';
                        sidebar.style.transition = '';
                        // if we were edge Opening, undo
                        if (startX < 30) {
                            sidebar.classList.remove('open');
                            navOverlay.classList.remove('open');
                        }
                    }
                    if (isDraggingSheet && activeSheet) {
                        activeSheet.style.transform = '';
                        activeSheet.style.transition = '';
                    }
                    isDraggingSidebar = false;
                    isDraggingSheet = false;
                    activeSheet = null;
                    return;
                }

                if (isDraggingSidebar) {
                    const sidebar = document.getElementById('sidebar');
                    const navOverlay = document.getElementById('sidebar-overlay');
                    if (startX < 30) {
                         // Opening from edge
                         const p = Math.max(0, Math.min(100, (deltaX / 250) * 100)); // 250px max width roughly
                         sidebar.style.transform = `translateX(${p - 100}%)`;
                         navOverlay.style.opacity = p / 100;
                    } else {
                         // Closing from open state
                         if (deltaX < 0) {
                            sidebar.style.transform = `translateX(${deltaX}px)`;
                            navOverlay.style.opacity = 1 - (Math.abs(deltaX) / 250);
                         }
                    }
                } else if (isDraggingSheet && activeSheet) {
                    if (deltaX > 0) { // Only allow swiping right to close
                        activeSheet.style.transform = `translateX(${deltaX}px)`;
                        const backdrop = document.querySelector('.backdrop.open') || document.getElementById('modal-backdrop');
                        if (backdrop) {
                            const p = Math.max(0, 1 - (deltaX / 440));
                            backdrop.style.opacity = p;
                        }
                    }
                }
            }, { passive: true });

            document.addEventListener('touchend', (e) => {
                if (!isDraggingSidebar && !isDraggingSheet) return;
                
                const deltaX = e.changedTouches[0].clientX - startX;
                const timeDiff = e.timeStamp - startTime;
                const velocityX = timeDiff > 0 ? deltaX / timeDiff : 0;

                if (isDraggingSidebar) {
                    const sidebar = document.getElementById('sidebar');
                    const navOverlay = document.getElementById('sidebar-overlay');
                    sidebar.style.transition = '';
                    sidebar.style.transform = '';
                    if(navOverlay) navOverlay.style.opacity = '';
                    
                    if (startX < 30) {
                        // Was opening
                        if (deltaX > 50 || velocityX > 0.5) {
                            // keep open
                            sidebar.classList.add('open');
                            if(navOverlay) navOverlay.classList.add('open');
                            document.body.style.overflow = 'hidden';
                        } else {
                            // close
                            sidebar.classList.remove('open');
                            if(navOverlay) navOverlay.classList.remove('open');
                            document.body.style.overflow = '';
                        }
                    } else {
                        // Was closing
                        if (deltaX < -50 || velocityX < -0.5) {
                             // trigger close
                             if (typeof toggleSidebar === 'function') toggleSidebar();
                             else {
                                sidebar.classList.remove('open');
                                if(navOverlay) navOverlay.classList.remove('open');
                                document.body.style.overflow = '';
                             }
                        }
                    }
                    isDraggingSidebar = false;
                }

                if (isDraggingSheet && activeSheet) {
                    activeSheet.style.transition = '';
                    activeSheet.style.transform = '';
                    const backdrop = document.querySelector('.backdrop.open') || document.getElementById('modal-backdrop');
                    if (backdrop) backdrop.style.opacity = '';

                    if (deltaX > 50 || velocityX > 0.5) {
                        // trigger close
                        if (typeof closeAll === 'function') closeAll();
                        else if (typeof closeOverlays === 'function') closeOverlays();
                        else {
                            activeSheet.classList.remove('open');
                            if (backdrop) backdrop.classList.remove('open');
                            document.body.style.overflow = '';
                        }
                    }
                    isDraggingSheet = false;
                    activeSheet = null;
                }
            });
        });
    </script>
"""

html_files = [f for f in os.listdir('.') if f.endswith('.html')]

for file in html_files:
    with open(file, 'r') as f:
        content = f.read()
    
    if "<-ls Mobile Touch Gestures -->" not in content:
        content = content.replace("</body>", f"{injection}</body>")
        with open(file, 'w') as f:
            f.write(content)
        print(f"Injected into {file}")

