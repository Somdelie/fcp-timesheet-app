import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL environment variable is not set");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding equipment inventory...");

  const holderNames = [
    "Geoffrey", "Tshepo", "Griffith", "Lawrence",
    "Lucas", "Mawesi", "Nicolas", "Temba", "Thousand", "Owen",
    "Office",
  ];

  for (const name of holderNames) {
    await prisma.equipmentHolder.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log("✅ Holders seeded");

  // Format: { holder, category, item, quantity, condition, notes, location }
  const equipmentData = [

    // ── GEOFFREY ──────────────────────────────────────────────────────────
    { holder: "Geoffrey", category: "6ft Ladders",       item: "6ft Step Ladders",      quantity: 23, condition: "Good",          notes: "Fixed",                             location: null },
    { holder: "Geoffrey", category: "Extension Ladders", item: "Extension Ladders",     quantity: 4,  condition: "Good",          notes: null,                                location: null },
    { holder: "Geoffrey", category: "8ft Ladders",       item: "8ft Ladders",           quantity: 8,  condition: "Good",          notes: null,                                location: null },
    { holder: "Geoffrey", category: "Pressure Washers",  item: "High Pressure Washers", quantity: 3,  condition: "Good",          notes: null,                                location: "Cape Town" },
    { holder: "Geoffrey", category: "Extension Cables",  item: "Extension Cables",      quantity: 3,  condition: "Good",          notes: null,                                location: "Cape Town" },
    { holder: "Geoffrey", category: "Spraying Machines", item: "Spraying Machines",     quantity: 2,  condition: "Good",          notes: null,                                location: "Cape Town" },
    { holder: "Geoffrey", category: "Drop Sheets",       item: "Drop Sheets",           quantity: 36, condition: "Good",          notes: null,                                location: "Cape Town" },

    // ── TSHEPO ────────────────────────────────────────────────────────────
    { holder: "Tshepo",   category: "Safety Belts",      item: "Safety Belts",          quantity: 15, condition: "Good",          notes: null,                                location: null },
    { holder: "Tshepo",   category: "Huts",              item: "Huts",                  quantity: 1,  condition: "Good",          notes: null,                                location: null },
    { holder: "Tshepo",   category: "6ft Ladders",       item: "6ft Ladders",           quantity: 8,  condition: "Good",          notes: null,                                location: null },

    // ── GRIFFITH ──────────────────────────────────────────────────────────
    { holder: "Griffith", category: "6ft Ladders",       item: "6ft A-Frame Ladders",   quantity: 28, condition: "Good",          notes: null,                                location: "Steyncity" },
    { holder: "Griffith", category: "8ft Ladders",       item: "8ft A-Frame Ladders",   quantity: 3,  condition: "Good",          notes: null,                                location: "Steyncity" },
    { holder: "Griffith", category: "Huts",              item: "Huts",                  quantity: 5,  condition: "Good",          notes: null,                                location: "Steyncity" },
    { holder: "Griffith", category: "Safety Belts",      item: "Safety Belts",          quantity: 6,  condition: "Good",          notes: null,                                location: "Steyncity" },
    { holder: "Griffith", category: "Silicone Guns",     item: "Silicone Guns",         quantity: 2,  condition: "Good",          notes: null,                                location: "Steyncity" },
    { holder: "Griffith", category: "6ft Ladders",       item: "6ft Ladders (repair)",  quantity: 2,  condition: "Beyond Repair", notes: "Returned to office – Nicolas took", location: "Steyncity" },
    { holder: "Griffith", category: "8ft Ladders",       item: "8ft Ladders (repair)",  quantity: 1,  condition: "Beyond Repair", notes: "Returned to office – Nicolas took", location: "Steyncity" },

    // ── LAWRENCE ──────────────────────────────────────────────────────────
    { holder: "Lawrence", category: "6ft Ladders",       item: "6ft Ladders",           quantity: 22, condition: "Good",          notes: null,                                location: null },
    { holder: "Lawrence", category: "6ft Ladders",       item: "6ft Ladders (broken)",  quantity: 1,  condition: "Beyond Repair", notes: null,                                location: null },
    { holder: "Lawrence", category: "8ft Ladders",       item: "8ft Ladders",           quantity: 4,  condition: "Good",          notes: null,                                location: null },
    { holder: "Lawrence", category: "Extension Ladders", item: "Extension Ladders",     quantity: 2,  condition: "Good",          notes: null,                                location: null },
    { holder: "Lawrence", category: "Huts",              item: "Huts",                  quantity: 3,  condition: "Good",          notes: null,                                location: null },
    { holder: "Lawrence", category: "Safety Belts",      item: "Safety Belts",          quantity: 16, condition: "Good",          notes: null,                                location: null },
    { holder: "Lawrence", category: "Spot Sheets",       item: "Spot Sheets",           quantity: 10, condition: "Good",          notes: null,                                location: null },
    { holder: "Lawrence", category: "Silicone Guns",     item: "Silicone Guns",         quantity: 3,  condition: "Good",          notes: null,                                location: null },
    { holder: "Lawrence", category: "Signage",           item: "Yellow Signage Boards", quantity: 2,  condition: "Good",          notes: null,                                location: null },
    { holder: "Lawrence", category: "Safety",            item: "Life Line",             quantity: 1,  condition: "Good",          notes: null,                                location: null },
    { holder: "Lawrence", category: "Safety",            item: "Cage / Fire Extinguisher", quantity: 1, condition: "Good",        notes: null,                                location: null },
    { holder: "Lawrence", category: "Other Ladders",     item: "10ft Ladder",           quantity: 1,  condition: "Good",          notes: null,                                location: null },

    // ── LUCAS ─────────────────────────────────────────────────────────────
    { holder: "Lucas",    category: "6ft Ladders",       item: "6ft Ladders",           quantity: 10, condition: "Good",          notes: null,                                location: null },
    { holder: "Lucas",    category: "8ft Ladders",       item: "8ft Ladders",           quantity: 2,  condition: "Good",          notes: null,                                location: null },
    { holder: "Lucas",    category: "Extension Ladders", item: "Double Extension Ladders", quantity: 3, condition: "Good",        notes: null,                                location: null },
    { holder: "Lucas",    category: "Huts",              item: "Huts",                  quantity: 4,  condition: "Good",          notes: null,                                location: null },
    { holder: "Lucas",    category: "Safety Belts",      item: "Safety Belts",          quantity: 6,  condition: "Good",          notes: null,                                location: null },
    { holder: "Lucas",    category: "Drop Sheets",       item: "Drop Sheets",           quantity: 4,  condition: "Good",          notes: null,                                location: null },
    { holder: "Lucas",    category: "Silicone Guns",     item: "Silicone Guns",         quantity: 3,  condition: "Good",          notes: null,                                location: null },

    // ── MAWESI ────────────────────────────────────────────────────────────
    { holder: "Mawesi",   category: "6ft Ladders",       item: "6ft Ladders",           quantity: 6,  condition: "Good",          notes: null,                                location: null },
    { holder: "Mawesi",   category: "8ft Ladders",       item: "8ft Ladders",           quantity: 3,  condition: "Good",          notes: null,                                location: null },
    { holder: "Mawesi",   category: "Extension Ladders", item: "Double Extension Ladder", quantity: 1, condition: "Good",         notes: null,                                location: null },
    { holder: "Mawesi",   category: "Huts",              item: "Huts",                  quantity: 1,  condition: "Good",          notes: null,                                location: null },
    { holder: "Mawesi",   category: "Safety Belts",      item: "Safety Belts",          quantity: 12, condition: "Good",          notes: null,                                location: null },
    { holder: "Mawesi",   category: "Spot Sheets",       item: "Spot Sheets",           quantity: 10, condition: "Good",          notes: null,                                location: null },
    { holder: "Mawesi",   category: "Silicone Guns",     item: "Silicone Guns",         quantity: 2,  condition: "Good",          notes: null,                                location: null },
    { holder: "Mawesi",   category: "Safety",            item: "Fire Extinguisher",     quantity: 1,  condition: "Good",          notes: null,                                location: null },
    { holder: "Mawesi",   category: "Spraying Machines", item: "Spraying Machine",      quantity: 1,  condition: "Good",          notes: null,                                location: null },
    { holder: "Mawesi",   category: "Pressure Washers",  item: "High Pressure Washer",  quantity: 1,  condition: "Good",          notes: null,                                location: null },
    { holder: "Mawesi",   category: "Safety",            item: "First Aid Box",         quantity: 1,  condition: "Good",          notes: null,                                location: null },
    { holder: "Mawesi",   category: "Safety",            item: "Blue Cones",            quantity: 2,  condition: "Good",          notes: null,                                location: null },
    { holder: "Mawesi",   category: "Extension Cables",  item: "40m Extension Cable",   quantity: 1,  condition: "Good",          notes: null,                                location: null },
    { holder: "Mawesi",   category: "Extension Cables",  item: "50m Extension Cable",   quantity: 1,  condition: "Stolen",        notes: "Reported stolen",                   location: null },
    { holder: "Mawesi",   category: "Extension Cables",  item: "40m Extension Cable",   quantity: 1,  condition: "Stolen",        notes: "Reported stolen",                   location: null },

    // ── NICOLAS ───────────────────────────────────────────────────────────
    { holder: "Nicolas",  category: "6ft Ladders",       item: "6ft Ladders",           quantity: 21, condition: "Good",          notes: null,                                location: null },
    { holder: "Nicolas",  category: "8ft Ladders",       item: "8ft Ladders",           quantity: 16, condition: "Good",          notes: "Includes ladders from Nic & Griffith repair", location: null },
    { holder: "Nicolas",  category: "Extension Ladders", item: "Double Extension Ladders", quantity: 3, condition: "Good",        notes: null,                                location: null },
    { holder: "Nicolas",  category: "Other Ladders",     item: "4ft Ladders",           quantity: 4,  condition: "Good",          notes: null,                                location: null },
    { holder: "Nicolas",  category: "Extension Ladders", item: "Single Extension Ladder", quantity: 1, condition: "Good",         notes: null,                                location: null },
    { holder: "Nicolas",  category: "Huts",              item: "Huts",                  quantity: 18, condition: "Good",          notes: null,                                location: null },
    { holder: "Nicolas",  category: "Safety Belts",      item: "Safety Belts",          quantity: 20, condition: "Good",          notes: null,                                location: null },
    { holder: "Nicolas",  category: "Spot Sheets",       item: "Spot Sheets",           quantity: 24, condition: "Good",          notes: null,                                location: null },
    { holder: "Nicolas",  category: "Scaffolding",       item: "3m Scaffolding Sets",   quantity: 3,  condition: "Good",          notes: null,                                location: null },
    { holder: "Nicolas",  category: "Scaffolding",       item: "1.5m Scaffolding Sets", quantity: 2,  condition: "Good",          notes: null,                                location: null },
    { holder: "Nicolas",  category: "Scaffolding",       item: "Scaffolding Wheels",    quantity: 10, condition: "Good",          notes: null,                                location: null },
    { holder: "Nicolas",  category: "Appliances",        item: "Electric Stoves",       quantity: 4,  condition: "Good",          notes: null,                                location: null },
    { holder: "Nicolas",  category: "Appliances",        item: "20L Electric Buckets",  quantity: 7,  condition: "Good",          notes: null,                                location: null },
    { holder: "Nicolas",  category: "Appliances",        item: "Deep Freezer",          quantity: 1,  condition: "Good",          notes: null,                                location: null },
    { holder: "Nicolas",  category: "Gas",               item: "9kg Gas Cylinders",     quantity: 3,  condition: "Good",          notes: null,                                location: null },
    { holder: "Nicolas",  category: "Gas",               item: "2-Plate Gas Stove",     quantity: 2,  condition: "Good",          notes: null,                                location: null },
    { holder: "Nicolas",  category: "Safety",            item: "Fire Extinguisher",     quantity: 1,  condition: "Good",          notes: null,                                location: null },
    { holder: "Nicolas",  category: "Extension Cables",  item: "20m Extension Cables",  quantity: 8,  condition: "Good",          notes: null,                                location: null },

    // ── TEMBA ─────────────────────────────────────────────────────────────
    { holder: "Temba",    category: "6ft Ladders",       item: "6ft Ladders",           quantity: 12, condition: "Good",          notes: "Includes fixed ladders",            location: null },
    { holder: "Temba",    category: "6ft Ladders",       item: "6ft Ladder (broken)",   quantity: 1,  condition: "Beyond Repair", notes: null,                                location: null },
    { holder: "Temba",    category: "8ft Ladders",       item: "8ft Ladders",           quantity: 1,  condition: "Good",          notes: null,                                location: null },
    { holder: "Temba",    category: "Extension Ladders", item: "Double Extension Ladders", quantity: 2, condition: "Good",        notes: null,                                location: null },
    { holder: "Temba",    category: "Huts",              item: "Huts",                  quantity: 4,  condition: "Good",          notes: null,                                location: null },
    { holder: "Temba",    category: "Safety Belts",      item: "Safety Belts",          quantity: 14, condition: "Good",          notes: null,                                location: null },
    { holder: "Temba",    category: "Silicone Guns",     item: "Silicone Guns",         quantity: 4,  condition: "Good",          notes: null,                                location: null },
    { holder: "Temba",    category: "Spot Sheets",       item: "Spot Sheets",           quantity: 4,  condition: "Good",          notes: null,                                location: null },
    { holder: "Temba",    category: "Scaffolding",       item: "Scaffold Wheels",       quantity: 4,  condition: "Good",          notes: null,                                location: null },
    { holder: "Temba",    category: "Gas",               item: "9kg Gas Cylinder",      quantity: 1,  condition: "Good",          notes: null,                                location: null },
    { holder: "Temba",    category: "Gas",               item: "Gas Stove",             quantity: 1,  condition: "Good",          notes: null,                                location: null },
    { holder: "Temba",    category: "Appliances",        item: "2-Plate Electric Stove", quantity: 1, condition: "Good",          notes: null,                                location: null },
    { holder: "Temba",    category: "Appliances",        item: "Kettle",                quantity: 1,  condition: "Good",          notes: null,                                location: null },
    { holder: "Temba",    category: "Appliances",        item: "Drums",                 quantity: 3,  condition: "Good",          notes: null,                                location: null },
    { holder: "Temba",    category: "Appliances",        item: "Mattresses",            quantity: 3,  condition: "Good",          notes: null,                                location: null },
    { holder: "Temba",    category: "Safety",            item: "Fire Extinguishers",    quantity: 2,  condition: "Good",          notes: null,                                location: null },
    { holder: "Temba",    category: "Extension Cables",  item: "30m Extension Cable",   quantity: 1,  condition: "Good",          notes: null,                                location: null },

    // ── THOUSAND ──────────────────────────────────────────────────────────
    { holder: "Thousand", category: "Safety Belts",      item: "Safety Belts",          quantity: 17, condition: "Good",          notes: null,                                location: null },
    { holder: "Thousand", category: "6ft Ladders",       item: "6ft Ladders",           quantity: 9,  condition: "Good",          notes: null,                                location: null },
    { holder: "Thousand", category: "8ft Ladders",       item: "8ft Ladders",           quantity: 2,  condition: "Good",          notes: null,                                location: null },
    { holder: "Thousand", category: "Huts",              item: "Huts",                  quantity: 2,  condition: "Good",          notes: null,                                location: null },
    { holder: "Thousand", category: "Drop Sheets",       item: "Drop Sheets",           quantity: 5,  condition: "Good",          notes: null,                                location: null },

    // ── OWEN ──────────────────────────────────────────────────────────────
    { holder: "Owen",     category: "6ft Ladders",       item: "6ft Ladders",           quantity: 12, condition: "Good",          notes: "Includes fixed ladders",            location: null },
    { holder: "Owen",     category: "8ft Ladders",       item: "8ft Ladders",           quantity: 3,  condition: "Good",          notes: null,                                location: null },
    { holder: "Owen",     category: "Extension Ladders", item: "Double Extension Ladders", quantity: 4, condition: "Good",        notes: null,                                location: null },
    { holder: "Owen",     category: "Extension Ladders", item: "14.5m Extension Ladder", quantity: 1, condition: "Good",          notes: null,                                location: null },
    { holder: "Owen",     category: "Huts",              item: "Huts",                  quantity: 1,  condition: "Good",          notes: null,                                location: null },
    { holder: "Owen",     category: "Safety Belts",      item: "Safety Belts",          quantity: 41, condition: "Good",          notes: null,                                location: null },
    { holder: "Owen",     category: "Spot Sheets",       item: "Spot Sheets",           quantity: 22, condition: "Good",          notes: null,                                location: null },
    { holder: "Owen",     category: "Silicone Guns",     item: "Silicone Gun",          quantity: 1,  condition: "Good",          notes: null,                                location: null },
    { holder: "Owen",     category: "Tools",             item: "Chipping Hammers",      quantity: 12, condition: "Good",          notes: null,                                location: null },
    { holder: "Owen",     category: "Safety",            item: "Life Lines",            quantity: 2,  condition: "Good",          notes: null,                                location: null },
    { holder: "Owen",     category: "Safety",            item: "Blue Cones",            quantity: 13, condition: "Good",          notes: null,                                location: null },
    { holder: "Owen",     category: "Pressure Washers",  item: "High Pressure Washer",  quantity: 1,  condition: "Good",          notes: null,                                location: null },
    { holder: "Owen",     category: "Signage",           item: "Yellow Signage Boards", quantity: 5,  condition: "Good",          notes: null,                                location: null },
    { holder: "Owen",     category: "Signage",           item: "White Signage Boards",  quantity: 2,  condition: "Good",          notes: null,                                location: null },

    // ── OFFICE ────────────────────────────────────────────────────────────
    { holder: "Office",   category: "Ladders",           item: "Trolley Ladders",       quantity: 3,  condition: "Good",          notes: null,                                location: "Office" },
    { holder: "Office",   category: "Spraying Machines", item: "Spraying Machines",     quantity: 3,  condition: "Good",          notes: "Yellow signs",                      location: "Office" },
    { holder: "Office",   category: "Spraying Machines", item: "Spraying Machine",      quantity: 1,  condition: "Needs Service", notes: null,                                location: "Office" },
    { holder: "Office",   category: "Compressors",       item: "Compressor",            quantity: 1,  condition: "Good",          notes: null,                                location: "Office" },
    { holder: "Office",   category: "Compressors",       item: "Big Blue Compressor",   quantity: 2,  condition: "Good",          notes: "Stock",                             location: "Office" },
    { holder: "Office",   category: "Extension Cables",  item: "Hose Pipe",             quantity: 4,  condition: "Good",          notes: null,                                location: "Office" },
    { holder: "Office",   category: "Extension Cables",  item: "50m Extension Cable",   quantity: 3,  condition: "Good",          notes: null,                                location: "Office" },
    { holder: "Office",   category: "Extension Cables",  item: "30m Extension Cable",   quantity: 1,  condition: "Good",          notes: null,                                location: "Office" },
    { holder: "Office",   category: "Pressure Washers",  item: "High Pressure Washer",  quantity: 1,  condition: "Needs Service", notes: null,                                location: "Office" },
    { holder: "Office",   category: "Tools",             item: "Grinders",              quantity: 10, condition: "Needs Service", notes: "Not working",                       location: "Office" },
    { holder: "Office",   category: "Tools",             item: "Sanding Machines",      quantity: 4,  condition: "Needs Service", notes: null,                                location: "Office" },
    { holder: "Office",   category: "Tools",             item: "Cordless Grinder",      quantity: 2,  condition: "Good",          notes: "Stock",                             location: "Office" },
    { holder: "Office",   category: "PPE",               item: "Floppy Caps",           quantity: 12, condition: "Good",          notes: "Stock",                             location: "Office" },
    { holder: "Office",   category: "PPE",               item: "Safety Boots",          quantity: 4,  condition: "Good",          notes: "2x size 7, 2x size 8 – Stock",     location: "Office" },
  ];

  // Clear existing data first (idempotent re-seed)
  await prisma.equipmentItem.deleteMany({});
  await prisma.equipmentHolder.deleteMany({});

  // Re-seed holders
  for (const name of holderNames) {
    await prisma.equipmentHolder.create({ data: { name } });
  }

  // Seed items
  for (const row of equipmentData) {
    const holder = await prisma.equipmentHolder.findUnique({
      where: { name: row.holder },
    });

    await prisma.equipmentItem.create({
      data: {
        holderId:  holder?.id ?? null,
        category:  row.category,
        item:      row.item,
        quantity:  row.quantity,
        condition: row.condition,
        notes:     row.notes ?? null,
        location:  row.location ?? null,
      },
    });
  }

  console.log(`✅ Equipment seeded — ${equipmentData.length} records`);
  console.log("🎉 Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
