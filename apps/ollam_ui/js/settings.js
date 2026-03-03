export class SettingsManager {
    constructor(onUpdate) {
        this.storageKey = 'ollama_settings';
        this.onUpdate = onUpdate;
        this.defaults = {
            contextLimit: 4096,
            ollamaUrl: 'http://localhost:11434',
            theme: 'dark',
            username: 'Local User',
            systemPrompt: '',
            includeTime: false,
            avatar: null,
            aiName: 'Assistant',
            aiAvatar: null,
            unsplashKey: '',
            safeSearch: true,
            disableTokenLimit: false
        };
        this.settings = { ...this.defaults, ...JSON.parse(localStorage.getItem(this.storageKey) || '{}') };
        this.applyTheme();
    }

    save() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
        this.applyTheme();
        if (this.onUpdate) this.onUpdate(this.settings);
    }

    update(key, value) {
        this.settings[key] = value;
        this.save();
    }

    applyTheme() {
        if (this.settings.theme === 'dark') {
            document.body.classList.add('dark');
        } else {
            document.body.classList.remove('dark');
        }
    }
}
