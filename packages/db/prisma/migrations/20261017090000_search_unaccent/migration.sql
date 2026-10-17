-- Recherche de missions insensible aux accents (C21) : « developpeur » trouve « développeur ».
--
-- Le texte cherché est plié par l'application (packages/db/src/search-text.ts : NFD, accents retirés, minuscules,
-- ligatures défaites) et rangé dans "searchText". L'extension unaccent n'est pas utilisée : PGlite, où tournent les
-- tests, ne l'a pas.

-- AlterTable
ALTER TABLE "JobPost" ADD COLUMN     "searchText" TEXT NOT NULL DEFAULT '';

-- Le même pliage en SQL, pour les missions qui existent déjà : les lettres latines accentuées vers leur lettre de base,
-- les ligatures défaites, puis les minuscules. Immuable : le résultat ne dépend que du texte reçu.
CREATE FUNCTION proofseen_fold(input text) RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $fn$
  SELECT lower(translate(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(input, 'Œ', 'oe'), 'œ', 'oe'), 'Æ', 'ae'), 'æ', 'ae'), 'ẞ', 'ss'), 'ß', 'ss'), 'Ø', 'o'), 'ø', 'o'), 'Đ', 'd'), 'đ', 'd'), 'Ł', 'l'), 'ł', 'l'), 'ı', 'i'),
    'ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüýÿĀāĂăĄąĆćĈĉĊċČčĎďĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĨĩĪīĬĭĮįİĴĵĶķĹĺĻļĽľŃńŅņŇňŌōŎŏŐőŔŕŖŗŘřŚśŜŝŞşŠšŢţŤťŨũŪūŬŭŮůŰűŲųŴŵŶŷŸŹźŻżŽžƠơƯưǍǎǏǐǑǒǓǔǕǖǗǘǙǚǛǜǞǟǠǡǦǧǨǩǪǫǬǭǰǴǵǸǹǺǻȀȁȂȃȄȅȆȇȈȉȊȋȌȍȎȏȐȑȒȓȔȕȖȗȘșȚțȞȟȦȧȨȩȪȫȬȭȮȯȰȱȲȳḀḁḂḃḄḅḆḇḈḉḊḋḌḍḎḏḐḑḒḓḔḕḖḗḘḙḚḛḜḝḞḟḠḡḢḣḤḥḦḧḨḩḪḫḬḭḮḯḰḱḲḳḴḵḶḷḸḹḺḻḼḽḾḿṀṁṂṃṄṅṆṇṈṉṊṋṌṍṎṏṐṑṒṓṔṕṖṗṘṙṚṛṜṝṞṟṠṡṢṣṤṥṦṧṨṩṪṫṬṭṮṯṰṱṲṳṴṵṶṷṸṹṺṻṼṽṾṿẀẁẂẃẄẅẆẇẈẉẊẋẌẍẎẏẐẑẒẓẔẕẖẗẘẙẠạẢảẤấẦầẨẩẪẫẬậẮắẰằẲẳẴẵẶặẸẹẺẻẼẽẾếỀềỂểỄễỆệỈỉỊịỌọỎỏỐốỒồỔổỖỗỘộỚớỜờỞởỠỡỢợỤụỦủỨứỪừỬửỮữỰựỲỳỴỵỶỷỸỹ',
    'AAAAAACEEEEIIIINOOOOOUUUUYaaaaaaceeeeiiiinooooouuuuyyAaAaAaCcCcCcCcDdEeEeEeEeEeGgGgGgGgHhIiIiIiIiIJjKkLlLlLlNnNnNnOoOoOoRrRrRrSsSsSsSsTtTtUuUuUuUuUuUuWwYyYZzZzZzOoUuAaIiOoUuUuUuUuUuAaAaGgKkOoOojGgNnAaAaAaEeEeIiIiOoOoRrRrUuUuSsTtHhAaEeOoOoOoOoYyAaBbBbBbCcDdDdDdDdDdEeEeEeEeEeFfGgHhHhHhHhHhIiIiKkKkKkLlLlLlLlMmMmMmNnNnNnNnOoOoOoOoPpPpRrRrRrRrSsSsSsSsSsTtTtTtTtUuUuUuUuUuVvVvWwWwWwWwWwXxXxYyZzZzZzhtwyAaAaAaAaAaAaAaAaAaAaAaAaEeEeEeEeEeEeEeEeIiIiOoOoOoOoOoOoOoOoOoOoOoOoUuUuUuUuUuUuUuYyYyYyYy'))
$fn$;

UPDATE "JobPost" SET "searchText" = proofseen_fold("title" || ' ' || "description" || ' ' || "skillsText");

-- L'ancien index portait sur le texte accentué : la requête ne s'en sert plus.
DROP INDEX "JobPost_open_fulltext_idx";

-- Recherche plein texte des missions ouvertes, en français et en anglais, sur le texte plié. Toujours un filtre : aucun
-- ts_rank, la liste garde l'ordre choisi par le visiteur. L'expression est recopiée telle quelle par la requête
-- (packages/db/src/mission-search.ts), sinon l'index ne sert pas.
CREATE INDEX "JobPost_open_search_idx" ON "JobPost" USING GIN (
  (to_tsvector('french'::regconfig, "searchText") || to_tsvector('english'::regconfig, "searchText"))
) WHERE "status" = 'open';
