import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { locale, t, translations } from '../../src/state/i18n';

describe('i18n Localization Store', () => {
    it('should initialize locale based on window or defaults', () => {
        const currentLocale = get(locale);
        expect(['en', 'ru']).toContain(currentLocale);
    });

    it('should translate keys correctly for active English locale', () => {
        locale.set('en');
        const translate = get(t);

        expect(translate('title')).toBe('Vectoria');
        expect(translate('equations')).toBe('Equations');
        expect(translate('tool_move')).toBe('Move');
    });

    it('should translate keys correctly after switching to Russian locale', () => {
        locale.set('ru');
        const translate = get(t);

        expect(translate('title')).toBe('Vectoria');
        expect(translate('equations')).toBe('Уравнения');
        expect(translate('tool_move')).toBe('Двигать');
    });

    it('should fall back to raw key if translation is missing', () => {
        locale.set('en');
        const translate = get(t);
        
        // We cast to any to test invalid keys
        expect(translate('non_existent_key' as any)).toBe('non_existent_key');
    });

    it('should verify translations contain matching keys in both locales', () => {
        const enKeys = Object.keys(translations.en).sort();
        const ruKeys = Object.keys(translations.ru).sort();
        expect(enKeys).toEqual(ruKeys);
    });
});
