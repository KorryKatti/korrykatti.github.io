class NekosAPI {
    constructor() {
        this.baseUrl = 'https://api.nekosapi.com/v4';
    }

    async fetchImage(query) {
        console.log(`[NekosAPI] Searching for: "${query}"`);
        try {
            // Convert spaces to underscores for tags, common in booru-style APIs
            const tag = query.toLowerCase().replace(/\s+/g, '_');
            const url = `${this.baseUrl}/images?limit=1&offset=0&tag=${encodeURIComponent(tag)}`;

            const response = await fetch(url);
            if (!response.ok) return null;

            const data = await response.json();
            if (data.items && data.items.length > 0) {
                const img = data.items[0];
                return {
                    url: img.url,
                    artist: img.artist ? img.artist.name : 'Unknown',
                    provider: 'NekosAPI',
                    rating: img.rating
                };
            }

            // Fallback: Just get random from the API if tag fails
            const randomUrl = `${this.baseUrl}/images?limit=1&offset=${Math.floor(Math.random() * 100)}`;
            const randomRes = await fetch(randomUrl);
            if (!randomRes.ok) return null;
            const randomData = await randomRes.json();
            if (randomData.items && randomData.items.length > 0) {
                const img = randomData.items[0];
                return {
                    url: img.url,
                    artist: img.artist ? img.artist.name : 'Unknown',
                    provider: 'NekosAPI',
                    rating: img.rating
                };
            }
            return null;
        } catch (e) {
            console.error('[NekosAPI] Error:', e);
            return null;
        }
    }
}

export class ImageService {
    constructor() {
        this.nekosiaBase = 'https://api.nekosia.cat/api/v1/images';
        this.nekosApi = new NekosAPI();
        this.categories = [
            'catgirl', 'foxgirl', 'wolfgirl', 'animal-ears', 'tail', 'tail-with-ribbon', 'tail-from-under-skirt',
            'cute', 'cuteness-is-justice', 'blue-archive', 'girl', 'young-girl', 'maid', 'maid-uniform', 'vtuber', 'w-sitting', 'lying-down', 'hands-forming-a-heart', 'wink', 'valentine', 'headphones',
            'thigh-high-socks', 'knee-high-socks', 'white-tights', 'black-tights', 'heterochromia', 'uniform', 'sailor-uniform', 'hoodie', 'ribbon', 'white-hair', 'blue-hair', 'long-hair', 'blonde', 'blue-eyes', 'purple-eyes', 'random'
        ];
    }

    detectCategory(query) {
        const lowerQuery = query.toLowerCase();
        for (const cat of this.categories) {
            // Replace hyphens with spaces for better matching
            const term = cat.replace(/-/g, ' ');
            if (lowerQuery.includes(term) || lowerQuery.includes(cat)) {
                return cat;
            }
        }
        return 'random';
    }

    async fetchAnimeImage(query, safeSearch = true) {
        if (!safeSearch) {
            console.log(`[ImageService] Safe search is OFF. Priority: NekosAPI v4`);
            const result = await this.nekosApi.fetchImage(query);
            if (result) return result;
        }

        const category = this.detectCategory(query);
        console.log(`[ImageService] Fetching via Nekosia for category: ${category} (Safe: ${safeSearch})`);
        try {
            const response = await fetch(`${this.nekosiaBase}/${category}`);
            const data = await response.json();
            if (data.success && data.image && data.image.original) {
                if (!safeSearch || data.rating === 'safe') {
                    return {
                        url: data.image.original.url,
                        source: data.source ? data.source.url : null,
                        artist: data.attribution && data.attribution.artist ? data.attribution.artist.username : 'Unknown',
                        provider: 'Nekosia',
                        rating: data.rating
                    };
                }
            }
            return null;
        } catch (e) {
            console.error('Nekosia fetch error:', e);
            return null;
        }
    }
}

export class GeneralImageService {
    async fetchImage(query, apiKey = null, safeSearch = true) {
        if (!apiKey) {
            console.log('[GeneralImageService] No Unsplash key provided, skipping direct API call.');
            return null;
        }

        console.log(`[GeneralImageService] Fetching from Unsplash API for: "${query}" (Safe: ${safeSearch})`);
        try {
            // Unsplash content_filter: low or high. High is safer.
            const contentFilter = safeSearch ? 'high' : 'low';
            const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&content_filter=${contentFilter}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Client-ID ${apiKey}`
                }
            });

            if (!response.ok) {
                console.error(`[GeneralImageService] Unsplash API error: ${response.status}`);
                return null;
            }

            const data = await response.json();
            if (data.results && data.results.length > 0) {
                const img = data.results[0];
                return {
                    url: img.urls.regular,
                    title: img.description || img.alt_description || `Visual result for "${query}"`,
                    artist: img.user ? img.user.name : 'Unknown Artist',
                    provider: 'Unsplash'
                };
            }
            console.warn('[GeneralImageService] No results from Unsplash API.');
        } catch (e) {
            console.error('[GeneralImageService] Unsplash fetch failed:', e);
        }
        return null;
    }
}
