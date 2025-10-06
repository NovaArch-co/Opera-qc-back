const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function addTestUser() {
  const email = "new@novarch.com";
  const plainPassword = "1234";

  // Hash the password
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  // Insert the user into the database
  await prisma.user.create({
    data: {
      email: email,
      password: hashedPassword,
    },
  });

  console.log(`Test user created with email: ${email}`);
}

addTestUser()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
