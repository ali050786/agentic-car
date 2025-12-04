/**
 * Color Presets for Design System
 * 
 * Defines preset color combinations that can be expanded into full scales.
 * Each preset contains 4 seed colors: primary, secondary, text, and background.
 * 
 * Location: src/config/colorPresets.ts
 */

export interface ColorPreset {
    id: string;
    name: string;
    description?: string;
    seeds: {
        primary: string;    // Main brand color
        secondary: string;  // Accent/supporting color
        text: string;       // Text color base
        background: string; // Surface/background base
    };
}

export const PRESETS: ColorPreset[] = [
    // DARK MODE PRESETS
    {
        id: 'ocean-tech',
        name: 'Ocean Tech',
        description: 'Deep blues with vibrant cyan accents - Modern and professional',
        seeds: {
            primary: '#0EA5E9',    // Sky blue
            secondary: '#06B6D4',  // Cyan
            text: '#E0F2FE',       // Light blue
            background: '#0C4A6E', // Deep blue
        },
    },
    {
        id: 'ocean-tech-light',
        name: 'Ocean Tech Light',
        description: 'Bright blues with cyan accents on light background - Fresh and clean',
        seeds: {
            primary: '#0284C7',    // Darker sky blue (better contrast)
            secondary: '#0891B2',  // Darker cyan
            text: '#0C4A6E',       // Deep blue text
            background: '#F0F9FF', // Light blue background
        },
    },
    {
        id: 'midnight',
        name: 'Midnight',
        description: 'Dark elegant theme with purple accents - Sophisticated and bold',
        seeds: {
            primary: '#8B5CF6',    // Purple
            secondary: '#EC4899',  // Pink
            text: '#F3E8FF',       // Light purple
            background: '#1E1B4B', // Deep indigo
        },
    },
    {
        id: 'midnight-light',
        name: 'Midnight Light',
        description: 'Soft purples and pinks on light background - Elegant and refined',
        seeds: {
            primary: '#7C3AED',    // Darker purple
            secondary: '#DB2777',  // Darker pink
            text: '#4C1D95',       // Deep purple text
            background: '#FAF5FF', // Light lavender
        },
    },
    {
        id: 'sunset',
        name: 'Sunset',
        description: 'Warm oranges and reds - Energetic and vibrant',
        seeds: {
            primary: '#F97316',    // Orange
            secondary: '#EF4444',  // Red
            text: '#FEF3C7',       // Light yellow
            background: '#7C2D12', // Dark brown
        },
    },
    {
        id: 'sunset-light',
        name: 'Sunset Light',
        description: 'Warm oranges and reds on cream background - Energetic and inviting',
        seeds: {
            primary: '#EA580C',    // Darker orange
            secondary: '#DC2626',  // Darker red
            text: '#7C2D12',       // Dark brown text
            background: '#FFFBEB', // Warm cream
        },
    },
    {
        id: 'forest',
        name: 'Forest',
        description: 'Natural greens with earthy tones - Calm and organic',
        seeds: {
            primary: '#10B981',    // Emerald green
            secondary: '#84CC16',  // Lime
            text: '#ECFDF5',       // Light mint
            background: '#064E3B', // Forest green
        },
    },
    {
        id: 'forest-light',
        name: 'Forest Light',
        description: 'Fresh greens on natural light background - Calm and refreshing',
        seeds: {
            primary: '#059669',    // Darker emerald
            secondary: '#65A30D',  // Darker lime
            text: '#064E3B',       // Forest green text
            background: '#F0FDF4', // Light mint
        },
    },
    {
        id: 'minimal',
        name: 'Minimal',
        description: 'Clean grayscale with blue accents - Timeless and professional',
        seeds: {
            primary: '#3B82F6',    // Blue
            secondary: '#6366F1',  // Indigo
            text: '#F9FAFB',       // Off-white
            background: '#111827', // Dark gray
        },
    },
    {
        id: 'minimal-light',
        name: 'Minimal Light',
        description: 'Clean grayscale with blue accents on white - Classic and professional',
        seeds: {
            primary: '#2563EB',    // Darker blue
            secondary: '#4F46E5',  // Darker indigo
            text: '#1F2937',       // Dark gray text
            background: '#FFFFFF', // Pure white
        },
    },
    {
        id: 'neon-cyber',
        name: 'Neon Cyber',
        description: 'Electric colors with dark background - Futuristic and bold',
        seeds: {
            primary: '#A855F7',    // Purple
            secondary: '#22D3EE',  // Cyan
            text: '#FDF4FF',       // Light lavender
            background: '#0F172A', // Slate black
        },
    },
    {
        id: 'neon-cyber-light',
        name: 'Neon Cyber Light',
        description: 'Vibrant purples and cyans on light background - Modern and energetic',
        seeds: {
            primary: '#9333EA',    // Darker purple
            secondary: '#0891B2',  // Darker cyan
            text: '#1E1B4B',       // Deep indigo text
            background: '#F8FAFC', // Light slate
        },
    },
    {
        id: 'golden-hour',
        name: 'Golden Hour',
        description: 'Warm golds and ambers - Luxurious and inviting',
        seeds: {
            primary: '#F59E0B',    // Amber
            secondary: '#FBBF24',  // Yellow
            text: '#FFFBEB',       // Cream
            background: '#78350F', // Dark brown
        },
    },
    {
        id: 'golden-hour-light',
        name: 'Golden Hour Light',
        description: 'Rich golds on warm light background - Luxurious and warm',
        seeds: {
            primary: '#D97706',    // Darker amber
            secondary: '#F59E0B',  // Amber
            text: '#78350F',       // Dark brown text
            background: '#FFFBEB', // Cream background
        },
    },
];

/**
 * Get a preset by ID
 */
export const getPresetById = (id: string): ColorPreset | undefined => {
    return PRESETS.find((preset) => preset.id === id);
};

/**
 * Get all preset IDs
 */
export const getPresetIds = (): string[] => {
    return PRESETS.map((preset) => preset.id);
};
