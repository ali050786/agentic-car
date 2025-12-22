/**
 * Fetches an image URL and converts it to base64 data URI
 */
export const imageUrlToBase64 = async (url: string): Promise<string> => {
    try {
        // Use backend proxy to avoid CORS issues
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;

        const response = await fetch(proxyUrl, {
            mode: 'cors',
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    URL.revokeObjectURL(blobUrl);
                    reject(new Error('Canvas context failed'));
                    return;
                }
                ctx.drawImage(img, 0, 0);
                const pngBase64 = canvas.toDataURL('image/png');
                URL.revokeObjectURL(blobUrl);
                resolve(pngBase64);
            };
            img.onerror = () => {
                URL.revokeObjectURL(blobUrl);
                reject(new Error('Image load failed'));
            };
            img.src = blobUrl;
        });
    } catch (error) {
        console.error('Failed to convert image to base64:', error);
        // Return a 1x1 transparent PNG as a safe fallback
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    }
};

/**
 * Creates a circular clipped version of an image using Canvas
 * Returns base64 data URI of the circular image for Figma compatibility
 */
export const createCircularImage = async (imageUrl: string, size: number = 88): Promise<string> => {
    try {
        // Create a canvas
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('Could not get canvas context');
        }

        // Load the image
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Handle CORS

        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imageUrl;
        });

        // Create circular clipping path
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        // Draw the image to fill the circle (cover fit)
        const scale = Math.max(size / img.width, size / img.height);
        const x = (size - img.width * scale) / 2;
        const y = (size - img.height * scale) / 2;

        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

        // Convert canvas to base64
        return canvas.toDataURL('image/png');
    } catch (error) {
        console.error('Failed to create circular image:', error);
        // Return empty transparent circle on error
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#CCCCCC';
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        return canvas.toDataURL('image/png');
    }
};

/**
 * Scans an element for <image> tags and converts external URLs to base64
 * This is crucial for html2canvas to render images correctly in PDF/JPG exports
 */
export const embedImagesInSvg = async (element: Element): Promise<void> => {
    const images = Array.from(element.querySelectorAll('image'));

    // Process all images in parallel
    await Promise.all(images.map(async (img) => {
        const href = img.getAttribute('href') || img.getAttribute('xlink:href');

        if (href && (href.startsWith('http') || href.startsWith('//'))) {
            try {
                // Add crossOrigin attribute just in case
                img.setAttribute('crossOrigin', 'anonymous');

                // Fetch and convert to base64
                const base64 = await imageUrlToBase64(href);

                // Update attributes
                img.setAttribute('href', base64);
                img.setAttribute('xlink:href', base64);
            } catch (err) {
                console.warn('Failed to embed image:', href, err);
            }
        }
    }));
};
