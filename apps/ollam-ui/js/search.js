export class SearchService {
    constructor(baseUrl = "https://ollamas-ahh.onrender.com") {
        this.baseUrl = baseUrl;
    }

    async search(query, type = 'text', safeSearch = true) {
        console.log(`[SearchService] Starting ${type} search for: "${query}" (Safe: ${safeSearch})`);

        try {
            const safeVal = safeSearch ? "moderate" : "off";
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                console.warn(`[SearchService] Search request timed out after 30s`);
                controller.abort();
            }, 30000); // Increased to 30 seconds for slow backends (e.g. Render cold start)

            console.log(`[SearchService] Fetching from local backend: ${this.baseUrl}/search`);
            const response = await fetch(`${this.baseUrl}/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    max_results: 5,
                    safe_search: safeVal
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errText = await response.text().catch(() => 'No error body');
                console.warn(`[SearchService] Backend returned status: ${response.status}. Body: ${errText}`);
                return [];
            }

            const data = await response.json();
            if (!data.results || data.results.length === 0) {
                console.warn(`[SearchService] No results from search engine`);
                return [];
            }

            console.log(`[SearchService] Successfully found ${data.results.length} results`);

            // Map result to format expected by UI
            return data.results.map(r => ({
                title: r.title || 'Untitled Result',
                url: r.url || '#',
                thumbnail: null, // DuckDuckGo text search doesn't provide thumbnails in this format easily
                content: r.content || 'No description available'
            }));
        } catch (e) {
            console.error(`[SearchService] Error with local search:`, e);
            return [];
        }
    }
}

