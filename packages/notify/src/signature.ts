/**
 * Ligne qui sépare le corps d'un e-mail texte de sa signature. C'est le délimiteur standard (RFC 3676, 4.3) : deux
 * tirets et une espace, seuls sur leur ligne. Les clients de messagerie le reconnaissent et replient la signature,
 * et il ne dépend d'aucun caractère typographique.
 */
export const SIGNATURE_DELIMITER = "-- ";
