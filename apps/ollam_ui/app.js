import { OllamaClient } from './js/client.js';
import { SettingsManager } from './js/settings.js';
import { UIController } from './js/ui.js';

// Initialize
const settingsManager = new SettingsManager();
const ollamaClient = new OllamaClient(settingsManager.settings.ollamaUrl, settingsManager.settings.geminiApiKey);
const uiController = new UIController(ollamaClient);
