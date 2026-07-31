import { prisma } from "../../lib/prisma";

const USER_ID = "cmrc56bfj0007copvdi1pel5l"; // Albertonia's User record
const CURRENT_NAME = "Albertonia";
const CORRECT_NAME = "Albertonia Masango";

async function main() {
  const apply = process.argv.includes("--apply");

  const user = await prisma.user.findUnique({
    where: { id: USER_ID },
    select: { id: true, name: true, email: true },
  });

  if (!user) throw new Error(`User ${USER_ID} not found.`);
  if (user.name !== CURRENT_NAME) {
    throw new Error(
      `Expected current name "${CURRENT_NAME}" but found "${user.name}". Aborting to avoid overwriting an unexpected record.`,
    );
  }

  console.log(
    `${apply ? "Applying" : "Previewing"}: User ${user.id} (${user.email}) name "${user.name}" -> "${CORRECT_NAME}"`,
  );

  if (!apply) return;

  await prisma.user.update({
    where: { id: USER_ID },
    data: { name: CORRECT_NAME },
  });

  console.log("Updated.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
