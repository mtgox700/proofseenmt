/*
 * Identité du moteur rangée avec chaque version du coffre (`DocumentVersion.engine`). Deux parties : le moteur de CONTENU
 * (gabarits, variables, clauses, empreinte du contenu : `proofseen-documents/1`) et le dessinateur de PDF (`pdfmake/<version>`).
 * L'empreinte du contenu ne dépend que de la première : un rejeu (`replayVersion`) accepte un autre dessinateur et refuse un
 * autre moteur de contenu. Les octets du PDF, eux, ne se régénèrent jamais : le coffre garde ceux de l'émission.
 */

export const CONTENT_ENGINE_ID = "proofseen-documents/1";

/** Ce que le coffre enregistre avec chaque version : le moteur de contenu et la version de pdfmake qui l'a dessinée (un test la relit). */
export const ENGINE_ID = `${CONTENT_ENGINE_ID} pdfmake/0.3.12`;

/** Le moteur de contenu d'une identité enregistrée : tout ce qui précède la première espace. */
export const contentEngineOf = (engine: string): string => engine.split(" ")[0] ?? "";
