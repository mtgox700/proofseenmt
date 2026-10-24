/*
 * The photos of the v2 brand book (apps/web/public/images/v2, credited in CREDITS.md), served as they were
 * optimised: AVIF first, WebP after, real dimensions on the <img> so nothing shifts while they load
 * (BRAND_BOOK_V2 §6.2). No next/image: the files are final, a server resize would only cost time. A photo shows a
 * situation, never a client, a freelancer or a testimony of Proofseen (§6.3). The photos shown small (round photos of
 * the hero and the journey, the phone banner) also exist at 256 and 640 w, cut from the same 1536 w file.
 */

const PHOTOS = {
  "freelance-code-night": { size: [1536, 1024], widths: [256, 640, 768, 1536] },
  "client-freelance-brief": { size: [1536, 1024], widths: [256, 768, 1536] },
  "hands-keyboard-terminal": { size: [1536, 1306], widths: [256, 768, 1536] },
  "mission-scoping-whiteboard": { size: [1536, 1024], widths: [768, 1536] },
  "developer-woman-office": { size: [1536, 1025], widths: [768, 1536] },
  "contract-signature": { size: [1536, 2294], widths: [768, 1536] },
  "remote-freelance-coffee": { size: [1536, 1024], widths: [768, 1536] },
  "handshake-deal-dark": { size: [1536, 1024], widths: [768, 1536] },
} as const;

export type PhotoName = keyof typeof PHOTOS;

interface PhotoProps {
  readonly name: PhotoName;
  readonly alt: string;
  /** The `sizes` of the rendered box: the browser picks the file from it. */
  readonly sizes: string;
  /** Only the two photos of the opening load at once; every other one waits until it nears the screen. */
  readonly eager?: boolean;
  readonly className?: string;
}

const set = (name: PhotoName, format: "avif" | "webp"): string =>
  PHOTOS[name].widths.map((width) => `/images/v2/${name}-${width}.${format} ${width}w`).join(", ");

export function Photo({ name, alt, sizes, eager = false, className }: PhotoProps) {
  const [width, height] = PHOTOS[name].size;
  return (
    <picture className={className}>
      <source type="image/avif" srcSet={set(name, "avif")} sizes={sizes} />
      <source type="image/webp" srcSet={set(name, "webp")} sizes={sizes} />
      <img
        src={`/images/v2/${name}-768.webp`}
        width={width}
        height={height}
        alt={alt}
        decoding="async"
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "low" : undefined}
      />
    </picture>
  );
}
