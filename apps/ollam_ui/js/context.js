export class ContextManager {
    constructor(limit = 4096) {
        this.limit = limit;
        this.currentSize = 0;
    }

    setLimit(limit) {
        this.limit = limit || 4096;
    }

    estimateTokens(text) {
        // Rough estimation: 4 characters per token
        return Math.ceil(text.length / 4);
    }

    update(text) {
        this.currentSize = this.estimateTokens(text);
        return {
            size: this.currentSize,
            ratio: (this.currentSize / this.limit),
            isFull: this.currentSize >= this.limit,
            isNear: this.currentSize >= this.limit * 0.8
        };
    }
}
