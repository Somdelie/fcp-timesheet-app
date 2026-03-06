import type { PrismaClient } from "../generated/prisma/client";

export const materials = [
  {
    name: "Inspired Colour Colourants",
    sku: "PB-PV",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },

  {
    name: "Aerolak Regular Spray Paint",
    sku: "91 10 38 - 99 / 99 01 04",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Aerolak Metallic Spray Paint",
    sku: "91 10 13 - 20",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Aerolak Fluorescent Spray Paint",
    sku: "91 20 01 - 04",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Aerolak Special Finishes",
    sku: "91 10 54 - 91 06 32",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },

  { name: "Wood Primer", sku: "UC2", supplierId: "cmmdxdol60009w8plpxqwnxct" },
  {
    name: "Plaster Primer (Plascon)",
    sku: "UC56",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Tile & Melamine Primer",
    sku: "CTP1",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Multi-Surface Primer",
    sku: "WUP1",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Universal Undercoat",
    sku: "UC1",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Bonding Liquid",
    sku: "CVI14",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "True Colour Primer, Sealer, Undercoat",
    sku: "PSU1",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Plascon Tradepro Solvent-Based Primer",
    sku: "USP",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Plascon Tradepro Water-Based Primer",
    sku: "UWP",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Plascon Tradepro Undercoat",
    sku: "UWU",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Polygalv Zinc Rich Primer",
    sku: "SN176",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  { name: "Glatex 8", sku: "PL", supplierId: "cmmdxdol60009w8plpxqwnxct" },
  { name: "Stoep Enamel", sku: "SP", supplierId: "cmmdxdol60009w8plpxqwnxct" },
  {
    name: "Brick and Slasto Dressing",
    sku: "TBD1",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  { name: "Floor Paint", sku: "FPT", supplierId: "cmmdxdol60009w8plpxqwnxct" },
  {
    name: "Floor Paint Tint Bases",
    sku: "TFD; TFW",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "One Coat Ceiling Paint",
    sku: "OCC",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Bakkie & Trailer Coating",
    sku: "BTC3",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Bituminous Aluminium Paint (One Pack)",
    sku: "RMB1",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Schoolboard Paint",
    sku: "FOP",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Fireplace Paint",
    sku: "FPP1",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Concrete Floor Prep",
    sku: "FCS1",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Acrylic Scumble Glaze",
    sku: "GSL2",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  { name: "Glazecoat", sku: "REF", supplierId: "cmmdxdol60009w8plpxqwnxct" },
  {
    name: "Acrylic Glazecoat",
    sku: "CV82",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  { name: "Gold Paint", sku: "IL214", supplierId: "cmmdxdol60009w8plpxqwnxct" },

  {
    name: "WoodCare Sunproof",
    sku: "WSP",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "WoodCare Natural Deck Coatings",
    sku: "WWV",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "WoodCare Ultra Varnish",
    sku: "X33 - 44",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Wood Preservative",
    sku: "FPR",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "WoodCare Sanding Sealer",
    sku: "SS16",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "WoodCare Knot Seal",
    sku: "PK2",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Woodcare Exterior Water-based Varnish",
    sku: "WSP17 - 28",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Woodcare Exterior Water-based Varnish Gloss (Tint base)",
    sku: "WST",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Woodcare Exterior Water-based Varnish Suede (Tint base)",
    sku: "WSB",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },

  {
    name: "Woodcare Interior Water-based Varnish",
    sku: "X45-51",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Woodcare Interior Water-based Varnish Gloss (Tint base)",
    sku: "WUT",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Woodcare Interior Water-based Varnish Suede (Tint base)",
    sku: "WUB",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  { name: "Brickseal", sku: "WBS", supplierId: "cmmdxdol60009w8plpxqwnxct" },
  { name: "Dampseal", sku: "WDS", supplierId: "cmmdxdol60009w8plpxqwnxct" },
  { name: "Multiseal", sku: "WSS", supplierId: "cmmdxdol60009w8plpxqwnxct" },
  { name: "Wallseal", sku: "WAS", supplierId: "cmmdxdol60009w8plpxqwnxct" },
  {
    name: "Wallseal Pastel Tint Base",
    sku: "TWS",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Plascon Skim Coats - Exterior",
    sku: "PSE1",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Plascon Skim Coats - Interior",
    sku: "PSI1",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },

  { name: "Homepride", sku: "PRD", supplierId: "cmmdxdol60009w8plpxqwnxct" },
  {
    name: "Super White Hycover",
    sku: "CNC1",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Arctic White",
    sku: "CAW1",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Crown Plaster Primer",
    sku: "CPP2",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },

  {
    name: "Paramount Householders PVA",
    sku: "NLC301 - 303",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Paramount Plaster Primer: Water-based",
    sku: "PPW1",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Paramount Gloss Enamel",
    sku: "PAR800",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Paramount Universal Paint Stainers",
    sku: "33700-07",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },

  {
    name: "Polyfilla Interior",
    sku: "10 10 02",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Polyfilla Exterior",
    sku: "10 19 03",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Ready Mixed Crack Filler",
    sku: "PRM 1",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Polyfilla Mendall 90",
    sku: "80 16 01",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Polyfilla Fine Crack Filler",
    sku: "10 18 01",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  { name: "Rockset", sku: "10 22 01", supplierId: "cmmdxdol60009w8plpxqwnxct" },
  {
    name: "Polyfilla Masonry Patching Plaster",
    sku: "10 20 03",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Ripple Finish",
    sku: "99 01 01",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Woodfiller",
    sku: "90 25 01-06",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Sugar Soap Powder",
    sku: "50 17 03",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Sugar Soap Liquid",
    sku: "50 18 01",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Brush Cleaner",
    sku: "50 22 05",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Mortalift",
    sku: "51 10 01",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "End Rust",
    sku: "50 21 02",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },

  {
    name: "High Alkali Plaster Primer",
    sku: "PP950",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Gypsum And Plaster Primer",
    sku: "PP700",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "All Purpose Undercoat",
    sku: "PU800",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },

  {
    name: "Galvanised Iron Cleaner",
    sku: "GIC1",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Metal WB Primer",
    sku: "MWP1",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Mild Steel Primer",
    sku: "UC501",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Galvanised Iron Primer",
    sku: "GIP1",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Silvershine Aluminium",
    sku: "ASS1",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Aquasolv Degreaser",
    sku: "GR1",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },

  {
    name: "Coastcote Etch Primer",
    sku: "SNK",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "L.C. Etch Primer",
    sku: "SN152",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Plascoprime Self Etch Primer",
    sku: "SNS1",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Clear Etchcote Primer",
    sku: "SN151",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Economical Quick Drying Primer",
    sku: "QDP",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Plascoprime 207",
    sku: "UC207",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Epiwash Strontium Chromate Primer",
    sku: "AW255",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Epiwash Strontium Chromate Free Primer",
    sku: "AW1256",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Plascofase 18 Primer",
    sku: "EMS218",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Synlac 5000",
    sku: "SL5000",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Synlac 2000",
    sku: "SL2000",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Synlac Industrial Enamels",
    sku: "SL",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Machinery Enamels",
    sku: "PA87",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Quick Drying Enamels",
    sku: "QDE",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Plascothane Polyurethane Enamel",
    sku: "UP",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Plascothane Catalyst",
    sku: "KAT518",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Industrial Lacquers",
    sku: "IL",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Plascotuff Gehopon 3000 WB",
    sku: "GW",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Plascothane Purecoat",
    sku: "PUC",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Plascoguard 4000 HB",
    sku: "FHB",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "EPD Epoxy Coating",
    sku: "REF1157, 1159",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Hysheen Road Marking Paint SABS 731",
    sku: "TP",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Road Marking Paint (Non - SABS)",
    sku: "TP",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Hysheen Aquafast",
    sku: "WTP",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Brick and Concrete Marking Paint",
    sku: "BTP",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Road Line Paint Thinner",
    sku: "HVL1",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },

  {
    name: "Sanding Sealers",
    sku: "SS15",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Nitrolac H/B Dual",
    sku: "ANL",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  { name: "Wood Lacquers", sku: "WL", supplierId: "cmmdxdol60009w8plpxqwnxct" },
  {
    name: "Quicksand Primer Surfacer",
    sku: "PS202",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Ancillary Products",
    sku: "SS12",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Base Coat / Sealer",
    sku: "EZN",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  { name: "Primer", sku: "EZN", supplierId: "cmmdxdol60009w8plpxqwnxct" },
  {
    name: "Clear Lacquers",
    sku: "EZN",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Pigmented Lacquers",
    sku: "EZN",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Plascolac Catalyst",
    sku: "KAT1104 / 1371",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Super Penetrating Stains",
    sku: "SPS",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Universal Shading Colours",
    sku: "PPC",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Water-based Penetrating Stains",
    sku: "WPS",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Plascosafe Water-based Coatings",
    sku: "FFW",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Plascosafe Multicoat",
    sku: "FFW1330",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Plascosafe Water-based Floor Coating",
    sku: "WFC",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Water-based Sanding Sealer",
    sku: "SSW15",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },

  {
    name: "Plascotuff 3000",
    sku: "PEX/PET/PEH",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Plascotuff Coal Tar Pitch Coating",
    sku: "EPT/EPD",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Plascothane 9000",
    sku: "PRU/PRT/PRH/PT",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },

  {
    name: "High Performance Coatings Remover",
    sku: "RRH520",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "High Strength Cleaner & Degreaser",
    sku: "RCI70",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },

  {
    name: "Superior Satin",
    sku: "PEM1100",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Superior Satin Tint Bases",
    sku: "THS",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Superior Low Sheen",
    sku: "PEM1000",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Superior Low Sheen Tint Bases",
    sku: "TLS",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Hygiene Low Sheen",
    sku: "PHL",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Hygiene Low Sheen Pastel base",
    sku: "THL",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Elastoshield",
    sku: "PES1",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Elastoshield Tint Bases",
    sku: "TED",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Super Matt",
    sku: "PEM900",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Super Matt Tint Bases",
    sku: "TSA",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Superior Matt",
    sku: "PEM950",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Superior Matt Tint Bases",
    sku: "TPM",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "All Purpose Matt",
    sku: "PEM800",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "All Purpose Matt Tint Base",
    sku: "TDA",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Contractors Matt",
    sku: "PEM600",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Contractors Matt Tint Base",
    sku: "TCP",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Aquarista White",
    sku: "PHB800",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Aquarista Pastel base",
    sku: "THB1000",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Marroca Course Textured",
    sku: "PTX1200",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Marroca Course Textured Tint Bases",
    sku: "TPX",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Marroca Heavy Texture 1mm",
    sku: "PTX1001",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Marroca Heavy Texture 1mm Tint Bases",
    sku: "TTX1001 / 2001",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Marroca Heavy Texture 2mm",
    sku: "PTX1002",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Marroca Heavy Texture 2mm Tint Bases",
    sku: "TTX1002 / 2001",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Marroca Ripple Texture Low Sheen",
    sku: "PTX1400",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Marroca Ripple Texture Low Sheen Tint Bases",
    sku: "TRX",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Brilliant White Gloss Enamel",
    sku: "PSB1000",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Gloss Enamel",
    sku: "PSB800",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Gloss Enamel Tint Bases",
    sku: "TGE",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Damp Plaster Paint",
    sku: "PSB600",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Eggshell Enamel",
    sku: "PSB700",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Eggshell Enamel Tint Bases",
    sku: "TEG",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Water-Based Gypsum & Masonry Sealer",
    sku: "PGS",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  {
    name: "Waterproofing Compound",
    sku: "PWC520",
    supplierId: "cmmdxdol60009w8plpxqwnxct",
  },
  { name: "Fillercoat", sku: "PP500", supplierId: "cmmdxdol60009w8plpxqwnxct" },
];

const CATEGORY_ID = "cmmdxbuw40008w8plm4urs9ae";

export async function seedMaterials(prisma: PrismaClient) {
  for (const material of materials) {
    await prisma.procurementProduct.upsert({
      where: { sku: material.sku },
      update: {
        name: material.name,
        supplierId: material.supplierId,
        categoryId: CATEGORY_ID,
        isActive: true,
      },
      create: {
        name: material.name,
        sku: material.sku,
        supplierId: material.supplierId,
        categoryId: CATEGORY_ID,
        isActive: true,
      },
    });
  }

  console.log(`Seeded ${materials.length} procurement materials`);
}
