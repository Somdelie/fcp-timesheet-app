import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const ppeProducts: { name: string; price: number }[] = [
  { name: "BEANIE", price: 34.50 },
  { name: "BROOM BLACK FIBRE", price: 45.00 },
  { name: "BROOM HOUSE HOLD", price: 85.00 },
  { name: "Brush 12mm", price: 15.00 },
  { name: "Brush Scrubbing 280mm", price: 45.00 },
  { name: "BRUSH WHITE WASH", price: 20.00 },
  { name: "BRUSHES 100MM", price: 123.50 },
  { name: "BRUSHES 19MM", price: 14.00 },
  { name: "BRUSHES 25MM", price: 29.50 },
  { name: "BRUSHES 38MM", price: 34.50 },
  { name: "BRUSHES 50MM", price: 44.50 },
  { name: "BRUSHES 75MM", price: 78.00 },
  { name: "EEZYPILE ROLLER COMPLETE 225", price: 35.30 },
  { name: "FITCH 12mm", price: 28.00 },
  { name: "FITCH 19mm", price: 32.00 },
  { name: "FITCH 25mm", price: 40.00 },
  { name: "FITCH 6mm", price: 18.50 },
  { name: "FLOPPY HAT", price: 49.00 },
  { name: "Gloves", price: 9.00 },
  { name: "HANDLE 9 INCH", price: 12.00 },
  { name: "HANDLE ROLLER 100MM", price: 12.00 },
  { name: "HANDLE TELESCOPIC 2.5", price: 43.70 },
  { name: "HARD HAT", price: 18.00 },
  { name: "MOCK MOHAIR 160MM REFILL", price: 32.00 },
  { name: "MOHAIR 100MM", price: 28.00 },
  { name: "MOHAIR 225MM", price: 26.50 },
  { name: "MOP JUMBO", price: 55.00 },
  { name: "OVERALL HALF", price: 122.00 },
  { name: "OVERALLS FULL", price: 244.00 },
  { name: "PADLOCK IRON 40MM", price: 29.00 },
  { name: "PAINT BRUSH 50MM", price: 20.00 },
  { name: "PERLON 100MM COMPLETE", price: 37.00 },
  { name: "PERLON 100MM REFILL", price: 22.90 },
  { name: "PERLON 150MM COMPLETE", price: 48.50 },
  { name: "PERLON 150MM REFILL", price: 24.50 },
  { name: "PROPILE ROLL REFILL 225MM", price: 34.00 },
  { name: "PVA COMPLETE 100MM", price: 25.00 },
  { name: "PVA REFILL 100MM", price: 15.75 },
  { name: "PVA REFILL 225MM", price: 32.00 },
  { name: "REFILL TEXTURED", price: 79.50 },
  { name: "Refill Textured 100", price: 27.50 },
  { name: "ROL HAM 100 MOHAIR", price: 39.00 },
  { name: "RUBBING BLOCK 50MM", price: 60.00 },
  { name: "SAFETY BOOTS FULL", price: 260.00 },
  { name: "SAFETY BOOTS HALF", price: 130.00 },
  { name: "SAFETY GOGGLES", price: 9.00 },
  { name: "SAFETY VESTS", price: 48.00 },
  { name: "SCRAPER 50MM", price: 18.95 },
  { name: "SCRAPER 75MM", price: 25.00 },
  { name: "Scraper Plastic 25mm", price: 20.00 },
  { name: "SCRAPER WINDOW", price: 12.60 },
  { name: "SILICONE GUN BLUE", price: 49.45 },
  { name: "SILICONE GUN ORANGE", price: 28.25 },
  { name: "SPONGE LARGE", price: 15.00 },
  { name: "SPONGE MEDIUM", price: 11.50 },
  { name: "SPONGE ROLLER 70MM COMPLETE", price: 22.50 },
  { name: "SPONGE ROLLER 100MM COMPLETE", price: 26.00 },
  { name: "SPONGE ROLLER 160 REFILL", price: 18.00 },
  { name: "SPONGE ROLLER 160MM COMPLETE", price: 33.00 },
  { name: "SPONGE ROLLER COMPLETE 50MM", price: 14.90 },
  { name: "SPONGE SMALL", price: 9.50 },
  { name: "TROWEL MARMORAN", price: 30.26 },
  { name: "TROWEL PLASTER PLASTIC", price: 49.50 },
  { name: "TROWEL PLASTER PLASTIC HAWK", price: 35.00 },
  { name: "WIRE BRUSH", price: 45.00 },
];

async function seedPpeProducts() {
  let created = 0;
  let updated = 0;

  for (const product of ppeProducts) {
    const normalizedName = product.name.trim().toLowerCase();

    const existing = await prisma.product.findFirst({
      where: { normalizedName },
    });

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: { price: product.price, normalizedName },
      });
      updated++;
    } else {
      await prisma.product.create({
        data: {
          name: product.name,
          normalizedName,
          price: product.price,
          isActive: true,
        },
      });
      created++;
    }
  }

  console.log(`PPE Products — created: ${created}, updated: ${updated}`);
}

seedPpeProducts()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
