import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

type BankName =
  | "Access Bank"
  | "Bidvest Bank"
  | "Capitec"
  | "FNB"
  | "Nedbank"
  | "Standard Bank"
  | "Zero Bank";

type PaymentBankRow = {
  paymentName: string;
  bankName: BankName;
  aliases?: string[];
};

const paymentBankRows: PaymentBankRow[] = [
  { paymentName: "Aphane, Rebecca", bankName: "Standard Bank" },
  { paymentName: "Bhebhe, Ashel", bankName: "FNB" },
  { paymentName: "Boloka, Priscilla", bankName: "Capitec" },
  { paymentName: "Bucibo, Lawrence", bankName: "Nedbank" },
  { paymentName: "Chavance, Antony", bankName: "Standard Bank" },
  { paymentName: "Chillengue, Armando", bankName: "FNB", aliases: ["ARMANDO CHILENGUE"] },
  { paymentName: "Dlamini, Sikhumbuzo", bankName: "FNB" },
  { paymentName: "Dube, Charles", bankName: "FNB" },
  { paymentName: "Dube, Herbert", bankName: "FNB" },
  { paymentName: "Dube, Brighton", bankName: "Zero Bank" },
  { paymentName: "Dube, Moment", bankName: "FNB" },
  { paymentName: "Dube, Clitos", bankName: "Capitec", aliases: ["Claitos Dube"] },
  { paymentName: "Dube, Israel", bankName: "FNB" },
  { paymentName: "Dube, Tawanda", bankName: "FNB" },
  { paymentName: "Gebe, Emmanuel", bankName: "Standard Bank" },
  { paymentName: "Hlungwani, Nyiko", bankName: "Capitec" },
  { paymentName: "Kachuta, Thomas", bankName: "Access Bank" },
  { paymentName: "Khophocha, Joseph", bankName: "FNB" },
  { paymentName: "Khumalo, Thokozani", bankName: "FNB" },
  { paymentName: "Kwinika, Victor", bankName: "FNB" },
  { paymentName: "Leshabane, Matome", bankName: "FNB" },
  { paymentName: "Mabunda, David", bankName: "FNB" },
  { paymentName: "Mabuza, July", bankName: "FNB" },
  { paymentName: "Machiloane, Musa", bankName: "FNB", aliases: ["Musa machloane"] },
  { paymentName: "Machel, Fernando", bankName: "Access Bank" },
  { paymentName: "Mafhara, Ronald", bankName: "Capitec" },
  { paymentName: "Mahutse, Knowledge", bankName: "Zero Bank" },
  { paymentName: "Makhuvele, Irvin", bankName: "Standard Bank" },
  { paymentName: "Maluleka, Oberd", bankName: "FNB", aliases: ["Khalamula Oberd Maluleka"] },
  { paymentName: "Malatji, Gift", bankName: "FNB", aliases: ["Tiiesetso Gift Malatji"] },
  { paymentName: "Masina, Vusumuzi", bankName: "Capitec" },
  { paymentName: "Masango, Albertonia", bankName: "FNB" },
  { paymentName: "Mathye, Justice", bankName: "Capitec" },
  { paymentName: "Mathe, Giift", bankName: "FNB", aliases: ["Gift Mathe"] },
  { paymentName: "Matavele, Zacharias", bankName: "FNB", aliases: ["Zacaria Mathavele"] },
  { paymentName: "Mazibuko, James", bankName: "FNB" },
  { paymentName: "Mbiza, Jan", bankName: "FNB" },
  { paymentName: "Mhlanga, Themba", bankName: "FNB" },
  { paymentName: "Mimbri, Carlos", bankName: "Access Bank" },
  { paymentName: "Mkhari, Vukosi", bankName: "FNB" },
  { paymentName: "Mkoka, Thembani", bankName: "FNB" },
  { paymentName: "Malenze, Thomas", bankName: "Access Bank" },
  { paymentName: "Malejoane, Refiloe", bankName: "Capitec" },
  { paymentName: "Mmara, Sello", bankName: "FNB" },
  { paymentName: "Mnguni, Senzo", bankName: "FNB" },
  { paymentName: "Moyo, Cornelius", bankName: "FNB" },
  { paymentName: "Moyo, George", bankName: "Access Bank" },
  { paymentName: "Moyo, Meluleki", bankName: "FNB" },
  { paymentName: "Mpandze, Simon", bankName: "Nedbank" },
  { paymentName: "Mphangeli, Willie", bankName: "FNB", aliases: ["Mphangeli Willie"] },
  { paymentName: "Mpofu 2, Michael", bankName: "FNB" },
  { paymentName: "Mathusse, Nelson", bankName: "Standard Bank" },
  { paymentName: "Muchena, Edmore", bankName: "FNB" },
  { paymentName: "Mufandaedza, Liveson", bankName: "FNB" },
  { paymentName: "Mutamba, Mushe", bankName: "Capitec", aliases: ["Mutamba Mushe"] },
  { paymentName: "Muthunzi, Shadreck", bankName: "FNB", aliases: ["Shadreck Mthunzi"] },
  { paymentName: "Thabani Nqobani", bankName: "FNB", aliases: ["Nqobani Mzizi"] },
  { paymentName: "Ncube, Sylvester", bankName: "FNB" },
  { paymentName: "Ncube, Fortune", bankName: "FNB" },
  { paymentName: "Ncube, Ocean", bankName: "Capitec" },
  { paymentName: "Ncube, Sindiso", bankName: "Capitec" },
  { paymentName: "Ncube, Samuel", bankName: "FNB" },
  { paymentName: "Ncube, Mongameli", bankName: "Capitec" },
  { paymentName: "Ndebele, Sonny", bankName: "FNB" },
  { paymentName: "Ndebele, Bugalo", bankName: "FNB" },
  { paymentName: "Ndebele, Thousand", bankName: "FNB", aliases: ["Thousand"] },
  { paymentName: "Ndebele, Kumbulani", bankName: "FNB" },
  { paymentName: "Ndebele, Silvester", bankName: "FNB", aliases: ["Sylvester Ndebele"] },
  { paymentName: "Ndlovu, Kenneth", bankName: "FNB" },
  { paymentName: "Ndlovu, Limokane", bankName: "FNB", aliases: ["Limukani ndlovu"] },
  { paymentName: "Ndlovu, Fortune BT", bankName: "Access Bank" },
  { paymentName: "Ndlovu, Meluluki", bankName: "FNB", aliases: ["MELULEKI NDLOVU"] },
  { paymentName: "Ndlovu, Thandazani", bankName: "FNB" },
  { paymentName: "Ndlovu, Mthulisi", bankName: "FNB" },
  { paymentName: "Ndlovu, Nkosinathi", bankName: "FNB" },
  { paymentName: "Ndlovu, Zweletini", bankName: "FNB", aliases: ["Zwelithini Ndlovu"] },
  { paymentName: "Ndlovu, Bambo", bankName: "FNB" },
  { paymentName: "Ndlovu, Thamsanqa", bankName: "Capitec" },
  { paymentName: "Ndlovu, Ndumiso", bankName: "FNB" },
  { paymentName: "Ndove, Richard", bankName: "FNB" },
  { paymentName: "Ndudula, Tando", bankName: "FNB" },
  { paymentName: "Ngema, Buysiwa", bankName: "FNB", aliases: ["Dumisani Ngema"] },
  { paymentName: "Ngomane, Sphiwe", bankName: "Capitec", aliases: ["Siphiwe NGOMANE", "Sphiwe ngomani"] },
  { paymentName: "Ngobeni, Nelson", bankName: "FNB", aliases: ["Nyiko Ngobeni"] },
  { paymentName: "Ngobeni, Ndzalama", bankName: "FNB", aliases: ["Nzalama ngobeni"] },
  { paymentName: "Ngwenya, Fanuel", bankName: "FNB" },
  { paymentName: "Nkomose, Gift", bankName: "FNB" },
  { paymentName: "Nkomo, Vusumuzi", bankName: "FNB" },
  { paymentName: "Nkoane, Collins", bankName: "FNB" },
  { paymentName: "Nkwinika, David", bankName: "Capitec" },
  { paymentName: "Nyoni, Mgcini", bankName: "Access Bank" },
  { paymentName: "Ntshisela, Yongama", bankName: "Capitec", aliases: ["Yongama Portia Ntshisela"] },
  { paymentName: "Nyathi, Millisen", bankName: "Bidvest Bank" },
  { paymentName: "Nyathi, Freedom", bankName: "FNB", aliases: ["Freedom"] },
  { paymentName: "Nyathi, Howard", bankName: "FNB", aliases: ["Haward Nyathi"] },
  { paymentName: "Nyathi, Erasmus", bankName: "FNB" },
  { paymentName: "Nyathi, Vusi", bankName: "FNB" },
  { paymentName: "Phosa, Tebogo", bankName: "FNB", aliases: ["Tebogo Phosa"] },
  { paymentName: "Pudikabekwa, Tshepo", bankName: "FNB", aliases: ["Tshepo pudikabekwa"] },
  { paymentName: "Ramothwala, Frans", bankName: "Capitec" },
  { paymentName: "Ranakabae, Palesa", bankName: "Capitec" },
  { paymentName: "Rapaka, Winter", bankName: "FNB" },
  { paymentName: "Rivombo, Felix", bankName: "FNB" },
  { paymentName: "Sebothoma, Walter", bankName: "FNB" },
  { paymentName: "Sepuru, Patience", bankName: "Capitec" },
  { paymentName: "Setata, Pertunia", bankName: "Capitec", aliases: ["Mokgadi Pertunia Setata"] },
  { paymentName: "Shilwane, Kamogelo", bankName: "FNB" },
  { paymentName: "Shumba, Alfred", bankName: "FNB", aliases: ["Alfred Shumba"] },
  { paymentName: "Sibanda, Ndodana", bankName: "FNB" },
  { paymentName: "Sibandze, Khumulani", bankName: "FNB", aliases: ["Khumbulani Sibandze"] },
  { paymentName: "Sibanda, Mackenzie", bankName: "Capitec" },
  { paymentName: "Sibanda, Alfred", bankName: "FNB", aliases: ["Alfred Sbanda"] },
  { paymentName: "Sibanda, Oliver", bankName: "Capitec" },
  { paymentName: "Sibanda, Themba", bankName: "Standard Bank", aliases: ["Themba Sibanda"] },
  { paymentName: "Siphali, Thabani", bankName: "Access Bank" },
  { paymentName: "Sola, Hemage", bankName: "FNB" },
  { paymentName: "Swathedi, David", bankName: "FNB", aliases: ["DAVID SWATHEDI", "David Swathedi"] },
  { paymentName: "Temo, William", bankName: "FNB" },
  { paymentName: "Tshabalala, Mduduzi", bankName: "FNB" },
  { paymentName: "Vera, Nyasha", bankName: "FNB" },
  { paymentName: "Xisane, David", bankName: "FNB" },
  { paymentName: "Zuze, Roy", bankName: "Access Bank" },
];

function normalizeName(value: string) {
  const trimmed = value.trim();
  const commaParts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
  const name = commaParts.length === 2 ? `${commaParts[1]} ${commaParts[0]}` : trimmed;

  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

async function main() {
  console.log("Seeding foreman bank names from payment data...");

  const foremen = await prisma.foreman.findMany({
    select: {
      id: true,
      bankName: true,
      user: { select: { name: true, email: true } },
    },
  });

  const foremenByName = new Map<string, typeof foremen>();

  for (const foreman of foremen) {
    const name = foreman.user.name;
    if (!name) {
      continue;
    }

    const key = normalizeName(name);
    foremenByName.set(key, [...(foremenByName.get(key) ?? []), foreman]);
  }

  let updated = 0;
  let unchanged = 0;
  const unmatched: string[] = [];

  for (const row of paymentBankRows) {
    const candidates = [row.paymentName, ...(row.aliases ?? [])].flatMap(
      (name) => foremenByName.get(normalizeName(name)) ?? [],
    );
    const uniqueCandidates = Array.from(
      new Map(candidates.map((foreman) => [foreman.id, foreman])).values(),
    );

    if (uniqueCandidates.length === 0) {
      unmatched.push(row.paymentName);
      continue;
    }

    for (const foreman of uniqueCandidates) {
      if (foreman.bankName === row.bankName) {
        unchanged++;
        continue;
      }

      await prisma.foreman.update({
        where: { id: foreman.id },
        data: { bankName: row.bankName },
      });

      console.log(
        `  ${foreman.user.name ?? foreman.user.email} -> ${row.bankName}`,
      );
      updated++;
    }
  }

  console.log(`\nDone: ${updated} updated, ${unchanged} already correct.`);

  if (unmatched.length > 0) {
    console.log("\nNo matching foreman user found for:");
    for (const name of unmatched) {
      console.log(`  - ${name}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
