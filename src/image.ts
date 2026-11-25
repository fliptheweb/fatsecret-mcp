import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

// image_b64 field limit from the /image-recognition/v2 docs
export const MAX_IMAGE_B64_LENGTH = 999_982;

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

/**
 * Resolves the image_b64 to send: reads image_path (images only, so the tool can't ship
 * arbitrary local files to FatSecret) or takes image_b64 as given, and enforces the size limit.
 */
export function resolveImageB64(
  { image_path, image_b64 }: { image_path?: string; image_b64?: string },
  readFile: typeof readFileSync = readFileSync,
): string {
  let b64: string;
  if (image_path) {
    if (!IMAGE_EXTENSIONS.has(extname(image_path).toLowerCase())) {
      throw new Error(`image_path must be a .jpg, .jpeg, .png or .webp file: ${image_path}`);
    }
    b64 = Buffer.from(readFile(image_path)).toString('base64');
  } else if (image_b64) {
    b64 = image_b64.replace(/^data:image\/\w+;base64,/, '');
  } else {
    throw new Error('Provide image_path or image_b64');
  }

  if (b64.length > MAX_IMAGE_B64_LENGTH) {
    throw new Error(
      `Image too large for FatSecret (${b64.length} base64 chars, max ${MAX_IMAGE_B64_LENGTH}). ` +
        'Shrink it first, e.g. `sips -Z 512 photo.jpg --out small.jpg` on macOS.',
    );
  }
  return b64;
}
