export class HistoryManager {
    constructor() {
        this.storageKey = 'ollama_chat_history';
        this.chats = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
        this.currentChatId = null;
    }

    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.chats));
        } catch (e) {
            console.error('Failed to save to localStorage (quota exceeded?):', e);
        }
    }

    createNewChat() {
        const id = Date.now().toString();
        const newChat = {
            id: id,
            title: 'New Chat',
            messages: [],
            timestamp: id
        };
        this.chats.unshift(newChat);
        this.currentChatId = id;
        this.save();
        return newChat;
    }

    addMessage(id, role, text, imageData = null) {
        const chat = this.chats.find(c => c.id === id);
        if (chat) {
            chat.messages.push({ role, text, imageData });
            if (chat.messages.length === 1 && role === 'user') {
                chat.title = text.substring(0, 30) + (text.length > 30 ? '...' : '');
            }
            this.save();
            return chat.messages.length - 1;
        }
        return -1;
    }

    updateMessage(id, index, text, imageData = null) {
        const chat = this.chats.find(c => c.id === id);
        if (chat && chat.messages[index]) {
            chat.messages[index].text = text;
            if (imageData) chat.messages[index].imageData = imageData;
            this.save();
        }
    }

    deleteChat(id) {
        this.chats = this.chats.filter(c => c.id !== id);
        this.save();
    }

    clearAll() {
        this.chats = [];
        this.save();
    }

    getChat(id) {
        return this.chats.find(c => c.id === id);
    }
}
