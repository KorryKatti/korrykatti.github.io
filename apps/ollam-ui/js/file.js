export class FileManager {
    constructor() {
        this.attachments = [];
    }

    async extractText(file, onProgress) {
        const type = file.type;
        if (type === 'text/plain') {
            return await file.text();
        } else if (type === 'application/pdf') {
            return await this.extractPdfText(file);
        } else if (type.startsWith('image/')) {
            return await this.extractImageText(file, onProgress);
        }
        return '';
    }

    async extractPdfText(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            // Using a dynamic import for PDF.js to handle the ESM module correctly
            const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                fullText += content.items.map(item => item.str).join(' ') + '\n';
            }
            return fullText;
        } catch (e) {
            console.error('PDF extraction error:', e);
            throw new Error('Failed to extract text from PDF.');
        }
    }

    async extractImageText(file, onProgress) {
        try {
            // Preprocess image for better OCR accuracy
            const processedBlob = await this.preprocessImage(file);

            // Create a worker for more granular control if needed, 
            // but for simplicity and v5 compatibility, we'll use recognize with options
            const result = await Tesseract.recognize(processedBlob, 'eng', {
                logger: m => {
                    if (m.status === 'recognizing text' && onProgress) {
                        onProgress(Math.floor(m.progress * 100));
                    }
                }
            });

            return result.data.text;
        } catch (e) {
            console.error('OCR error:', e);
            throw new Error('Failed to perform OCR on image.');
        }
    }

    async preprocessImage(file) {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                // OCR Optimization Pass:
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                // 1. Grayscale & find min/max for normalization
                let min = 255, max = 0;
                const grays = new Uint8Array(data.length / 4);

                for (let i = 0; i < data.length; i += 4) {
                    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                    grays[i / 4] = gray;
                    if (gray < min) min = gray;
                    if (gray > max) max = gray;
                }

                // 2. Normalize and stretch contrast
                const range = max - min || 1;
                for (let i = 0; i < data.length; i += 4) {
                    let g = grays[i / 4];
                    // Stretch to 0-255
                    g = ((g - min) / range) * 255;

                    // Sigmoid-like contrast boost (push darks darker, lights lighter)
                    if (g < 128) g = Math.max(0, g * 0.7);
                    else g = Math.min(255, g * 1.3);

                    data[i] = data[i + 1] = data[i + 2] = g;
                }

                ctx.putImageData(imageData, 0, 0);

                // 3. Final Sharpen/Contrast pass using browser filters
                ctx.filter = 'contrast(1.4) brightness(1.1) sharpen(1.2)';
                ctx.drawImage(canvas, 0, 0);

                canvas.toBlob((blob) => {
                    URL.revokeObjectURL(img.src);
                    resolve(blob);
                }, 'image/png');
            };
        });
    }
}
