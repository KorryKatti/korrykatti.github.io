export class HistoryManager {
    constructor() {
        this.storageKey = 'ollama_chat_history';
        this.chats = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
        this.currentChatId = null;
        this.ensureMessageIds();
    }

    ensureMessageIds() {
        let changed = false;
        this.chats.forEach(chat => {
            chat.messages.forEach((msg, idx) => {
                if (!msg.id) {
                    msg.id = (chat.id || Date.now().toString()) + '-' + idx + '-' + Math.random().toString(36).substring(2, 5);
                    changed = true;
                }
            });
        });
        if (changed) this.save();
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

    addMessage(chatId, role, text, imageData = null) {
        const chat = this.chats.find(c => c.id === chatId);
        if (chat) {
            const messageId = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9);
            const newMessage = { id: messageId, role, text, imageData, timestamp: Date.now() };
            chat.messages.push(newMessage);
            if (chat.messages.length === 1 && role === 'user') {
                chat.title = text.substring(0, 30) + (text.length > 30 ? '...' : '');
            }
            this.save();
            return messageId;
        }
        return null;
    }

    updateMessage(chatId, messageId, text, imageData = null) {
        const chat = this.chats.find(c => c.id === chatId);
        if (chat) {
            let message = chat.messages.find(m => m.id === messageId);
            // Fallback for old numeric index usage if message not found by string ID
            if (!message && (typeof messageId === 'number' || !isNaN(messageId))) {
                message = chat.messages[parseInt(messageId)];
            }
            
            if (message) {
                message.text = text;
                if (imageData) message.imageData = imageData;
                this.save();
            }
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
