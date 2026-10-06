/**
 * Fallback first-name lexicon (FR + EN) used to catch names the extractor missed.
 * Deliberately over-inclusive: masking one word too many is acceptable, one name too few is not.
 * Not an exhaustive NER — documented limitation (S1_PLAN, Security Sentinel).
 */
export const FIRST_NAMES: ReadonlySet<string> = new Set([
  // French
  "Adam", "Adèle", "Adrien", "Agathe", "Alain", "Alexandre", "Alexis", "Alice", "Aline", "Amandine", "Amélie", "Anaïs",
  "André", "Anne", "Antoine", "Arnaud", "Arthur", "Audrey", "Aurélie", "Baptiste", "Benjamin", "Benoît", "Bernard",
  "Bruno", "Camille", "Caroline", "Catherine", "Céline", "Charles", "Charlotte", "Chloé", "Christophe", "Claire",
  "Clément", "Coralie", "Damien", "Daniel", "David", "Delphine", "Denis", "Didier", "Dominique", "Élise", "Élodie",
  "Emma", "Émilie", "Éric", "Estelle", "Étienne", "Fabien", "Fabrice", "Fanny", "Florian", "François", "Frédéric",
  "Gabriel", "Gaël", "Guillaume", "Hélène", "Hugo", "Inès", "Isabelle", "Jacques", "Jean", "Jérémy", "Jérôme",
  "Joël", "Jonathan", "Julie", "Julien", "Juliette", "Justine", "Karim", "Kévin", "Laura", "Laurent", "Léa", "Léo",
  "Louis", "Louise", "Luc", "Lucas", "Lucie", "Manon", "Marc", "Marie", "Marine", "Martin", "Mathieu", "Mathilde",
  "Maxime", "Mehdi", "Mélanie", "Michel", "Mohamed", "Nathalie", "Nicolas", "Noé", "Océane", "Olivier", "Pascal",
  "Patrick", "Paul", "Pauline", "Philippe", "Pierre", "Quentin", "Raphaël", "Rémi", "Romain", "Sabrina", "Samuel",
  "Sandrine", "Sarah", "Sébastien", "Simon", "Sofiane", "Sophie", "Stéphane", "Sylvain", "Théo", "Thibault", "Thomas",
  "Valentin", "Valérie", "Vincent", "Virginie", "Xavier", "Yann", "Yassine", "Youssef", "Zoé",
  // English
  "Aaron", "Adrian", "Alex", "Amanda", "Amy", "Andrew", "Anna", "Ben", "Brian", "Chris", "Daniel", "Emily", "Emma",
  "Ethan", "George", "Grace", "Hannah", "Harry", "Jack", "Jacob", "James", "Jane", "Jason", "Jennifer", "Jessica",
  "John", "Joseph", "Josh", "Kate", "Kevin", "Laura", "Liam", "Lisa", "Mark", "Mary", "Matthew", "Megan", "Michael",
  "Noah", "Oliver", "Olivia", "Peter", "Rachel", "Richard", "Robert", "Ryan", "Sam", "Sarah", "Sophia", "Steven",
  "Thomas", "Tom", "William",
]);
