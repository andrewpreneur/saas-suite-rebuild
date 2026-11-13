/**
 * Extracts dominant colors from an image using canvas sampling
 */
export const extractColorsFromImage = async (imageFile: File): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    img.onload = () => {
      // Set canvas size to a reasonable sampling size
      const maxSize = 100;
      const ratio = Math.min(maxSize / img.width, maxSize / img.height);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;

      // Draw image to canvas
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Sample colors and find dominant ones
      const colorMap = new Map<string, number>();
      
      // Sample every 4th pixel for performance
      for (let i = 0; i < data.length; i += 16) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Skip transparent or very light/dark pixels
        if (a < 128 || (r + g + b) < 30 || (r + g + b) > 720) continue;

        // Round colors to reduce noise
        const roundedR = Math.round(r / 16) * 16;
        const roundedG = Math.round(g / 16) * 16;
        const roundedB = Math.round(b / 16) * 16;
        
        const color = `${roundedR},${roundedG},${roundedB}`;
        colorMap.set(color, (colorMap.get(color) || 0) + 1);
      }

      // Sort by frequency and get top colors
      const sortedColors = Array.from(colorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      // Convert to hex and filter distinct colors
      const hexColors: string[] = [];
      const minColorDistance = 80; // Minimum distance between colors

      for (const [rgb] of sortedColors) {
        const [r, g, b] = rgb.split(',').map(Number);
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        
        // Check if this color is distinct enough from existing colors
        const isDistinct = hexColors.every(existingHex => {
          const existingR = parseInt(existingHex.slice(1, 3), 16);
          const existingG = parseInt(existingHex.slice(3, 5), 16);
          const existingB = parseInt(existingHex.slice(5, 7), 16);
          
          const distance = Math.sqrt(
            Math.pow(r - existingR, 2) + 
            Math.pow(g - existingG, 2) + 
            Math.pow(b - existingB, 2)
          );
          
          return distance > minColorDistance;
        });

        if (isDistinct) {
          hexColors.push(hex);
        }

        if (hexColors.length >= 3) break;
      }

      // Ensure we have at least 3 colors, fill with defaults if needed
      while (hexColors.length < 3) {
        const fallbackColors = ['#3b82f6', '#10b981', '#f59e0b'];
        hexColors.push(fallbackColors[hexColors.length]);
      }

      resolve(hexColors.slice(0, 3));
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(imageFile);
  });
};

/**
 * Validates if a string is a valid hex color
 */
export const isValidHexColor = (color: string): boolean => {
  const hexPattern = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
  return hexPattern.test(color);
};

/**
 * Converts 3-digit hex to 6-digit hex
 */
export const normalizeHexColor = (color: string): string => {
  if (!isValidHexColor(color)) return color;
  
  if (color.length === 4) {
    return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
  }
  
  return color;
};