/**
 * Seed Dulux Standard colours into the procurement catalogue currently used
 * by the Paint Colors & Bases page.
 *
 * This version intentionally uses:
 *   - Supplier
 *   - ProductCategory
 *   - ProcurementProduct
 *   - ProductColorVariant
 *
 * It does NOT use the separate Material catalogue.
 *
 * Run:
 *   pnpm tsx prisma/seed-dulux-procurement-colours.ts
 *
 * Safe to run more than once.
 */

import { prisma } from "@/lib/prisma";

type DuluxBase = "B6" | "B7" | "B8" | "B9";

type DuluxColourSeed = {
  base: DuluxBase;
  name: string;
  dbName: string;
  code: string | null;
  page: number;
};

const SUPPLIER_NAME = "Dulux";
const CATEGORY_NAME = "Paint Colours";
const COLLECTION_NAME = "DULUX STANDARD";
const SOURCE_PDF = "Dulux Bases thing.pdf";

/**
 * Your existing ProductColorVariant model only supports:
 * DEEP, PASTEL, WHITE, CLEAR and NEUTRAL.
 *
 * This mapping keeps the four Dulux bases separate in the current system:
 * B6 -> DEEP
 * B7 -> PASTEL
 * B8 -> WHITE
 * B9 -> CLEAR
 *
 * The exact Dulux base code is also kept in the catalogue product name,
 * SKU and description.
 */
const BASE_TYPE_MAP = {
  B6: "DEEP",
  B7: "PASTEL",
  B8: "WHITE",
  B9: "CLEAR",
} as const;

const DULUX_STANDARD_COLOURS: DuluxColourSeed[] = [
  {
    base: "B8",
    name: "ASHTON ESTATE",
    dbName: "ASHTON ESTATE",
    code: null,
    page: 1,
  },
  { base: "B8", name: "FLORIDA", dbName: "FLORIDA", code: null, page: 1 },
  {
    base: "B8",
    name: "LIGHT HONEY",
    dbName: "LIGHT HONEY",
    code: null,
    page: 1,
  },
  {
    base: "B7",
    name: "GENTLE SUNBEAM",
    dbName: "GENTLE SUNBEAM",
    code: "166-1000",
    page: 1,
  },
  {
    base: "B8",
    name: "SPICED BEIGE",
    dbName: "SPICED BEIGE",
    code: "173-1120",
    page: 1,
  },
  {
    base: "B9",
    name: "TANGERINE GROVE",
    dbName: "TANGERINE GROVE",
    code: "173-1121",
    page: 1,
  },
  {
    base: "B9",
    name: "INDIAN GOLD",
    dbName: "INDIAN GOLD",
    code: "173-1122",
    page: 1,
  },
  {
    base: "B7",
    name: "APPLE MEADOW",
    dbName: "APPLE MEADOW",
    code: "173-1143",
    page: 1,
  },
  { base: "B6", name: "PERIDOT", dbName: "PERIDOT", code: "174-2012", page: 1 },
  {
    base: "B6",
    name: "COURT GREEN",
    dbName: "COURT GREEN",
    code: "175-1036",
    page: 1,
  },
  {
    base: "B8",
    name: "PERSION MELON",
    dbName: "PERSION MELON",
    code: "175-1068",
    page: 1,
  },
  {
    base: "B9",
    name: "ANCIENT COPPER",
    dbName: "ANCIENT COPPER",
    code: "175-1069",
    page: 1,
  },
  { base: "B9", name: "REGATTA", dbName: "REGATTA", code: "175-1070", page: 1 },
  {
    base: "B7",
    name: "TOASTED BAGEL",
    dbName: "TOASTED BAGEL",
    code: "175-1072",
    page: 1,
  },
  {
    base: "B7",
    name: "ELEPHANT TUSK",
    dbName: "ELEPHANT TUSK",
    code: "175-1073",
    page: 1,
  },
  {
    base: "B8",
    name: "WAVES OF WHEAT",
    dbName: "WAVES OF WHEAT",
    code: "175-1078",
    page: 1,
  },
  {
    base: "B6",
    name: "CRIMSON CRAZED",
    dbName: "CRIMSON CRAZED",
    code: "190-1020",
    page: 1,
  },
  {
    base: "B9",
    name: "BRICK DUST",
    dbName: "BRICK DUST",
    code: "190-1024",
    page: 1,
  },
  {
    base: "B6",
    name: "SIGNAL RED",
    dbName: "SIGNAL RED",
    code: "232-0537",
    page: 1,
  },
  {
    base: "B6",
    name: "POST OFFICE RED",
    dbName: "POST OFFICE RED",
    code: "232-0538",
    page: 1,
  },
  {
    base: "B6",
    name: "MIDDLE BROWN",
    dbName: "MIDDLE BROWN",
    code: "232-3411",
    page: 1,
  },
  {
    base: "B6",
    name: "BURGUNDY",
    dbName: "BURGUNDY",
    code: "232-4122",
    page: 1,
  },
  { base: "B8", name: "OYSTER", dbName: "OYSTER", code: "260-1040", page: 1 },
  {
    base: "B7",
    name: "Santa Fe",
    dbName: "Santa Fe",
    code: "D164-1002",
    page: 1,
  },
  {
    base: "B7",
    name: "MONTANA",
    dbName: "MONTANA",
    code: "D164-1003",
    page: 1,
  },
  {
    base: "B6",
    name: "BEACH FIRE",
    dbName: "BEACH FIRE",
    code: "D260-1036",
    page: 1,
  },
  { base: "B8", name: "TEXAS", dbName: "TEXAS", code: "164-1004", page: 1 },
  {
    base: "B8",
    name: "MANHATTEN",
    dbName: "MANHATTEN",
    code: "164-1007",
    page: 1,
  },
  {
    base: "B9",
    name: "NEW ORLEANS",
    dbName: "NEW ORLEANS",
    code: "164-1008",
    page: 1,
  },
  { base: "B9", name: "TENESSE", dbName: "TENESSE", code: "164-1010", page: 1 },
  { base: "B8", name: "GEORGIA", dbName: "GEORGIA", code: "164-1011", page: 1 },
  {
    base: "B8",
    name: "MR SANDMAN",
    dbName: "MR SANDMAN",
    code: "164-1013",
    page: 1,
  },
  {
    base: "B6",
    name: "EARTHWORKS",
    dbName: "EARTHWORKS",
    code: "166-1003",
    page: 1,
  },
  {
    base: "B8",
    name: "CINNAMON TOAST",
    dbName: "CINNAMON TOAST",
    code: "166-1007",
    page: 1,
  },
  {
    base: "B7",
    name: "MAGNOLIA",
    dbName: "MAGNOLIA",
    code: "173-0033",
    page: 1,
  },
  {
    base: "B7",
    name: "CREAM",
    dbName: "CREAM (173-0040)",
    code: "173-0040",
    page: 1,
  },
  {
    base: "B7",
    name: "GARDENIA",
    dbName: "GARDENIA",
    code: "173-0817",
    page: 1,
  },
  {
    base: "B7",
    name: "ROSE WHITE",
    dbName: "ROSE WHITE",
    code: "173-1018",
    page: 1,
  },
  {
    base: "B7",
    name: "BLUEBELL WHITE",
    dbName: "BLUEBELL WHITE",
    code: "173-1019",
    page: 1,
  },
  {
    base: "B7",
    name: "APPLE WHITE",
    dbName: "APPLE WHITE",
    code: "173-1020",
    page: 1,
  },
  {
    base: "B7",
    name: "BARLEY WHITE",
    dbName: "BARLEY WHITE",
    code: "173-1022",
    page: 1,
  },
  {
    base: "B7",
    name: "PRIMROSE WHITE",
    dbName: "PRIMROSE WHITE",
    code: "173-1023",
    page: 1,
  },
  {
    base: "B7",
    name: "APRICOT WHITE",
    dbName: "APRICOT WHITE",
    code: "173-1024",
    page: 1,
  },
  {
    base: "B7",
    name: "COUNTRY CLOVER",
    dbName: "COUNTRY CLOVER",
    code: "173-1026",
    page: 1,
  },
  {
    base: "B7",
    name: "CHAMPAGNE FLUTE",
    dbName: "CHAMPAGNE FLUTE",
    code: "173-1103",
    page: 1,
  },
  {
    base: "B7",
    name: "SOFT GOSSAMER",
    dbName: "SOFT GOSSAMER",
    code: "173-1105",
    page: 1,
  },
  {
    base: "B7",
    name: "EDWARDIAN MIST",
    dbName: "EDWARDIAN MIST",
    code: "173-1106",
    page: 1,
  },
  {
    base: "B7",
    name: "HEIRLOOM",
    dbName: "HEIRLOOM",
    code: "173-1107",
    page: 1,
  },
  {
    base: "B7",
    name: "CHENILLE",
    dbName: "CHENILLE",
    code: "173-1108",
    page: 1,
  },
  {
    base: "B7",
    name: "PEARL ESSENCE",
    dbName: "PEARL ESSENCE",
    code: "173-1109",
    page: 1,
  },
  {
    base: "B7",
    name: "CRUSHED SATIN",
    dbName: "CRUSHED SATIN",
    code: "173-1110",
    page: 1,
  },
  {
    base: "B8",
    name: "LILAC DREAM",
    dbName: "LILAC DREAM",
    code: "173-1111",
    page: 1,
  },
  { base: "B7", name: "SORBET", dbName: "SORBET", code: "173-1112", page: 1 },
  {
    base: "B6",
    name: "REGAL BLUE",
    dbName: "REGAL BLUE",
    code: "173-1113",
    page: 1,
  },
  {
    base: "B8",
    name: "PEACH SWIRL",
    dbName: "PEACH SWIRL",
    code: "173-1114",
    page: 1,
  },
  {
    base: "B7",
    name: "LEMON ZEST",
    dbName: "LEMON ZEST",
    code: "173-1115",
    page: 1,
  },
  {
    base: "B7",
    name: "BLUE FROST",
    dbName: "BLUE FROST",
    code: "173-1116",
    page: 1,
  },
  {
    base: "B8",
    name: "SPRING WILLOW",
    dbName: "SPRING WILLOW",
    code: "173-1117",
    page: 1,
  },
  {
    base: "B8",
    name: "VIOLET CHARM",
    dbName: "VIOLET CHARM",
    code: "173-1118",
    page: 1,
  },
  {
    base: "B8",
    name: "RASPBERRY KISS",
    dbName: "RASPBERRY KISS",
    code: "173-1119",
    page: 1,
  },
  {
    base: "B8",
    name: "MEDITERRANEAN BLUE",
    dbName: "MEDITERRANEAN BLUE",
    code: "173-1123",
    page: 2,
  },
  {
    base: "B9",
    name: "WILD FOREST",
    dbName: "WILD FOREST",
    code: "173-1124",
    page: 2,
  },
  {
    base: "B6",
    name: "CRANBERRY WINE",
    dbName: "CRANBERRY WINE",
    code: "173-1125",
    page: 2,
  },
  {
    base: "B9",
    name: "TERRACOTTA TOUCH",
    dbName: "TERRACOTTA TOUCH",
    code: "173-1126",
    page: 2,
  },
  {
    base: "B9",
    name: "BUTTERSCOTCH CREAM",
    dbName: "BUTTERSCOTCH CREAM",
    code: "173-1128",
    page: 2,
  },
  {
    base: "B8",
    name: "HONEY GOLD",
    dbName: "HONEY GOLD",
    code: "173-1136",
    page: 2,
  },
  { base: "B8", name: "SUNBEAM", dbName: "SUNBEAM", code: "173-1138", page: 2 },
  { base: "B8", name: "ARENA", dbName: "ARENA", code: "173-1140", page: 2 },
  {
    base: "B7",
    name: "SEA STORM",
    dbName: "SEA STORM",
    code: "173-1141",
    page: 2,
  },
  {
    base: "B7",
    name: "WILLOW TREE",
    dbName: "WILLOW TREE",
    code: "173-1142",
    page: 2,
  },
  {
    base: "B7",
    name: "BLOSSOM WHITE",
    dbName: "BLOSSOM WHITE",
    code: "173-1144",
    page: 2,
  },
  {
    base: "B7",
    name: "WILD PRIMROSE",
    dbName: "WILD PRIMROSE",
    code: "173-1147",
    page: 2,
  },
  {
    base: "B6",
    name: "REDCURRENT GLORY",
    dbName: "REDCURRENT GLORY",
    code: "173-1150",
    page: 2,
  },
  {
    base: "B9",
    name: "INTENSE TRUFFLE",
    dbName: "INTENSE TRUFFLE",
    code: "173-1151",
    page: 2,
  },
  {
    base: "B6",
    name: "MULBERRY BURST",
    dbName: "MULBERRY BURST",
    code: "173-1152",
    page: 2,
  },
  {
    base: "B8",
    name: "OVERTLY OLIVE",
    dbName: "OVERTLY OLIVE",
    code: "173-1153",
    page: 2,
  },
  {
    base: "B9",
    name: "RASPBERRY DIVA",
    dbName: "RASPBERRY DIVA",
    code: "173-1154",
    page: 2,
  },
  {
    base: "B6",
    name: "TEAL TENSION",
    dbName: "TEAL TENSION",
    code: "173-1155",
    page: 2,
  },
  { base: "B7", name: "CAMEO", dbName: "CAMEO", code: "173-4101", page: 2 },
  {
    base: "B7",
    name: "ANTIQUE LACE",
    dbName: "ANTIQUE LACE",
    code: "173-4102",
    page: 2,
  },
  {
    base: "B7",
    name: "FINE PORCELAIN",
    dbName: "FINE PORCELAIN",
    code: "173-4104",
    page: 2,
  },
  {
    base: "B6",
    name: "MEXICAN TAN",
    dbName: "MEXICAN TAN",
    code: "174-2008",
    page: 2,
  },
  {
    base: "B6",
    name: "RUSSET ORANGE",
    dbName: "RUSSET ORANGE",
    code: "174-2011",
    page: 2,
  },
  {
    base: "B9",
    name: "BLUE DANUBE",
    dbName: "BLUE DANUBE",
    code: "174-2014",
    page: 2,
  },
  {
    base: "B6",
    name: "Terra Cotta",
    dbName: "Terra Cotta (174-2444)",
    code: "174-2444",
    page: 2,
  },
  {
    base: "B6",
    name: "CHARCOAL",
    dbName: "CHARCOAL",
    code: "174-2771",
    page: 2,
  },
  {
    base: "B6",
    name: "GREEN",
    dbName: "GREEN (174-2897)",
    code: "174-2897",
    page: 2,
  },
  {
    base: "B6",
    name: "COUNTRY GREEN",
    dbName: "COUNTRY GREEN",
    code: "174-3012",
    page: 2,
  },
  {
    base: "B6",
    name: "AQUA TEAL",
    dbName: "AQUA TEAL",
    code: "174-3013",
    page: 2,
  },
  {
    base: "B6",
    name: "RED ROCK",
    dbName: "RED ROCK",
    code: "174-3017",
    page: 2,
  },
  {
    base: "B6",
    name: "BASIC BLACK",
    dbName: "BASIC BLACK",
    code: "174-3780",
    page: 2,
  },
  {
    base: "B8",
    name: "CAPE PEACH",
    dbName: "CAPE PEACH",
    code: "175-0030",
    page: 2,
  },
  {
    base: "B7",
    name: "BONE WHITE",
    dbName: "BONE WHITE",
    code: "175-1014",
    page: 2,
  },
  { base: "B6", name: "OAK", dbName: "OAK", code: "175-1027", page: 2 },
  {
    base: "B7",
    name: "GREY GHOST",
    dbName: "GREY GHOST",
    code: "175-1054",
    page: 2,
  },
  { base: "B8", name: "BISQUE", dbName: "BISQUE", code: "175-1056", page: 2 },
  { base: "B7", name: "LACE", dbName: "LACE", code: "175-1057", page: 2 },
  { base: "B7", name: "PINE", dbName: "PINE", code: "175-1058", page: 2 },
  {
    base: "B7",
    name: "WINTERSCAPE",
    dbName: "WINTERSCAPE",
    code: "175-1059",
    page: 2,
  },
  {
    base: "B6",
    name: "CRANBERRY",
    dbName: "CRANBERRY",
    code: "175-1071",
    page: 2,
  },
  { base: "B8", name: "KENYA", dbName: "KENYA", code: "175-1077", page: 2 },
  {
    base: "B8",
    name: "SUNNY SEASON",
    dbName: "SUNNY SEASON",
    code: "175-1079",
    page: 2,
  },
  {
    base: "B7",
    name: "SWIRL OF CREAM",
    dbName: "SWIRL OF CREAM",
    code: "175-1080",
    page: 2,
  },
  {
    base: "B7",
    name: "MELLOW MOCHA",
    dbName: "MELLOW MOCHA",
    code: "175-1146",
    page: 2,
  },
  {
    base: "B7",
    name: "GENTLE FAWN",
    dbName: "GENTLE FAWN",
    code: "175-1148",
    page: 2,
  },
  {
    base: "B8",
    name: "COOKIE DOUGH",
    dbName: "COOKIE DOUGH",
    code: "175-1149",
    page: 2,
  },
  {
    base: "B8",
    name: "GREENERY",
    dbName: "GREENERY",
    code: "181-1029",
    page: 2,
  },
  { base: "B9", name: "SONORA", dbName: "SONORA", code: "181-1031", page: 2 },
  { base: "B7", name: "FEZ", dbName: "FEZ", code: "181-1044", page: 2 },
  {
    base: "B7",
    name: "FLAMENCO",
    dbName: "FLAMENCO",
    code: "181-1053",
    page: 2,
  },
  { base: "B8", name: "MADRID", dbName: "MADRID", code: "181-1056", page: 2 },
  { base: "B9", name: "TARFAYA", dbName: "TARFAYA", code: "181-1060", page: 2 },
  {
    base: "B9",
    name: "CASABLANCA",
    dbName: "CASABLANCA",
    code: "181-1061",
    page: 2,
  },
  {
    base: "B9",
    name: "PHEASANT FEATHER",
    dbName: "PHEASANT FEATHER",
    code: "181-1076",
    page: 2,
  },
  { base: "B7", name: "PALMA", dbName: "PALMA", code: "186-1057", page: 2 },
  {
    base: "B6",
    name: "PEBBLE BLACK",
    dbName: "PEBBLE BLACK (190-0770)",
    code: "190-0770",
    page: 2,
  },
  {
    base: "B6",
    name: "SEA WEED",
    dbName: "SEA WEED",
    code: "190-1003",
    page: 2,
  },
  {
    base: "B6",
    name: "FRENCH NAVY",
    dbName: "FRENCH NAVY",
    code: "190-1021",
    page: 2,
  },
  {
    base: "B9",
    name: "SUN LOVER",
    dbName: "SUN LOVER",
    code: "190-1022",
    page: 2,
  },
  {
    base: "B8",
    name: "WHIPPED BUTTER",
    dbName: "WHIPPED BUTTER",
    code: "190-1023",
    page: 2,
  },
  {
    base: "B8",
    name: "BEAUTY BAY",
    dbName: "BEAUTY BAY",
    code: "190-1025",
    page: 2,
  },
  {
    base: "B7",
    name: "LINEN TOUCH",
    dbName: "LINEN TOUCH",
    code: "190-1041",
    page: 3,
  },
  {
    base: "B6",
    name: "PEBBLE BLACK",
    dbName: "PEBBLE BLACK (190-3770)",
    code: "190-3770",
    page: 3,
  },
  {
    base: "B7",
    name: "JACARANDA BLUE",
    dbName: "JACARANDA BLUE",
    code: "232-0180",
    page: 3,
  },
  {
    base: "B6",
    name: "GOLDEN YELLOW",
    dbName: "GOLDEN YELLOW",
    code: "232-0356",
    page: 3,
  },
  { base: "B6", name: "ORANGE", dbName: "ORANGE", code: "232-0557", page: 3 },
  {
    base: "B9",
    name: "TURQUOISE BLUE",
    dbName: "TURQUOISE BLUE",
    code: "232-1041",
    page: 3,
  },
  {
    base: "B6",
    name: "HERITAGE GREEN",
    dbName: "HERITAGE GREEN (232-3021)",
    code: "232-3021",
    page: 3,
  },
  {
    base: "B6",
    name: "GOLDEN BROWN",
    dbName: "GOLDEN BROWN",
    code: "232-3414",
    page: 3,
  },
  { base: "B6", name: "NEPTUNE", dbName: "NEPTUNE", code: "260-1035", page: 3 },
  {
    base: "B6",
    name: "BALTIC BLUE",
    dbName: "BALTIC BLUE",
    code: "260-1037",
    page: 3,
  },
  {
    base: "B7",
    name: "SUN PEARL",
    dbName: "SUN PEARL",
    code: "260-1039",
    page: 3,
  },
  {
    base: "B7",
    name: "MANGO CREAM",
    dbName: "MANGO CREAM",
    code: "260-1042",
    page: 3,
  },
  {
    base: "B7",
    name: "COOL BLUE",
    dbName: "COOL BLUE",
    code: "260-1045",
    page: 3,
  },
  {
    base: "B6",
    name: "CLARET COVE",
    dbName: "CLARET COVE",
    code: "260-1122",
    page: 3,
  },
  {
    base: "B7",
    name: "BUTTER MILK",
    dbName: "BUTTER MILK",
    code: "262-1004",
    page: 3,
  },
  {
    base: "B6",
    name: "CROME OXIDE GREEN",
    dbName: "CROME OXIDE GREEN",
    code: "331-0896",
    page: 3,
  },
  {
    base: "B6",
    name: "LISTER GREEN",
    dbName: "LISTER GREEN",
    code: "568-1084",
    page: 3,
  },
  {
    base: "B6",
    name: "FIAT ORANGE",
    dbName: "FIAT ORANGE",
    code: "568-1086",
    page: 3,
  },
  {
    base: "B6",
    name: "CELEBRATION",
    dbName: "CELEBRATION",
    code: null,
    page: 3,
  },
  {
    base: "B9",
    name: "Galveston",
    dbName: "Galveston",
    code: "D164-1009",
    page: 3,
  },
  {
    base: "B9",
    name: "GEORGIA",
    dbName: "GEORGIA",
    code: "D164-1011",
    page: 3,
  },
  {
    base: "B7",
    name: "Desert Coral",
    dbName: "Desert Coral",
    code: "D260-1043",
    page: 3,
  },
  {
    base: "B9",
    name: "NEW LANDINI BLUE",
    dbName: "NEW LANDINI BLUE",
    code: "D568-1053",
    page: 3,
  },
  {
    base: "B9",
    name: "MF METALLIC GREY",
    dbName: "MF METALLIC GREY",
    code: "D568-1067",
    page: 3,
  },
  {
    base: "B8",
    name: "FIAT OFF-WHITE",
    dbName: "FIAT OFF-WHITE",
    code: "D568-1083",
    page: 3,
  },
  {
    base: "B7",
    name: "FORD TRACTOR GREY",
    dbName: "FORD TRACTOR GREY",
    code: "D568-1088",
    page: 3,
  },
  {
    base: "B6",
    name: "FOREST GLEN",
    dbName: "FOREST GLEN",
    code: null,
    page: 3,
  },
  { base: "B6", name: "GARNET RED", dbName: "GARNET RED", code: null, page: 3 },
  { base: "B7", name: "JADE WHITE", dbName: "JADE WHITE", code: null, page: 3 },
  {
    base: "B7",
    name: "LILAC CLOUD",
    dbName: "LILAC CLOUD",
    code: null,
    page: 3,
  },
  { base: "B9", name: "Marrakesh", dbName: "Marrakesh", code: null, page: 3 },
  { base: "B8", name: "MOSS GREEN", dbName: "MOSS GREEN", code: null, page: 3 },
  {
    base: "B6",
    name: "OXFORD BLUE",
    dbName: "OXFORD BLUE",
    code: null,
    page: 3,
  },
  {
    base: "B7",
    name: "PERFECTLY TAUPE",
    dbName: "PERFECTLY TAUPE",
    code: null,
    page: 3,
  },
  {
    base: "B9",
    name: "AFRICAN SUNSET",
    dbName: "AFRICAN SUNSET (PLIOTEX)",
    code: "PLIOTEX",
    page: 3,
  },
  {
    base: "B7",
    name: "KALAHARI BLUSH",
    dbName: "KALAHARI BLUSH (R403-2780)",
    code: "R403-2780",
    page: 3,
  },
  {
    base: "B6",
    name: "TERRA COTTA",
    dbName: "TERRA COTTA (R404-0444)",
    code: "R404-0444",
    page: 3,
  },
  {
    base: "B6",
    name: "RUSTIC RED",
    dbName: "RUSTIC RED (R404-0446)",
    code: "R404-0446",
    page: 3,
  },
  {
    base: "B9",
    name: "GLOSS BLUE",
    dbName: "GLOSS BLUE",
    code: "R416-1240",
    page: 3,
  },
  {
    base: "B6",
    name: "GREEN",
    dbName: "GREEN (R416-1250)",
    code: "R416-1250",
    page: 3,
  },
  {
    base: "B6",
    name: "RICH BURGUNDY",
    dbName: "RICH BURGUNDY",
    code: null,
    page: 3,
  },
  {
    base: "B6",
    name: "RICH CHESTNUT",
    dbName: "RICH CHESTNUT",
    code: null,
    page: 3,
  },
  {
    base: "B6",
    name: "RICH VELVET",
    dbName: "RICH VELVET",
    code: null,
    page: 3,
  },
  { base: "B8", name: "SMARA", dbName: "SMARA", code: null, page: 3 },
  {
    base: "B6",
    name: "SOFT AUBERGINE",
    dbName: "SOFT AUBERGINE",
    code: null,
    page: 3,
  },
  { base: "B7", name: "SOFT GREY", dbName: "SOFT GREY", code: null, page: 3 },
  {
    base: "B6",
    name: "TOTALLY COCOA",
    dbName: "TOTALLY COCOA",
    code: null,
    page: 3,
  },
  {
    base: "B6",
    name: "WINDSOR RED",
    dbName: "WINDSOR RED",
    code: null,
    page: 3,
  },
  {
    base: "B9",
    name: "SAVANNA EARTH",
    dbName: "SAVANNA EARTH",
    code: "R405-0350",
    page: 3,
  },
  {
    base: "B9",
    name: "CHARCOAL",
    dbName: "CHARCOAL",
    code: "R404-0771",
    page: 3,
  },
  {
    base: "B6",
    name: "DEEP GREEN",
    dbName: "DEEP GREEN",
    code: "R404-0227",
    page: 3,
  },
  {
    base: "B6",
    name: "DARK BROWN",
    dbName: "DARK BROWN",
    code: "232-1036",
    page: 3,
  },
  { base: "B6", name: "PAPRIKA", dbName: "PAPRIKA", code: "173-1127", page: 3 },
  {
    base: "B7",
    name: "CREAM",
    dbName: "CREAM (R401-0360)",
    code: "R401-0360",
    page: 3,
  },
  {
    base: "B7",
    name: "MISTY MORNING",
    dbName: "MISTY MORNING",
    code: null,
    page: 3,
  },
  {
    base: "B7",
    name: "VANILLA CREAM",
    dbName: "VANILLA CREAM",
    code: null,
    page: 3,
  },
  { base: "B7", name: "SUNBEAM", dbName: "SUNBEAM", code: null, page: 3 },
  {
    base: "B7",
    name: "NATURAL STRAW",
    dbName: "NATURAL STRAW",
    code: null,
    page: 3,
  },
  { base: "B7", name: "ALCUDIA", dbName: "ALCUDIA", code: "181-1055", page: 3 },
  {
    base: "B7",
    name: "SUMMERSATIN",
    dbName: "SUMMERSATIN",
    code: null,
    page: 3,
  },
  {
    base: "B7",
    name: "SUGARED LILAC",
    dbName: "SUGARED LILAC",
    code: null,
    page: 3,
  },
  {
    base: "B8",
    name: "PUTTING GREEN",
    dbName: "PUTTING GREEN",
    code: null,
    page: 4,
  },
  {
    base: "B7",
    name: "CRAZY CREAM",
    dbName: "CRAZY CREAM",
    code: null,
    page: 4,
  },
  {
    base: "B7",
    name: "CALIFORNIA",
    dbName: "CALIFORNIA",
    code: "181-1066",
    page: 4,
  },
  {
    base: "B7",
    name: "LEMON TROPICS",
    dbName: "LEMON TROPICS",
    code: null,
    page: 4,
  },
  {
    base: "B7",
    name: "CORNFLOWER WHITE",
    dbName: "CORNFLOWER WHITE",
    code: null,
    page: 4,
  },
  { base: "B7", name: "PALE STRAW", dbName: "PALE STRAW", code: null, page: 4 },
  {
    base: "B7",
    name: "BLUEBELL DEW",
    dbName: "BLUEBELL DEW",
    code: null,
    page: 4,
  },
  {
    base: "B7",
    name: "ALMOND WHITE",
    dbName: "ALMOND WHITE",
    code: "173-1134",
    page: 4,
  },
  { base: "B7", name: "WELLBEING", dbName: "WELLBEING", code: null, page: 4 },
  { base: "B8", name: "SEA BLUE", dbName: "SEA BLUE", code: null, page: 4 },
  {
    base: "B7",
    name: "DREAMY PEACH",
    dbName: "DREAMY PEACH",
    code: null,
    page: 4,
  },
  {
    base: "B7",
    name: "CREAM",
    dbName: "CREAM (R403-2750)",
    code: "R403-2750",
    page: 4,
  },
  { base: "B7", name: "BISCUIT", dbName: "BISCUIT", code: null, page: 4 },
  {
    base: "B7",
    name: "NATURAL WICKER",
    dbName: "NATURAL WICKER",
    code: "173-1130",
    page: 4,
  },
  { base: "B7", name: "BUTTERSILK", dbName: "BUTTERSILK", code: null, page: 4 },
  {
    base: "B7",
    name: "SUMMER LAWN",
    dbName: "SUMMER LAWN",
    code: null,
    page: 4,
  },
  {
    base: "B7",
    name: "NATURAL HESSIAN",
    dbName: "NATURAL HESSIAN",
    code: "173-1139",
    page: 4,
  },
  {
    base: "B7",
    name: "MARBELLA",
    dbName: "MARBELLA",
    code: "181-1051",
    page: 4,
  },
  {
    base: "B8",
    name: "CHALKSTONE",
    dbName: "CHALKSTONE",
    code: "181-1067",
    page: 4,
  },
  {
    base: "B7",
    name: "DUCK EGG BLUE",
    dbName: "DUCK EGG BLUE",
    code: null,
    page: 4,
  },
  { base: "B7", name: "SOFT SOLAR", dbName: "SOFT SOLAR", code: null, page: 4 },
  {
    base: "B7",
    name: "EGYPTIAN COTTON",
    dbName: "EGYPTIAN COTTON",
    code: null,
    page: 4,
  },
  {
    base: "B7",
    name: "IVORY LACE",
    dbName: "IVORY LACE",
    code: "173-1132",
    page: 4,
  },
  {
    base: "B7",
    name: "GOLDEN HAZE",
    dbName: "GOLDEN HAZE",
    code: null,
    page: 4,
  },
  {
    base: "B7",
    name: "NATURAL CALICO",
    dbName: "NATURAL CALICO",
    code: "173-1133",
    page: 4,
  },
  {
    base: "B7",
    name: "DESERT SAND",
    dbName: "DESERT SAND (PLIOTEX)",
    code: "PLIOTEX",
    page: 4,
  },
  {
    base: "B7",
    name: "TWISTED WILLOW",
    dbName: "TWISTED WILLOW",
    code: null,
    page: 4,
  },
  { base: "B7", name: "LA CASA", dbName: "LA CASA", code: "181-1052", page: 4 },
  { base: "B7", name: "MALAGA", dbName: "MALAGA", code: "181-0052", page: 4 },
  {
    base: "B7",
    name: "CASTILLE",
    dbName: "CASTILLE",
    code: "181-1049",
    page: 4,
  },
  {
    base: "B7",
    name: "SUNBAKED TERRACOTTA",
    dbName: "SUNBAKED TERRACOTTA",
    code: null,
    page: 4,
  },
  {
    base: "B7",
    name: "PEBBLE ROCK",
    dbName: "PEBBLE ROCK (R401-0370)",
    code: "R401-0370",
    page: 4,
  },
  { base: "B7", name: "JUICY JADE", dbName: "JUICY JADE", code: null, page: 4 },
  {
    base: "B7",
    name: "BAROQUE BLUE",
    dbName: "BAROQUE BLUE",
    code: null,
    page: 4,
  },
  {
    base: "B7",
    name: "FRESH CLAY",
    dbName: "FRESH CLAY (PLIOTEX)",
    code: "PLIOTEX",
    page: 4,
  },
  { base: "B8", name: "PALOMINO", dbName: "PALOMINO", code: null, page: 4 },
  {
    base: "B7",
    name: "ANTIQUE SATIN",
    dbName: "ANTIQUE SATIN",
    code: null,
    page: 4,
  },
  {
    base: "B7",
    name: "PEBBLE ROCK",
    dbName: "PEBBLE ROCK (R403-2760)",
    code: "R403-2760",
    page: 4,
  },
  {
    base: "B7",
    name: "WINTERS DAY",
    dbName: "WINTERS DAY",
    code: null,
    page: 4,
  },
  {
    base: "B7",
    name: "SOFT GOOSEBERRY",
    dbName: "SOFT GOOSEBERRY",
    code: null,
    page: 4,
  },
  {
    base: "B7",
    name: "LEFATSHE",
    dbName: "LEFATSHE (R401-0380)",
    code: "R401-0380",
    page: 4,
  },
  {
    base: "B7",
    name: "GENTLE LAVENDER",
    dbName: "GENTLE LAVENDER",
    code: null,
    page: 4,
  },
  {
    base: "B7",
    name: "HAPPY VIOLET",
    dbName: "HAPPY VIOLET",
    code: null,
    page: 4,
  },
  {
    base: "B7",
    name: "PEACH",
    dbName: "PEACH (R403-2745)",
    code: "R403-2745",
    page: 4,
  },
  { base: "B7", name: "IVORY", dbName: "IVORY", code: "173-1129", page: 4 },
  {
    base: "B7",
    name: "BEIGE SAND",
    dbName: "BEIGE SAND",
    code: "181-1065",
    page: 4,
  },
  {
    base: "B7",
    name: "NATURAL SAFFRON",
    dbName: "NATURAL SAFFRON",
    code: null,
    page: 4,
  },
  {
    base: "B7",
    name: "FRESH CREAM",
    dbName: "FRESH CREAM",
    code: null,
    page: 4,
  },
  {
    base: "B7",
    name: "PALE CITRUS",
    dbName: "PALE CITRUS",
    code: null,
    page: 4,
  },
  { base: "B7", name: "BABE", dbName: "BABE", code: null, page: 4 },
  { base: "B7", name: "SOFT APPLE", dbName: "SOFT APPLE", code: null, page: 4 },
  { base: "B7", name: "SOFT MINT", dbName: "SOFT MINT", code: null, page: 4 },
  { base: "B7", name: "LILAC LOVE", dbName: "LILAC LOVE", code: null, page: 4 },
  {
    base: "B7",
    name: "PRETTY PINK",
    dbName: "PRETTY PINK",
    code: null,
    page: 4,
  },
  {
    base: "B7",
    name: "KAROO LAND",
    dbName: "KAROO LAND",
    code: "181-1074",
    page: 4,
  },
  {
    base: "B7",
    name: "WILLOW BALM",
    dbName: "WILLOW BALM",
    code: null,
    page: 4,
  },
  {
    base: "B7",
    name: "SOFT PEACH",
    dbName: "SOFT PEACH",
    code: "173-1135",
    page: 4,
  },
  {
    base: "B7",
    name: "DAFFODIL WHITE",
    dbName: "DAFFODIL WHITE",
    code: null,
    page: 4,
  },
  {
    base: "B7",
    name: "IRISH LINEN",
    dbName: "IRISH LINEN",
    code: null,
    page: 4,
  },
  {
    base: "B7",
    name: "OSTRICH EGG",
    dbName: "OSTRICH EGG",
    code: null,
    page: 4,
  },
  { base: "B7", name: "WET CLAY", dbName: "WET CLAY", code: null, page: 4 },
  { base: "B7", name: "ILLUSION", dbName: "ILLUSION", code: null, page: 5 },
  {
    base: "B7",
    name: "SOFT STONE",
    dbName: "SOFT STONE",
    code: "173-1137",
    page: 5,
  },
  {
    base: "B7",
    name: "CHINESE JADE",
    dbName: "CHINESE JADE",
    code: null,
    page: 5,
  },
  { base: "B7", name: "EDEN", dbName: "EDEN", code: null, page: 5 },
  { base: "B7", name: "BLUE BABE", dbName: "BLUE BABE", code: null, page: 5 },
  { base: "B7", name: "DOVE GREY", dbName: "DOVE GREY", code: null, page: 5 },
  {
    base: "B7",
    name: "TIMELESS",
    dbName: "TIMELESS",
    code: "175-1131",
    page: 5,
  },
  {
    base: "B7",
    name: "ORCHID WHITE",
    dbName: "ORCHID WHITE",
    code: null,
    page: 5,
  },
  {
    base: "B7",
    name: "KALAHARI BLUSH",
    dbName: "KALAHARI BLUSH (R401-0390)",
    code: "R401-0390",
    page: 5,
  },
  {
    base: "B7",
    name: "VANILLA ICE",
    dbName: "VANILLA ICE",
    code: null,
    page: 5,
  },
  { base: "B7", name: "SEDUCTION", dbName: "SEDUCTION", code: null, page: 5 },
  {
    base: "B7",
    name: "STONEWARE",
    dbName: "STONEWARE",
    code: "166-1002",
    page: 5,
  },
  {
    base: "B7",
    name: "LEFATSHE",
    dbName: "LEFATSHE (R403-2770)",
    code: "R403-2770",
    page: 5,
  },
  {
    base: "B7",
    name: "JASMINE WHITE",
    dbName: "JASMINE WHITE",
    code: null,
    page: 5,
  },
  {
    base: "B7",
    name: "PEACH",
    dbName: "PEACH (R401-0350)",
    code: "R401-0350",
    page: 5,
  },
  {
    base: "B7",
    name: "CONTEMPORARY BLUE",
    dbName: "CONTEMPORARY BLUE",
    code: null,
    page: 5,
  },
  { base: "B7", name: "FIRST DAWN", dbName: "FIRST DAWN", code: null, page: 5 },
  {
    base: "B7",
    name: "VIOLET WHITE",
    dbName: "VIOLET WHITE",
    code: null,
    page: 5,
  },
  { base: "B7", name: "SUMMER SKY", dbName: "SUMMER SKY", code: null, page: 5 },
  { base: "B7", name: "BLUE CANDY", dbName: "BLUE CANDY", code: null, page: 5 },
  {
    base: "B7",
    name: "MINERAL MIST",
    dbName: "MINERAL MIST",
    code: null,
    page: 5,
  },
  {
    base: "B8",
    name: "BAKED EARTH",
    dbName: "BAKED EARTH",
    code: "PLIOTEX",
    page: 5,
  },
  {
    base: "B8",
    name: "SAVANNA EARTH",
    dbName: "SAVANNA EARTH",
    code: "PLIOTEX",
    page: 5,
  },
  {
    base: "B7",
    name: "APRICOT CRUSH",
    dbName: "APRICOT CRUSH",
    code: null,
    page: 5,
  },
  { base: "B8", name: "BLUE STEEL", dbName: "BLUE STEEL", code: null, page: 5 },
  {
    base: "B8",
    name: "COFFEE LIQUEUR",
    dbName: "COFFEE LIQUEUR",
    code: "173-1145",
    page: 5,
  },
  {
    base: "B8",
    name: "DARK BARK",
    dbName: "DARK BARK (PLIOTEX)",
    code: "PLIOTEX",
    page: 5,
  },
  {
    base: "B8",
    name: "ENGLISH FOREST",
    dbName: "ENGLISH FOREST",
    code: null,
    page: 5,
  },
  {
    base: "B8",
    name: "GOLDEN DUNE",
    dbName: "GOLDEN DUNE",
    code: "PLIOTEX",
    page: 5,
  },
  {
    base: "B8",
    name: "GOLDEN NECTAR",
    dbName: "GOLDEN NECTAR",
    code: null,
    page: 5,
  },
  {
    base: "B8",
    name: "MOHAWK VALLEY",
    dbName: "MOHAWK VALLEY",
    code: "181-1063",
    page: 5,
  },
  {
    base: "B8",
    name: "NIGHTINGALE GREY",
    dbName: "NIGHTINGALE GREY",
    code: "181-1075",
    page: 5,
  },
  {
    base: "B8",
    name: "NORTHERN LIGHTS",
    dbName: "NORTHERN LIGHTS",
    code: null,
    page: 5,
  },
  {
    base: "B8",
    name: "PORTLAND",
    dbName: "PORTLAND",
    code: "181-1008",
    page: 5,
  },
  {
    base: "B8",
    name: "RIVER BED",
    dbName: "RIVER BED",
    code: "PLIOTEX",
    page: 5,
  },
  { base: "B8", name: "SOFT SAGE", dbName: "SOFT SAGE", code: null, page: 5 },
  { base: "B8", name: "SORCERER", dbName: "SORCERER", code: null, page: 5 },
  {
    base: "B9",
    name: "NATURAL TERRACOTTA",
    dbName: "NATURAL TERRACOTTA",
    code: null,
    page: 5,
  },
  { base: "B6", name: "BLACK", dbName: "BLACK", code: "232-3770", page: 5 },
  {
    base: "B6",
    name: "CHOCOLATE FONDANT",
    dbName: "CHOCOLATE FONDANT",
    code: null,
    page: 5,
  },
  {
    base: "B6",
    name: "DEEP ULTRAMARINE",
    dbName: "DEEP ULTRAMARINE",
    code: null,
    page: 5,
  },
  {
    base: "B6",
    name: "Ford Tractor Blue",
    dbName: "Ford Tractor Blue",
    code: "D568-1087",
    page: 5,
  },
  {
    base: "B6",
    name: "JD Green",
    dbName: "JD Green",
    code: "D568-1051",
    page: 5,
  },
  {
    base: "B6",
    name: "PEACOCK FEATHER",
    dbName: "PEACOCK FEATHER",
    code: null,
    page: 5,
  },
  {
    base: "B6",
    name: "REGENT GREEN",
    dbName: "REGENT GREEN",
    code: null,
    page: 5,
  },
  {
    base: "B6",
    name: "RICHMOND GREEN",
    dbName: "RICHMOND GREEN",
    code: null,
    page: 5,
  },
  {
    base: "B6",
    name: "RUSTIC RED",
    dbName: "RUSTIC RED (PAGE 5)",
    code: null,
    page: 5,
  },
  {
    base: "B6",
    name: "SIMPLY INDIGO",
    dbName: "SIMPLY INDIGO",
    code: null,
    page: 5,
  },
  {
    base: "B6",
    name: "True Terracotta",
    dbName: "True Terracotta",
    code: null,
    page: 5,
  },
  {
    base: "B6",
    name: "WINDSOR BLUE",
    dbName: "WINDSOR BLUE",
    code: null,
    page: 5,
  },
  {
    base: "B9",
    name: "AFRICAN SUNSET",
    dbName: "AFRICAN SUNSET (R405-0400)",
    code: "R405-0400",
    page: 5,
  },
  {
    base: "B9",
    name: "BUSHVELD",
    dbName: "BUSHVELD",
    code: "181-1072",
    page: 5,
  },
  {
    base: "B9",
    name: "CASTLEWOOD CANYON",
    dbName: "CASTLEWOOD CANYON",
    code: "181-1064",
    page: 5,
  },
  {
    base: "B9",
    name: "CHROME GREEN",
    dbName: "CHROME GREEN",
    code: null,
    page: 5,
  },
  {
    base: "B9",
    name: "CINNAMON DOVE",
    dbName: "CINNAMON DOVE",
    code: "181-1078",
    page: 5,
  },
  { base: "B9", name: "CORNFIELD", dbName: "CORNFIELD", code: null, page: 5 },
  { base: "B9", name: "INDIANA", dbName: "INDIANA", code: null, page: 5 },
  {
    base: "B9",
    name: "LEOPARDS LAIR",
    dbName: "LEOPARDS LAIR",
    code: "181-1069",
    page: 5,
  },
  {
    base: "B9",
    name: "MOROCCAN GOLD",
    dbName: "MOROCCAN GOLD",
    code: "166-1043",
    page: 5,
  },
  {
    base: "B9",
    name: "NATURAL PAPRIKA",
    dbName: "NATURAL PAPRIKA",
    code: null,
    page: 5,
  },
  {
    base: "B9",
    name: "ROASTED RED",
    dbName: "ROASTED RED",
    code: null,
    page: 5,
  },
  {
    base: "B9",
    name: "SAFFRON GLOW",
    dbName: "SAFFRON GLOW",
    code: null,
    page: 6,
  },
  {
    base: "B9",
    name: "SAN SEBASTIAN",
    dbName: "SAN SEBASTIAN",
    code: "181-1042",
    page: 6,
  },
  { base: "B9", name: "SEXY PINK", dbName: "SEXY PINK", code: null, page: 6 },
  {
    base: "B9",
    name: "SUMMER BERRIES",
    dbName: "SUMMER BERRIES",
    code: null,
    page: 6,
  },
  {
    base: "B9",
    name: "SUMMER PLUM",
    dbName: "SUMMER PLUM",
    code: null,
    page: 6,
  },
  { base: "B9", name: "TOSCANA", dbName: "TOSCANA", code: "181-1054", page: 6 },
  {
    base: "B9",
    name: "TUSCAN TERRACOTTA",
    dbName: "TUSCAN TERRACOTTA",
    code: null,
    page: 6,
  },
  {
    base: "B9",
    name: "VALERIAN CLAY",
    dbName: "VALERIAN CLAY",
    code: "181-1079",
    page: 6,
  },
  {
    base: "B9",
    name: "ATLANTIC BLUE",
    dbName: "ATLANTIC BLUE",
    code: "174-3014",
    page: 6,
  },
  {
    base: "B6",
    name: "CATERPILLAR YELLOW",
    dbName: "CATERPILLAR YELLOW",
    code: "D568-1080",
    page: 6,
  },
  {
    base: "B9",
    name: "REDDENED CLAY",
    dbName: "REDDENED CLAY",
    code: "174-3444",
    page: 6,
  },
  {
    base: "B6",
    name: "GREEN FELT",
    dbName: "GREEN FELT",
    code: "174-3896",
    page: 6,
  },
  {
    base: "B6",
    name: "RED JASPER",
    dbName: "RED JASPER",
    code: "174-3445",
    page: 6,
  },
  {
    base: "B7",
    name: "Cream",
    dbName: "Cream (D232-0040)",
    code: "D232-0040",
    page: 6,
  },
  {
    base: "B6",
    name: "Kingfisher Blue",
    dbName: "Kingfisher Blue",
    code: "D232-1086",
    page: 6,
  },
  {
    base: "B6",
    name: "WILD PLUM",
    dbName: "WILD PLUM",
    code: "174-3015",
    page: 6,
  },
  {
    base: "B9",
    name: "GRECIAN GREY",
    dbName: "GRECIAN GREY",
    code: "174-3771",
    page: 6,
  },
  {
    base: "B9",
    name: "TUSCAN ORANGE",
    dbName: "TUSCAN ORANGE",
    code: "174-3011",
    page: 6,
  },
  {
    base: "B7",
    name: "RIVER BED",
    dbName: "RIVER BED",
    code: "R405-0650",
    page: 6,
  },
  {
    base: "B7",
    name: "DESERT SAND",
    dbName: "DESERT SAND (R405-0600)",
    code: "R405-0600",
    page: 6,
  },
  {
    base: "B6",
    name: "BRILLIANT GREEN",
    dbName: "BRILLIANT GREEN",
    code: "232-0221",
    page: 6,
  },
  {
    base: "B7",
    name: "FRESH CLAY",
    dbName: "FRESH CLAY (R405-0300)",
    code: "R405-0300",
    page: 6,
  },
  {
    base: "B7",
    name: "AZURE BLUE",
    dbName: "AZURE BLUE",
    code: "232-1085",
    page: 6,
  },
  {
    base: "B6",
    name: "BRAZILIAN BROWN",
    dbName: "BRAZILIAN BROWN",
    code: "174-3008",
    page: 6,
  },
  {
    base: "B6",
    name: "HERITAGE GREEN",
    dbName: "HERITAGE GREEN (174-3021)",
    code: "174-3021",
    page: 6,
  },
  { base: "B8", name: "QUAIL", dbName: "QUAIL", code: "174-3019", page: 6 },
  {
    base: "B8",
    name: "ABBEY LANE",
    dbName: "ABBEY LANE",
    code: "174-3020",
    page: 6,
  },
  {
    base: "B8",
    name: "WHISPER GREY",
    dbName: "WHISPER GREY",
    code: "232-1121",
    page: 6,
  },
  {
    base: "B8",
    name: "LIGHT GREY",
    dbName: "LIGHT GREY",
    code: "355-0631",
    page: 6,
  },
  {
    base: "B8",
    name: "DARK BARK",
    dbName: "DARK BARK (R405-0450)",
    code: "R405-0450",
    page: 6,
  },
];

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

async function upsertDuluxSupplier() {
  return prisma.supplier.upsert({
    where: { name: SUPPLIER_NAME },
    update: {
      normalizedName: normalizeName(SUPPLIER_NAME),
      supplierType: "BRAND",
      isActive: true,
    },
    create: {
      name: SUPPLIER_NAME,
      normalizedName: normalizeName(SUPPLIER_NAME),
      supplierType: "BRAND",
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
  });
}

async function findOrCreateCategory() {
  const normalizedName = normalizeName(CATEGORY_NAME);

  const existing = await prisma.productCategory.findFirst({
    where: {
      OR: [
        { name: { equals: CATEGORY_NAME, mode: "insensitive" } },
        { normalizedName },
      ],
    },
    select: { id: true },
  });

  if (existing) {
    return prisma.productCategory.update({
      where: { id: existing.id },
      data: {
        name: CATEGORY_NAME,
        normalizedName,
      },
      select: {
        id: true,
        name: true,
      },
    });
  }

  return prisma.productCategory.create({
    data: {
      name: CATEGORY_NAME,
      normalizedName,
    },
    select: {
      id: true,
      name: true,
    },
  });
}

async function upsertBaseProduct(input: {
  supplierId: string;
  categoryId: string;
  base: DuluxBase;
  colourNames: string[];
}) {
  const name = `${COLLECTION_NAME} - ${input.base}`;
  const sku = `DULUX-STANDARD-${input.base}`;

  return prisma.procurementProduct.upsert({
    where: { sku },
    update: {
      name,
      normalizedName: normalizeName(name),
      categoryId: input.categoryId,
      supplierId: input.supplierId,
      productType: "MATERIAL",
      description:
        `${COLLECTION_NAME} colour catalogue for Dulux base ${input.base}. ` +
        `Imported from ${SOURCE_PDF}.`,
      colors: input.colourNames,
      sizes: [],
      stockQty: 0,
      isActive: true,
      isReturnable: false,
      isDeductible: false,
      deductionSplits: 1,
    },
    create: {
      name,
      normalizedName: normalizeName(name),
      sku,
      categoryId: input.categoryId,
      supplierId: input.supplierId,
      productType: "MATERIAL",
      description:
        `${COLLECTION_NAME} colour catalogue for Dulux base ${input.base}. ` +
        `Imported from ${SOURCE_PDF}.`,
      colors: input.colourNames,
      sizes: [],
      stockQty: 0,
      isActive: true,
      isReturnable: false,
      isDeductible: false,
      deductionSplits: 1,
    },
    select: {
      id: true,
      name: true,
      sku: true,
    },
  });
}

async function seedBaseColours(input: {
  productId: string;
  base: DuluxBase;
  colours: DuluxColourSeed[];
}) {
  const baseType = BASE_TYPE_MAP[input.base];

  let created = 0;
  let updated = 0;

  for (const colour of input.colours) {
    const where = {
      productId_colorName_baseType: {
        productId: input.productId,
        colorName: colour.dbName,
        baseType,
      },
    } as const;

    const existing = await prisma.productColorVariant.findUnique({
      where,
      select: { id: true },
    });

    await prisma.productColorVariant.upsert({
      where,
      update: {
        colorCode: colour.code,
        isTinted: true,
      },
      create: {
        productId: input.productId,
        colorName: colour.dbName,
        colorCode: colour.code,
        baseType,
        isTinted: true,
      },
    });

    if (existing) updated += 1;
    else created += 1;
  }

  return { created, updated };
}

async function main() {
  console.log("Seeding Dulux colours into ProcurementProduct...");
  console.log(`Source rows: ${DULUX_STANDARD_COLOURS.length}`);

  const supplier = await upsertDuluxSupplier();
  const category = await findOrCreateCategory();

  const bases = ["B6", "B7", "B8", "B9"] as const;

  let totalCreated = 0;
  let totalUpdated = 0;

  for (const base of bases) {
    const colours = DULUX_STANDARD_COLOURS.filter(
      (colour) => colour.base === base,
    );

    const product = await upsertBaseProduct({
      supplierId: supplier.id,
      categoryId: category.id,
      base,
      colourNames: colours.map((colour) => colour.dbName),
    });

    const result = await seedBaseColours({
      productId: product.id,
      base,
      colours,
    });

    totalCreated += result.created;
    totalUpdated += result.updated;

    console.log(
      `✓ ${base} / ${BASE_TYPE_MAP[base]}: ${colours.length} colours ` +
        `(${result.created} created, ${result.updated} updated)`,
    );
  }

  console.log("");
  console.log("Dulux procurement colour seed completed.");
  console.log(`Supplier: ${supplier.name}`);
  console.log(`Colours processed: ${DULUX_STANDARD_COLOURS.length}`);
  console.log(`Created: ${totalCreated}`);
  console.log(`Updated: ${totalUpdated}`);
}

main()
  .catch((error) => {
    console.error("Dulux procurement colour seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
