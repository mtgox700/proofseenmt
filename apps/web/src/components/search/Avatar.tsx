import { avatarTone, monogram } from "@proofseen/hub";

interface AvatarProps {
  /** The public reference (or a company's address): the monogram's tone comes from it alone. */
  readonly seed: string;
  /** A named profile's or a company's name; `null` for a pseudonymous profile. */
  readonly name: string | null;
  /** Only ever set for a named profile: a pseudonymous profile never shows a face. */
  readonly photoFileId?: string | null;
  readonly alt?: string;
  readonly square?: boolean;
}

/**
 * A profile photo with fixed dimensions (no layout shift), or a monogram: the name's initials, or two signs of the
 * reference for a pseudonymous profile. The monogram is decorative; the name or reference is always written next to it.
 */
export function Avatar({ seed, name, photoFileId = null, alt = "", square = false }: AvatarProps) {
  // Not `.sq`: that is the green square of the poinçon (@proofseen/brand/seal.css), never a face.
  const shape = square ? " is-square" : "";
  if (photoFileId !== null && name !== null) {
    // A plain image: the file route serves a re-encoded WebP with its own cache headers.
    return <img className={`avatar${shape}`} src={`/fichiers/${encodeURIComponent(photoFileId)}`} width={56} height={56} alt={alt} loading="lazy" decoding="async" />;
  }
  return (
    <span className={`avatar${shape} tone-${avatarTone(seed)}`} aria-hidden="true">
      {monogram(seed, name)}
    </span>
  );
}
