import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL environment variable is not set");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

/**
 * Map of foreman email address → bank name.
 * Fill in the bank names before running this script.
 * Common SA banks: ABSA, FNB, Standard Bank, Nedbank, Capitec, African Bank
 */
const banksByEmail: Record<string, string> = {
  "chilenguearmando06@gmail.com": "",   // ARMANDO CHILENGUE
  "alfreds@gmail.com":            "",   // Alfred Sbanda
  "alfred@gmail.com":             "",   // Alfred Shumba
  "bambo@gmail.com":              "",   // Bambo Ndlovu
  "bugalo@gmail.com":             "",   // Bugalo Ndebele
  "charles@gmail.com":            "",   // Charles Dube
  "clitos@gmail.com":             "",   // Claitos Dube
  "collins@gmail.com":            "",   // Collins Nkoane
  "cornelius@gmail.com":          "",   // Cornelius Moyo
  "davids@gmail.com":             "",   // DAVID SWATHEDI
  "david@gmail.com":              "",   // David Nkwinika
  "xisane@gmail.com":             "",   // David Xisane
  "ngema@gmail.com":              "",   // Dumisani Ngema
  "muchenaeddie94@gmail.com":     "",   // Edmore Muchena
  "edwin@gmail.com":              "",   // Edwin Tshuma
  "erasmus@gmail.com":            "",   // Erasmus Nyathi
  "fanuel@gmail.com":             "",   // Fanuel Ngwenya
  "felix@gmail.com":              "",   // Felix Rivombo
  "fortune@gmail.com":            "",   // Fortune Ncube
  "frans@gmail.com":              "",   // Frans Ramothwala
  "mathe@gmail.com":              "",   // Gift Mathe
  "gift@gmail.com":               "",   // Gift Nkomose
  "ndebele@gmail.com":            "",   // Hadzisani Ndebele
  "samanana986@gmail.com":        "",   // Hemage Sola
  "herbert@gmail.com":            "",   // Herbert Dube
  "honest@gmail.com":             "",   // Honest Ndebele
  "ngwenya@gmail.com":            "",   // Honest Ngwenya
  "makhuvele@gmail.com":          "",   // Irvin Makhuvele
  "israel@gmail.com":             "",   // Israel Dube
  "july@gmail.com":               "",   // JULY MABUZA
  "james@gmail.com":              "",   // James Mazibuko
  "mbiza@gmail.com":              "",   // Jan Mbiza
  "jan@gmail.com":                "",   // Jan Mbiza
  "joseph@gmail.com":             "",   // Joseph Khophocha
  "junior@gmail.com":             "",   // Junior Tshuma
  "justice@gmail.com":            "",   // Justice Mathye
  "kamogelo@gmail.com":           "",   // Kamogelo Shilwane
  "kenneth@gmail.com":            "",   // Kenneth Ndlovu
  "oberd@gmail.com":              "",   // Khalamula Oberd Maluleka
  "sibandze@gmail.com":           "",   // Khumbulani Sibandze
  "kudakwashe@gmail.com":         "",   // Kudakwashe Bazha
  "khumbulani@gmail.com":         "",   // Kumbulani Ndebele
  "limukani@gmail.com":           "",   // Limukani Ndlovu
  "liveson@gmail.com":            "",   // Liveson Mufandaedza
  "melulekidlovu@gmail.com":      "",   // MELULEKI NDLOVU
  "moment@gmail.com":             "",   // MOMENT DUBE
  "mackenzie@gmail.com":          "",   // Mackenzie Sibanda
  "matome@gmail.com":             "",   // Matome Leshabane
  "mduduzi@gmail.com":            "",   // Mduduzi Tshabalala
  "meluleki@gmail.com":           "",   // Meluleki Moyo
  "methembe@gmail.com":           "",   // Methembe Ndlovu
  "michaelmpofu987@gmail.com":    "",   // Michael Mpofu
  "mongamelie@gmail.com":         "",   // Mongameli Ncube
  "mthulisi@gmail.com":           "",   // Mthulisi Ndlovu
  "machloane@gmail.com":          "",   // Musa Machloane
  "mushemutamba48@gmail.com":     "",   // Mutamba Mushe
  "nyikohlungwani@gmail.com":     "",   // NYIKO HLUNGWANI
  "ndodana@gmail.com":            "",   // Ndodana Sibanda
  "ndumiso@gmail.com":            "",   // Ndumiso Ndlovu
  "nkosindloe1@gmail.com":        "",   // Nkosinathi Ndlovu
  "mzizi@gmail.com":              "",   // Nqobani Mzizi
  "nyasha@gmail.com":             "",   // Nyasha Vera
  "nyiko@gmail.com":              "",   // Nyiko Ngobeni
  "nzalama@gmail.com":            "",   // Nzalama Ngobeni
  "ranakabaep@gmail.com":         "",   // Palesa Ranakabae
  "patience@gmail.com":           "",   // Patience Sepuru
  "boloka@gmail.com":             "",   // Priscilla Boloka
  "professor@gmail.com":          "",   // Professor Nleya
  "ndove@gmail.com":              "",   // RICHARD NDOVE
  "aphane@gmail.com":             "",   // Rebecca Aphane
  "malejonerefilo@gmail.com":     "",   // Refiloe Malejoane
  "romeo@gmail.com":              "",   // Romeo Maphosa
  "ronald@gmail.com":             "",   // Ronald Mafhara
  "samuel@gmail.com":             "",   // Samuel Ncube
  "sello@gmail.com":              "",   // Sello Mmara
  "senzo@gmail.com":              "",   // Senzo Mnguni
  "mthunzi@gmail.com":            "",   // Shadreck Mthunzi
  "sikhumbuzo@gmail.com":         "",   // Sikhumbuzo Dlamini
  "sindiso@gmail.com":            "",   // Sindiso Ncube
  "sylvesterncube@gmail.com":     "",   // Sylvester Ncube
  "sylvesterndebele@gmail.com":   "",   // Sylvester Ndebele
  "tando@gmail.com":              "",   // Tando Ndudula
  "thamie@gmail.com":             "",   // Thamsanqa Ndlovu
  "thandaza356@gmail.com":        "",   // Thandazani Ndlovu
  "thandazani@gmail.com":         "",   // Thandazani Ndlovu
  "themba@gmail.com":             "",   // Themba Mhlanga
  "mkoka@gmail.com":              "",   // Thembani Mkoka
  "thokozani@gmail.com":          "",   // Thokozani Khumalo
  "giftmalatji@gmail.com":        "",   // Tiiesetso Gift Malatji
  "victor@gmail.com":             "",   // Victor Kwinika
  "vukosi@gmail.com":             "",   // Vukosi Mkhari
  "vusinyathi@gmail.com":         "",   // Vusi Nyathi
  "vusumuzi.masina@gmail.com":    "",   // Vusumuzi Masina
  "vusumuzi@gmail.com":           "",   // Vusumuzi Nkomo
  "walter@gmail.com":             "",   // Walter Sebothoma
  "winter@gmail.com":             "",   // Winter Rapaka
  "yongama@gmail.com":            "",   // Yongama Portia Ntshisela
  "mathavele@gmail.com":          "",   // Zacaria Mathavele
  "zwelie@gmail.com":             "",   // Zwelithini Ndlovu
};

async function main() {
  console.log("🏦 Seeding foreman bank names...");
  let updated = 0;
  let skipped = 0;

  for (const [email, bankName] of Object.entries(banksByEmail)) {
    if (!bankName) { skipped++; continue; }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { console.warn(`  ⚠ No user found for ${email}`); continue; }

    const foreman = await prisma.foreman.findUnique({ where: { userId: user.id } });
    if (!foreman) { console.warn(`  ⚠ No foreman record for ${email}`); continue; }

    await prisma.foreman.update({
      where: { id: foreman.id },
      data: { bankName },
    });
    console.log(`  ✓ ${user.name} → ${bankName}`);
    updated++;
  }

  console.log(`\n✅ Done — ${updated} updated, ${skipped} skipped (empty bank name)`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
