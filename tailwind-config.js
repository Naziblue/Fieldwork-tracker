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
                // Dark mode base (Slate)
                background: '#0f172a', // Slate 900
                surface: '#1e293b',    // Slate 800
                'surface-hover': '#334155', // Slate 700

                // Text colors
                text: '#f8fafc',       // Slate 50
                'text-muted': '#94a3b8', // Slate 400

                // Accents
                primary: '#6366f1',    // Indigo 500
                'primary-hover': '#4f46e5', // Indigo 600
                secondary: '#10b981',  // Emerald 500
                accent: '#8b5cf6',     // Violet 500

                // Status
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
