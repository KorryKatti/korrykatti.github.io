export class OllamaClient {
    constructor(baseUrl = 'http://localhost:11434', geminiApiKey = '') {
        this.baseUrl = baseUrl;
        this.geminiApiKey = geminiApiKey;
    }

    async checkStatus() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            return response.ok;
        } catch (error) {
            // If Ollama is down but we have a Gemini key, we might still consider it "Online" in a way
            // but the status indicator is specifically for Ollama status usually.
            return false;
        }
    }

    async listModels() {
        const models = [];
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            if (response.ok) {
                const data = await response.json();
                if (data.models) models.push(...data.models);
            }
        } catch (error) {
            console.error('Error listing Ollama models:', error);
        }

        // Add Gemini models if API key is present
        if (this.geminiApiKey) {
            models.push({
                name: 'gemini-2.5-flash-lite',
                details: { family: 'gemini' }
            });
            models.push({
                name: 'gemini-2.5-flash',
                details: { family: 'gemini' }
            });
        }

        return models;
    }

    async getModelInfo(modelName) {
        if (modelName.startsWith('gemini-')) {
            return {
                name: modelName,
                contextLimit: 128000, // Common for Gemini 2.0
                family: 'gemini'
            };
        }

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
        if (model.startsWith('gemini-')) {
            return this.chatGemini(model, prompt, systemPrompt, onChunk, abortSignal);
        }

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

    async chatGemini(model, prompt, systemPrompt, onChunk, abortSignal) {
        try {
            // Map UI names to actual Gemini API model names if needed
            let actualModel = model;
            if (model === 'gemini-2.5-flash-lite') actualModel = 'gemini-2.5-flash-lite';
            if (model === 'gemini-2.5-flash') actualModel = 'gemini-2.5-flash';

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:streamGenerateContent?alt=sse&key=${this.geminiApiKey}`;
            
            const body = {
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: prompt }]
                    }
                ],
                systemInstruction: systemPrompt ? {
                    parts: [{ text: systemPrompt }]
                } : undefined
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: abortSignal
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Failed to start Gemini chat');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const json = JSON.parse(line.substring(6));
                            const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
                            onChunk(text, false);
                        } catch (e) {
                            // Partial or invalid JSON
                        }
                    }
                }
            }
            onChunk('', true); // Done
        } catch (error) {
            console.error('Gemini Chat error:', error);
            throw error;
        }
    }
}
