export class OllamaClient {
    constructor(baseUrl = 'http://localhost:11434') {
        this.baseUrl = baseUrl;
    }

    async checkStatus() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async listModels() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            const data = await response.json();
            return data.models || [];
        } catch (error) {
            console.error('Error listing models:', error);
            return [];
        }
    }

    async getModelInfo(modelName) {
        try {
            const response = await fetch(`${this.baseUrl}/api/show`, {
                method: 'POST',
                body: JSON.stringify({ name: modelName })
            });
            const data = await response.json();

            // Try to find context limit in parameter string
            let contextLimit = null;
            if (data.parameters) {
                const match = data.parameters.match(/num_ctx\s+(\d+)/);
                if (match) contextLimit = parseInt(match[1]);
            }
            return { ...data, contextLimit };
        } catch (error) {
            console.error('Error fetching model info:', error);
            return null;
        }
    }

    async chat(model, prompt, systemPrompt, onChunk, abortSignal) {
        try {
            const body = {
                model: model,
                prompt: prompt,
                stream: true
            };
            if (systemPrompt) body.system = systemPrompt;

            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: abortSignal
            });

            if (!response.ok) throw new Error('Failed to start chat');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const json = JSON.parse(line);
                        onChunk(json.response, json.done);
                    } catch (e) {
                        // Partial JSON
                    }
                }
            }
        } catch (error) {
            console.error('Chat error:', error);
            throw error;
        }
    }
}
