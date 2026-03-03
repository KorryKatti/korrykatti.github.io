export class SearchService {
    constructor() {
        this.instances = [
            'https://searxng.site/search',
            'https://searx.be/search',
            'https://searx.fmac.xyz/search'
        ];
    }

    async search(query, type = 'text', safeSearch = true) {
        console.log(`[SearchService] Starting ${type} search for: "${query}" (Safe: ${safeSearch})`);
        // SearXNG safe search: 0 (none), 1 (moderate), 2 (strict)
        const safeVal = safeSearch ? 2 : 0;

        for (const instance of this.instances) {
            try {
                let url = `${instance}?q=${encodeURIComponent(query)}&format=json&language=en&safesearch=${safeVal}`;
                if (type === 'images') url += '&categories=images';

                console.log(`[SearchService] Fetching from: ${instance}`);
                const response = await fetch(url);
                if (!response.ok) {
                    console.warn(`[SearchService] ${instance} returned status: ${response.status}`);
                    continue;
                }

                const data = await response.json();
                if (!data.results || data.results.length === 0) {
                    console.warn(`[SearchService] No results from ${instance}`);
                    continue;
                }

                console.log(`[SearchService] Successfully found ${data.results.length} results from ${instance}`);
                return data.results.slice(0, 5).map(r => ({
                    title: r.title || 'Untitled Result',
                    url: r.url || r.image_url || r.img_src,
                    thumbnail: r.thumbnail_src || r.img_src || r.thumbnail,
                    content: r.content || r.title || 'No description available'
                }));
            } catch (e) {
                console.error(`[SearchService] Error with ${instance}:`, e);
                continue;
            }
        }
        console.error('[SearchService] All search instances failed.');
        return [];
    }
}
