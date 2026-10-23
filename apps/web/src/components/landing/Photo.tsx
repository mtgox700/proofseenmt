/*
 * The twelve photos of the v2 brand book (apps/web/public/images/v2, credited in CREDITS.md), served as they were
 * optimised: AVIF first, WebP after, two widths, real dimensions on the <img> so nothing shifts while they load
 * (BRAND_BOOK_V2 §6.2). No next/image: the files are final, a server resize would only cost time. A photo shows a
 * situation, never a client, a freelancer or a testimony of Proofseen (§6.3).
 */

const SIZES = {
  "freelance-code-night": [1536, 1024],
  "client-freelance-brief": [1536, 1024],
  "mission-scoping-whiteboard": [1536, 1024],
  "developer-woman-office": [1536, 1025],
  "contract-signature": [1536, 2294],
  "handshake-hiring-desk": [1536, 1024],
  "hands-keyboard-terminal": [1536, 1306],
  "remote-freelance-coffee": [1536, 1024],
  "handshake-deal-dark": [1536, 1024],
} as const;

export type PhotoName = keyof typeof SIZES;

interface PhotoProps {
  readonly name: PhotoName;
  readonly alt: string;
  /** The `sizes` of the rendered box: the browser picks the 768 or the 1536 file from it. */
  readonly sizes: string;
  /** Only the two photos of the opening load at once; every other one waits until it nears the screen. */
  readonly eager?: boolean;
  readonly className?: string;
}

const set = (name: PhotoName, format: "avif" | "webp"): string => `/images/v2/${name}-768.${format} 768w, /images/v2/${name}-1536.${format} 1536w`;

export function Photo({ name, alt, sizes, eager = false, className }: PhotoProps) {
  const [width, height] = SIZES[name];
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
