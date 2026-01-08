// Custom color palette configuration for Tailwind CSS
window.tailwind = window.tailwind || {};
window.tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            colors: {
                // Base Colors (Dynamic via CSS Variables)
                background: 'rgb(var(--color-background) / <alpha-value>)',
                surface: 'rgb(var(--color-surface) / <alpha-value>)',
                'surface-hover': 'rgb(var(--color-surface-hover) / <alpha-value>)',

                // Text colors
                text: 'rgb(var(--color-text) / <alpha-value>)',
                'text-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',

                // Accents
                primary: 'rgb(var(--color-primary) / <alpha-value>)',
                'primary-hover': 'rgb(var(--color-primary-hover) / <alpha-value>)',
                secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
                accent: 'rgb(var(--color-accent) / <alpha-value>)',

                // Sidebar
                sidebar: 'rgb(var(--color-sidebar) / <alpha-value>)',
                'sidebar-text': 'rgb(var(--color-sidebar-text) / <alpha-value>)',
                'sidebar-muted': 'rgb(var(--color-sidebar-muted) / <alpha-value>)',

                // Status
                success: '#22c55e',
                warning: '#f59e0b',
                danger: '#ef4444',
            },
        },
        backgroundImage: {
            'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
            'glass': 'linear-gradient(145deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)',
        },
        boxShadow: {
            'glass': '0 4px 30px rgba(0, 0, 0, 0.1)',
            'glow': '0 0 20px rgba(99, 102, 241, 0.5)',
        }
    }
}
