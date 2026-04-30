import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL environment variable is not set");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Bank names sourced directly from the payment PDF
const banksByEmail: Record<string, string> = {
  "aphane@gmail.com":             "STD",          // Aphane, Rebecca
  "kudakwashe@gmail.com":         "CAPITEC",      // Bazha, Kudakwashe
  "boloka@gmail.com":             "CAPITEC",      // Boloka, Priscilla
  "chilenguearmando06@gmail.com": "FNB",          // Chillengue, Armando
  "sikhumbuzo@gmail.com":         "FNB",          // Dlamini, Sikhumbuzo
  "charles@gmail.com":            "FNB",          // Dube, Charles
  "herbert@gmail.com":            "FNB",          // Dube, Herbert
  "clitos@gmail.com":             "CAPITEC",      // Dube, Clitos
  "israel@gmail.com":             "FNB",          // Dube, Israel
  "moment@gmail.com":             "FNB",          // Dube, Moment
  "nyikohlungwani@gmail.com":     "CAPITEC",      // Hlungwani, Nyiko
  "joseph@gmail.com":             "FNB",          // Khophocha, Joseph
  "thokozani@gmail.com":          "FNB",          // Khumalo, Thokozani
  "victor@gmail.com":             "FNB",          // Kwinika, Victor
  "matome@gmail.com":             "FNB",          // Leshabane, Matome
  "july@gmail.com":               "FNB",          // Mabuza, July
  "ronald@gmail.com":             "CAPITEC",      // Mafhara, Ronald
  "makhuvele@gmail.com":          "STD",          // Makhuvele, Irvin
  "oberd@gmail.com":              "FNB",          // Maluleka, Oberd
  "giftmalatji@gmail.com":        "FNB",          // Malatji, Gift
  "vusumuzi.masina@gmail.com":    "CAPITEC",      // Masina, Vusumuzi
  "justice@gmail.com":            "CAPITEC",      // Mathye, Justice
  "mathe@gmail.com":              "FNB",          // Mathe, Gift
  "mathavele@gmail.com":          "FNB",          // Matavele, Zacharias
  "james@gmail.com":              "FNB",          // Mazibuko, James
  "mbiza@gmail.com":              "FNB",          // Mbiza, Jan
  "jan@gmail.com":                "FNB",          // Mbiza, Jan (alt account)
  "themba@gmail.com":             "FNB",          // Mhlanga, Themba
  "vukosi@gmail.com":             "CAPITEC",      // Mkhari, Vukosi
  "mkoka@gmail.com":              "FNB",          // Mkoka, Thembani
  "malejonerefilo@gmail.com":     "CAPITEC",      // Malejoane, Refiloe
  "sello@gmail.com":              "FNB",          // Mmara, Sello
  "senzo@gmail.com":              "FNB",          // Mnguni, Senzo
  "cornelius@gmail.com":          "FNB",          // Moyo, Cornelius
  "meluleki@gmail.com":           "FNB",          // Moyo, Meluleki
  "michaelmpofu987@gmail.com":    "FNB",          // Mpofu, Michael
  "muchenaeddie94@gmail.com":     "FNB",          // Muchena, Edmore
  "liveson@gmail.com":            "FNB",          // Mufandaedza, Liveson
  "mushemutamba48@gmail.com":     "CAPITEC",      // Mutamba, Mushe
  "mthunzi@gmail.com":            "FNB",          // Muthunzi, Shadreck
  "mzizi@gmail.com":              "FNB",          // Nqobani, Thabani
  "sylvesterncube@gmail.com":     "FNB",          // Ncube, Sylvester
  "fortune@gmail.com":            "FNB",          // Ncube, Fortune
  "sindiso@gmail.com":            "CAPITEC",      // Ncube, Sindiso
  "samuel@gmail.com":             "FNB",          // Ncube, Samuel
  "mongamelie@gmail.com":         "CAPITEC",      // Ncube, Mongameli
  "bugalo@gmail.com":             "FNB",          // Ndebele, Bugalo
  "khumbulani@gmail.com":         "FNB",          // Ndebele, Kumbulani
  "sylvesterndebele@gmail.com":   "FNB",          // Ndebele, Silvester
  "kenneth@gmail.com":            "FNB",          // Ndlovu, Kenneth
  "thandazani@gmail.com":         "FNB",          // Ndlovu, Thandazani
  "thandaza356@gmail.com":        "FNB",          // Ndlovu, Thandazani (alt)
  "mthulisi@gmail.com":           "FNB",          // Ndlovu, Mthulisi
  "nkosindloe1@gmail.com":        "FNB",          // Ndlovu, Nkosinathi
  "zwelie@gmail.com":             "FNB",          // Ndlovu, Zweletini
  "bambo@gmail.com":              "FNB",          // Ndlovu, Bambo
  "thamie@gmail.com":             "CAPITEC",      // Ndlovu, Thamsanqa
  "ndumiso@gmail.com":            "FNB",          // Ndlovu, Ndumiso
  "melulekidlovu@gmail.com":      "FNB",          // Ndlovu, Meluluki
  "limukani@gmail.com":           "FNB",          // Ndlovu, Limokane
  "ndove@gmail.com":              "FNB",          // Ndove, Richard
  "tando@gmail.com":              "FNB",          // Ndudula, Tando
  "ngema@gmail.com":              "FNB",          // Ngema, Buysiwa
  "nyiko@gmail.com":              "FNB",          // Ngobeni, Nelson
  "nzalama@gmail.com":            "FNB",          // Ngobeni, Ndzalama
  "fanuel@gmail.com":             "FNB",          // Ngwenya, Fanuel
  "ngwenya@gmail.com":            "FNB",          // Ngwenya, Honest
  "gift@gmail.com":               "FNB",          // Nkomose, Gift
  "vusumuzi@gmail.com":           "FNB",          // Nkomo, Vusumuzi
  "collins@gmail.com":            "FNB",          // Nkoane, Collins
  "david@gmail.com":              "CAPITEC",      // Nkwinika, David
  "professor@gmail.com":          "FNB",          // Nleya, Professor
  "yongama@gmail.com":            "CAPITEC",      // Ntshisela, Yongama
  "erasmus@gmail.com":            "FNB",          // Nyathi, Erasmus
  "vusinyathi@gmail.com":         "FNB",          // Nyathi, Vusi
  "ranakabaep@gmail.com":         "CAPITEC",      // Ranakabae, Palesa
  "winter@gmail.com":             "FNB",          // Rapaka, Winter
  "felix@gmail.com":              "FNB",          // Rivombo, Felix
  "walter@gmail.com":             "FNB",          // Sebothoma, Walter
  "patience@gmail.com":           "CAPITEC",      // Sepuru, Patience
  "kamogelo@gmail.com":           "FNB",          // Shilwane, Kamogelo
  "ndodana@gmail.com":            "FNB",          // Sibanda, Ndodana
  "sibandze@gmail.com":           "FNB",          // Sibandze, Khumulani
  "mackenzie@gmail.com":          "CAPITEC",      // Sibanda, Mackenzie
  "alfreds@gmail.com":            "FNB",          // Sibanda, Alfred
  "samanana986@gmail.com":        "FNB",          // Sola, Hemage
  "davids@gmail.com":             "FNB",          // Swathedi, David
  "david.swathedi@foreman.local": "FNB",          // Swathedi, David (alt)
  "mduduzi@gmail.com":            "FNB",          // Tshabalala, Mduduzi
  "nyasha@gmail.com":             "FNB",          // Vera, Nyasha
  "xisane@gmail.com":             "FNB",          // Xisane, David
  "frans@gmail.com":              "CAPITEC",      // Ramothwala, Frans
};

async function main() {
  console.log("🏦 Seeding foreman bank names from payment PDF...");
  let updated = 0;
  let notFound = 0;

  for (const [email, bankName] of Object.entries(banksByEmail)) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { notFound++; continue; }

    const foreman = await prisma.foreman.findUnique({ where: { userId: user.id } });
    if (!foreman) { notFound++; continue; }

    await prisma.foreman.update({ where: { id: foreman.id }, data: { bankName } });
    console.log(`  ✓ ${user.name} → ${bankName}`);
    updated++;
  }

  console.log(`\n✅ Done — ${updated} updated, ${notFound} not found in DB`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
