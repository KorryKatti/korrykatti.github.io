const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const OUTPUT_FILE = path.join(ROOT_DIR, 'search-index.json');

// Stop words to filter out from auto-generated keywords
const STOP_WORDS = new Set([
    'the', 'and', 'a', 'an', 'of', 'to', 'in', 'is', 'that', 'this', 'it', 'on', 'for', 'with', 
    'as', 'was', 'at', 'by', 'but', 'are', 'from', 'or', 'be', 'an', 'your', 'my', 'me', 'we', 
    'they', 'you', 'he', 'she', 'his', 'her', 'its', 'their', 'our', 'will', 'would', 'should', 
    'can', 'could', 'about', 'more', 'some', 'any', 'one', 'all', 'has', 'have', 'had', 'been',
    'cuz', 'wip', 'hello', 'here', 'there', 'what', 'which', 'who', 'whom', 'whose', 'when', 'where',
    'just', 'really', 'simply', 'actually', 'mostly', 'only', 'very', 'than', 'then', 'also', 'some'
]);

function extractTitle(html) {
    const match = html.match(/<title>([\s\S]*?)<\/title>/i);
    let title = match ? match[1].trim() : '';
    if (!title || title.toLowerCase() === 'untitled') {
        const h1Match = html.match(/<h1[^>]*?>([\s\S]*?)<\/h1>/i);
        if (h1Match) {
            title = h1Match[1].replace(/<[^>]+>/g, '').trim();
        } else {
            const h2Match = html.match(/<h2[^>]*?>([\s\S]*?)<\/h2>/i);
            if (h2Match) {
                title = h2Match[1].replace(/<[^>]+>/g, '').trim();
            }
        }
    }
    return title || 'untitled';
}

function extractDescription(html) {
    let match = html.match(/<meta[^>]*?name=["']description["'][^>]*?content=["']([\s\S]*?)["']/i);
    if (!match) {
        match = html.match(/<meta[^>]*?content=["']([\s\S]*?)["'][^>]*?name=["']description["']/i);
    }
    if (!match) {
        match = html.match(/<meta[^>]*?property=["']og:description["'][^>]*?content=["']([\s\S]*?)["']/i);
    }
    if (!match) {
        match = html.match(/<meta[^>]*?content=["']([\s\S]*?)["'][^>]*?property=["']og:description["']/i);
    }
    return match ? match[1].trim() : '';
}

function extractKeywords(html) {
    // Clean text: strip script, style, and HTML tags
    const cleanText = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .toLowerCase();
    
    // Extract lowercased alphabetic words
    const words = cleanText.match(/\b[a-z]{3,20}\b/g) || [];
    
    // Build frequency map
    const wordFreq = {};
    words.forEach(word => {
        if (!STOP_WORDS.has(word)) {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
    });
    
    // Sort words by frequency
    const sortedWords = Object.keys(wordFreq).sort((a, b) => wordFreq[b] - wordFreq[a]);
    
    // Take top 15 words as keywords
    return sortedWords.slice(0, 15);
}

const DIMENSIONS = {
    code_tech: ['code', 'programming', 'developer', 'software', 'javascript', 'build', 'websockets', 'mirage', 'apps', 'technical', 'uploaded', 'uploader', 'mnist', 'ollama', 'ai', 'neural', 'interpreter', 'learning', 'chess', 'searcher', 'system', 'server', 'data'],
    writing_philosophy: ['writing', 'blog', 'posts', 'thoughts', 'essay', 'memories', 'creative', 'catalog', 'article', 'introspection', 'notes', 'speculative', 'reality', 'mind', 'consciousness'],
    audio_ambient: ['music', 'soundscape', 'ambient', 'audio', 'listen', 'focus', 'sound', 'lofi', 'rain', 'concentration', 'concentration', 'player', 'bgm'],
    space_physics: ['space', 'satellite', 'orbit', 'future', 'signal', 'sky', 'earth', 'astronauts', 'time', 'speed', 'travel', 'broadcasting'],
    privacy_minimalism: ['privacy', 'minimalist', 'data', 'screen', 'digital', 'footprint', 'security', 'platforms', 'decoupling', 'clean', 'simple'],
    hardware_tactile: ['keyboard', 'switch', 'tactile', 'type', 'build', 'hardware', 'tech', 'physical', 'switches', 'typing'],
    social_connection: ['guestbook', 'contact', 'chat', 'message', 'transmit', 'signals', 'visitor', 'feedback', 'signature', 'beep', 'communication'],
    personal_history: ['yearly', 'retrospective', 'college', 'career', 'projects', 'progress', 'history', 'learn', 'failures', 'milestones', 'timeline', 'devlog']
};

function computeVector(html) {
    const cleanText = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .toLowerCase();
    
    const words = cleanText.match(/\b[a-z]{3,20}\b/g) || [];
    const freqs = {};
    words.forEach(w => freqs[w] = (freqs[w] || 0) + 1);

    const vector = Object.keys(DIMENSIONS).map(dim => {
        let val = 0;
        DIMENSIONS[dim].forEach(seed => {
            if (freqs[seed]) {
                val += freqs[seed];
            }
        });
        return val;
    });

    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
        return vector.map(v => Number((v / magnitude).toFixed(4)));
    }
    return vector;
}

function scanDirectory(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            // Skip .git, .vscode, assets directories
            if (file !== '.git' && file !== '.vscode' && file !== 'assets' && file !== 'node_modules') {
                scanDirectory(filePath, fileList);
            }
        } else if (stat.isFile() && path.extname(file) === '.html') {
            fileList.push(filePath);
        }
    });

    return fileList;
}

function buildIndex() {
    console.log('Scanning directories for pages...');
    const htmlFiles = scanDirectory(ROOT_DIR);
    const index = [];

    htmlFiles.forEach(file => {
        const relativePath = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
        
        // Skip 404 and duplicate desktop indexes
        if (relativePath.includes('404.html') || relativePath.includes('desktopindex.html')) {
            return;
        }

        console.log(`Processing: ${relativePath}`);
        const content = fs.readFileSync(file, 'utf8');
        
        const title = extractTitle(content);
        let snippet = extractDescription(content);
        
        // If snippet/description is empty, grab the first paragraph as snippet
        if (!snippet) {
            const pMatch = content.match(/<p[^>]*?>([\s\S]*?)<\/p>/i);
            if (pMatch) {
                snippet = pMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 160) + '...';
            } else {
                snippet = 'personal static page on korry\'s web archive.';
            }
        }

        const keywords = extractKeywords(content);
        const vector = computeVector(content);

        index.push({
            title,
            url: relativePath,
            snippet,
            keywords,
            vector
        });
    });

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(index, null, 4), 'utf8');
    console.log(`Index successfully built at: ${OUTPUT_FILE}`);
}

buildIndex();
