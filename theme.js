/**
 * Fieldwork Tracker - Theme Manager
 * Handles Dark/Light mode persistence and toggling.
 */

const ThemeManager = {
    init() {
        // Check local storage or system preference
        const savedTheme = localStorage.getItem('theme');
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme === 'dark' || (!savedTheme && systemDark)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        this.updateButtonIcons();
    },

    toggle() {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        this.updateButtonIcons();
    },

    updateButtonIcons() {
        const isDark = document.documentElement.classList.contains('dark');
        const sunIcons = document.querySelectorAll('.theme-toggle-sun');
        const moonIcons = document.querySelectorAll('.theme-toggle-moon');

        sunIcons.forEach(icon => icon.classList.toggle('hidden', !isDark)); // Show sun in dark mode (to switch to light)
        moonIcons.forEach(icon => icon.classList.toggle('hidden', isDark)); // Show moon in light mode (to switch to dark)
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => ThemeManager.init());

// Expose global toggle function for HTML buttons
window.toggleTheme = () => ThemeManager.toggle();
