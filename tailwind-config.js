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
                // Semantic Colors using CSS variables with rgb() function
                // These work with Tailwind CDN's opacity modifier
                background: 'rgb(var(--color-background))',
                surface: 'rgb(var(--color-surface))',
                'surface-hover': 'rgb(var(--color-surface-hover))',
                text: 'rgb(var(--color-text))',
                'text-muted': 'rgb(var(--color-text-muted))',
                primary: 'rgb(var(--color-primary))',
                'primary-hover': 'rgb(var(--color-primary-hover))',

                // Static colors
                secondary: '#10b981',
                accent: '#8b5cf6',
                success: '#22c55e',
                warning: '#f59e0b',
                danger: '#ef4444',
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
}
