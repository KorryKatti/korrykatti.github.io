const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const OUTPUT_FILE = path.join(ROOT_DIR, 'search-index.json');

// Stop words to filter out from machine learning embeddings unigrams
const STOP_WORDS = new Set([
    'the', 'and', 'a', 'an', 'of', 'to', 'in', 'is', 'that', 'this', 'it', 'on', 'for', 'with', 
    'as', 'was', 'at', 'by', 'but', 'are', 'from', 'or', 'be', 'an', 'your', 'my', 'me', 'we', 
    'they', 'you', 'he', 'she', 'his', 'her', 'its', 'their', 'our', 'will', 'would', 'should', 
    'can', 'could', 'about', 'more', 'some', 'any', 'one', 'all', 'has', 'have', 'had', 'been',
    'cuz', 'wip', 'hello', 'here', 'there', 'what', 'which', 'who', 'whom', 'whose', 'when', 'where',
    'just', 'really', 'simply', 'actually', 'mostly', 'only', 'very', 'than', 'then', 'also', 'some',
    'get', 'got', 'hasn', 'don', 'doesn', 'haven', 'isn', 'wasn', 'weren', 'wouldn', 'shouldn'
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

function getCleanContent(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenize(text) {
    const cleanText = getCleanContent(text).toLowerCase();
    return (cleanText.match(/\b[a-z]{3,20}\b/g) || [])
        .filter(w => !STOP_WORDS.has(w));
}

function scanDirectory(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            if (file !== '.git' && file !== '.vscode' && file !== 'assets' && file !== 'node_modules') {
                scanDirectory(filePath, fileList);
            }
        } else if (stat.isFile() && path.extname(file) === '.html') {
            fileList.push(filePath);
        }
    });

    return fileList;
}

// Symmetric Singular Value / Eigenvalue decomposition using Power Iteration & Deflation
function trainSpectralEmbeddings(coocMatrix, dimensions = 8, maxIter = 100) {
    const n = coocMatrix.length;
    const vectors = [];
    const eigenvalues = [];
    
    // Copy matrix to allow destructive deflation
    const matrix = coocMatrix.map(row => [...row]);

    for (let d = 0; d < dimensions; d++) {
        // Initialize random vector
        let v = new Array(n).fill(0).map(() => Math.random() - 0.5);
        let magnitude = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
        if (magnitude === 0) magnitude = 1;
        v = v.map(x => x / magnitude);
        
        let prevV = [...v];
        for (let iter = 0; iter < maxIter; iter++) {
            // nextV = Matrix * v
            let nextV = new Array(n).fill(0);
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    nextV[i] += matrix[i][j] * v[j];
                }
            }
            
            // Gram-Schmidt orthogonalization against previous eigenvectors
            for (let prevD = 0; prevD < d; prevD++) {
                const dot = nextV.reduce((s, x, idx) => s + x * vectors[prevD][idx], 0);
                for (let i = 0; i < n; i++) {
                    nextV[i] -= dot * vectors[prevD][i];
                }
            }
            
            // Normalize
            magnitude = Math.sqrt(nextV.reduce((s, x) => s + x * x, 0));
            if (magnitude === 0) break;
            v = nextV.map(x => x / magnitude);
            
            // Check convergence
            let diff = 0;
            for (let i = 0; i < n; i++) diff += Math.abs(v[i] - prevV[i]);
            if (diff < 1e-6) break;
            prevV = [...v];
        }
        
        // Compute eigenvalue
        let nextV = new Array(n).fill(0);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                nextV[i] += matrix[i][j] * v[j];
            }
        }
        const ev = v.reduce((s, x, idx) => s + x * nextV[idx], 0);
        
        vectors.push(v);
        eigenvalues.push(ev);
        
        // Deflate matrix: A = A - ev * v * v^T
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                matrix[i][j] -= ev * v[i] * v[j];
            }
        }
    }
    
    // Construct word embeddings: coord_k = sqrt(eigenvalue_k) * vector_k
    const embeddings = [];
    for (let i = 0; i < n; i++) {
        const embed = [];
        for (let d = 0; d < dimensions; d++) {
            const val = eigenvalues[d] > 0 ? Math.sqrt(eigenvalues[d]) * vectors[d][i] : 0;
            embed.push(Number(val.toFixed(4)));
        }
        embeddings.push(embed);
    }
    
    return embeddings;
}

function buildIndex() {
    console.log('Scanning directories for pages...');
    const htmlFiles = scanDirectory(ROOT_DIR);
    const docs = [];
    
    // Step 1: Parse documents and gather raw token lists
    const allDocTokens = [];
    const wordCounts = {};

    htmlFiles.forEach(file => {
        const relativePath = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
        
        // Skip 404 and duplicate desktop indexes
        if (relativePath.includes('404.html') || relativePath.includes('desktopindex.html')) {
            return;
        }

        console.log(`Reading: ${relativePath}`);
        const content = fs.readFileSync(file, 'utf8');
        
        const title = extractTitle(content);
        let snippet = extractDescription(content);
        
        if (!snippet) {
            const pMatch = content.match(/<p[^>]*?>([\s\S]*?)<\/p>/i);
            if (pMatch) {
                snippet = pMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 160) + '...';
            } else {
                snippet = 'personal static page on korry\'s web archive.';
            }
        }

        const tokens = tokenize(content);
        tokens.forEach(w => {
            wordCounts[w] = (wordCounts[w] || 0) + 1;
        });

        allDocTokens.push({
            title,
            url: relativePath,
            snippet,
            tokens,
            cleanContent: getCleanContent(content)
        });
    });

    // Step 2: Build vocabulary (keep words appearing frequently enough)
    const vocab = Object.keys(wordCounts)
        .filter(w => wordCounts[w] >= 2) // must occur in at least 2 contexts
        .sort((a, b) => wordCounts[b] - wordCounts[a])
        .slice(0, 300); // keep top 300 words for perfect dense representation

    const vocabIdx = {};
    vocab.forEach((word, idx) => {
        vocabIdx[word] = idx;
    });

    console.log(`Vocabulary trained. Total unique semantic features: ${vocab.length}`);

    // Step 3: Compute word-word co-occurrence counts using sliding window
    const vocabSize = vocab.length;
    const cooc = Array.from({ length: vocabSize }, () => new Array(vocabSize).fill(0));
    const WINDOW_SIZE = 8;

    allDocTokens.forEach(doc => {
        const tokens = doc.tokens.filter(t => t in vocabIdx);
        for (let i = 0; i < tokens.length; i++) {
            const w1Idx = vocabIdx[tokens[i]];
            const start = Math.max(0, i - WINDOW_SIZE);
            const end = Math.min(tokens.length - 1, i + WINDOW_SIZE);
            for (let j = start; j <= end; j++) {
                if (i === j) continue;
                const w2Idx = vocabIdx[tokens[j]];
                cooc[w1Idx][w2Idx] += 1;
            }
        }
    });

    // Step 4: Convert co-occurrences to PPMI (Positive Pointwise Mutual Information) matrix
    const ppmi = Array.from({ length: vocabSize }, () => new Array(vocabSize).fill(0));
    const colSums = new Array(vocabSize).fill(0);
    let totalSum = 0;
    
    for (let i = 0; i < vocabSize; i++) {
        for (let j = 0; j < vocabSize; j++) {
            colSums[i] += cooc[i][j];
        }
        totalSum += colSums[i];
    }

    if (totalSum > 0) {
        for (let i = 0; i < vocabSize; i++) {
            for (let j = 0; j < vocabSize; j++) {
                if (cooc[i][j] > 0) {
                    const num = cooc[i][j] * totalSum;
                    const den = colSums[i] * colSums[j];
                    const val = Math.log2(num / den);
                    ppmi[i][j] = val > 0 ? val : 0;
                }
            }
        }
    }

    // Step 5: Factorize PPMI matrix to get dense 8-dimensional Word Vectors
    console.log('Training spectral latent word embeddings via Singular Value Decomposition...');
    const wordEmbeddings = trainSpectralEmbeddings(ppmi, 8);
    
    // Build word vectors lookup dictionary
    const wordVectors = {};
    vocab.forEach((word, idx) => {
        wordVectors[word] = wordEmbeddings[idx];
    });

    // Step 6: Compute document vectors from average of word embeddings
    console.log('Mapping documents into latent concept space...');
    allDocTokens.forEach(doc => {
        const validTokens = doc.tokens.filter(t => t in wordVectors);
        let docVec = new Array(8).fill(0);
        
        if (validTokens.length > 0) {
            validTokens.forEach(t => {
                const vec = wordVectors[t];
                for (let d = 0; d < 8; d++) {
                    docVec[d] += vec[d];
                }
            });
            
            // Normalize to unit length
            const magnitude = Math.sqrt(docVec.reduce((s, x) => s + x * x, 0));
            if (magnitude > 0) {
                docVec = docVec.map(x => Number((x / magnitude).toFixed(4)));
            }
        }

        // Top 15 keywords for exact match fallback
        const wordFreq = {};
        doc.tokens.forEach(t => {
            wordFreq[t] = (wordFreq[t] || 0) + 1;
        });
        const keywords = Object.keys(wordFreq)
            .sort((a, b) => wordFreq[b] - wordFreq[a])
            .slice(0, 15);

        docs.push({
            title: doc.title,
            url: doc.url,
            snippet: doc.snippet,
            keywords: keywords,
            vector: docVec,
            content: doc.cleanContent
        });
    });

    // Step 7: Save model payload (wordVectors dictionary + documents index)
    const payload = {
        wordVectors,
        documents: docs
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 4), 'utf8');
    console.log(`Latent Semantic Analysis search-index saved successfully at: ${OUTPUT_FILE}`);
}

buildIndex();
