// tailwind-config.js
tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            colors: {
                background: 'var(--bg-base)',
                foreground: 'var(--text-primary)',
                card: 'var(--bg-card)',
                border: 'var(--border)',
                muted: 'var(--bg-card-hover)',
                'muted-foreground': 'var(--text-secondary)',
                primary: 'var(--accent-green)',
                'primary-foreground': '#ffffff',
                destructive: 'var(--accent-red)',
            }
        }
    }
}
