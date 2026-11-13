import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				heart: 'hsl(var(--heart))',
				// Design system v0.1
				brand: {
					DEFAULT: 'hsl(var(--brand))',
					hover: 'hsl(var(--brand-hover))',
					subtle: 'hsl(var(--brand-subtle))',
					foreground: 'hsl(var(--brand-foreground))'
				},
				warning: 'hsl(var(--warning))',
				info: 'hsl(var(--info))',
				rating: {
					DEFAULT: 'hsl(var(--rating))',
					edge: 'hsl(var(--rating-edge))'
				},
				ink: 'hsl(var(--ink))',
				canvas: 'hsl(var(--canvas))',
				offer: {
					DEFAULT: 'hsl(var(--offer))',
					foreground: 'hsl(var(--offer-foreground))'
				},
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				pricing: {
					DEFAULT: 'hsl(var(--pricing-accent))',
					hover: 'hsl(var(--pricing-accent-hover))',
					foreground: 'hsl(var(--pricing-accent-foreground))',
					premium: 'hsl(var(--pricing-premium))',
					'premium-foreground': 'hsl(var(--pricing-premium-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			// Design system v0.1 type scale (additive: text-h1, text-body, text-caption, ...)
			fontSize: {
				display: ['3rem', { lineHeight: '3.5rem', letterSpacing: '-0.02em', fontWeight: '700' }],
				h1: ['2.25rem', { lineHeight: '2.75rem', letterSpacing: '-0.02em', fontWeight: '700' }],
				h2: ['1.875rem', { lineHeight: '2.375rem', letterSpacing: '-0.01em', fontWeight: '600' }],
				h3: ['1.5rem', { lineHeight: '2rem', fontWeight: '600' }],
				h4: ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }],
				'body-lg': ['1.125rem', { lineHeight: '1.75rem' }],
				body: ['1rem', { lineHeight: '1.5rem' }],
				small: ['0.875rem', { lineHeight: '1.25rem' }],
				caption: ['0.75rem', { lineHeight: '1rem', fontWeight: '500' }]
			},
			borderRadius: {
				// Design system v0.1: 6 checkboxes/tags, 10 buttons/inputs, 12 cards, 16 dialogs.
				// New UI sets --ds-radius-* (see html.ds-ui in index.css); the old UI keeps its values.
				sm: 'var(--ds-radius-sm, calc(var(--radius) - 4px))',
				md: 'calc(var(--radius) - 2px)',
				lg: 'var(--radius)',
				xl: 'var(--ds-radius-xl, 0.75rem)'
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' }
				},
				'marquee': {
					from: { transform: 'translateX(0)' },
					to: { transform: 'translateX(calc(-100% - var(--gap)))' }
				},
				'marquee-vertical': {
					from: { transform: 'translateY(0)' },
					to: { transform: 'translateY(calc(-100% - var(--gap)))' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' }
				},
				'fade-in': {
					'0%': { opacity: '0', transform: 'translateY(10px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				'slide-in-left': {
					'0%': { transform: 'translateX(-100%)' },
					'100%': { transform: 'translateX(0)' }
				},
				'slide-in-right': {
					'0%': { transform: 'translateX(100%)' },
					'100%': { transform: 'translateX(0)' }
				},
				'slide-up': {
					'0%': { transform: 'translateY(100%)' },
					'100%': { transform: 'translateY(0)' }
				},
				'glow-pulse': {
					'0%, 100%': { boxShadow: '0 0 20px hsl(var(--primary) / 0.1)' },
					'50%': { boxShadow: '0 0 30px hsl(var(--primary) / 0.2)' }
				},
				'float': {
					'0%, 100%': { transform: 'translateY(0px)' },
					'50%': { transform: 'translateY(-10px)' }
				},
				'shine': {
					'0%': { backgroundPosition: '0% 0%' },
					'50%': { backgroundPosition: '100% 100%' },
					'100%': { backgroundPosition: '0% 0%' }
				},
				'install-glow': {
					'0%, 100%': { boxShadow: '0 0 0 0 hsl(45 93% 47% / 0.35)', transform: 'scale(1)' },
					'50%': { boxShadow: '0 0 22px 6px hsl(45 93% 47% / 0.45)', transform: 'scale(1.015)' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.3s ease-out',
				'slide-in-left': 'slide-in-left 0.3s ease-out',
				'slide-in-right': 'slide-in-right 0.3s ease-out',
				'slide-up': 'slide-up 0.3s ease-out',
				'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
				'float': 'float 3s ease-in-out infinite',
				'marquee': 'marquee var(--duration, 40s) infinite linear',
				'marquee-vertical': 'marquee-vertical var(--duration, 40s) linear infinite',
				'shine': 'shine var(--duration, 14s) infinite linear',
				'install-glow': 'install-glow 2.4s ease-in-out infinite'
			},

			backgroundImage: {
				'gradient-primary': 'var(--gradient-primary)',
				'gradient-background': 'var(--gradient-background)',
				'gradient-card': 'var(--gradient-card)'
			},
			boxShadow: {
				'glow': 'var(--shadow-glow)',
				'card': 'var(--shadow-card)',
				'popover': 'var(--shadow-popover)',
				'raised': 'var(--shadow-raised)',
				'brand': 'var(--shadow-brand)',
				'dialog': 'var(--shadow-dialog)',
				'elevated': 'var(--shadow-elevated)'
			}
		}
	},
	plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
