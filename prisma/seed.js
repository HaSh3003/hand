import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();
function hashPassword(password) { const salt = randomBytes(16).toString("hex"); return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`; }

async function main() {
  const users = [
    { name: "يوسف أحمد", email: "youssef@hand.app", phone: "01012345678", role: "manager", monthlyShare: 1580, status: "active", joinDate: new Date("2026-01-10T12:00:00Z") },
    { name: "محمد علي", email: "mohamed@hand.app", phone: "01123456789", role: "resident", monthlyShare: 1580, status: "active", joinDate: new Date("2026-02-01T12:00:00Z") },
    { name: "عمر خالد", email: "omar@hand.app", phone: "01234567890", role: "resident", monthlyShare: 1580, status: "active", joinDate: new Date("2026-02-15T12:00:00Z") },
    { name: "أحمد سامي", email: "ahmed@hand.app", phone: "01098765432", role: "resident", monthlyShare: 1580, status: "active", joinDate: new Date("2026-03-01T12:00:00Z") },
    { name: "كريم حسن", email: "karim@hand.app", phone: "01187654321", role: "resident", monthlyShare: 1580, status: "pending", joinDate: new Date("2026-04-12T12:00:00Z") }
  ];
  for (const user of users) await prisma.user.upsert({ where: { email: user.email }, update: { passwordHash: hashPassword("Hand@123") }, create: { ...user, passwordHash: hashPassword("Hand@123") } });

  if (await prisma.category.count() === 0) {
    await prisma.category.createMany({ data: [
      { name: "اشتراك السكن", type: "income", amount: 1580, dueDay: 1, frequency: "monthly", amountMode: "fixed", description: "المبلغ الشهري الذي يدفعه كل فرد للمحفظة" },
      { name: "إيجار السكن", type: "expense", amount: 6000, dueDay: 5, frequency: "monthly", amountMode: "fixed", description: "الإيجار الشهري الأساسي للسكن" },
      { name: "فاتورة الكهرباء", type: "expense", amount: 1350, dueDay: 10, frequency: "monthly", amountMode: "flexible", description: "مبلغ أساسي يمكن أن يزيد حسب الاستهلاك" },
      { name: "فاتورة المياه", type: "expense", amount: 420, dueDay: 12, frequency: "monthly", amountMode: "flexible", description: "مبلغ أساسي يمكن أن يزيد حسب الاستهلاك" },
      { name: "اشتراك الإنترنت", type: "expense", amount: 630, dueDay: 15, frequency: "monthly", amountMode: "fixed", description: "اشتراك الإنترنت المنزلي" }
    ] });
  }

  const youssef = await prisma.user.findUnique({ where: { email: "youssef@hand.app" } });
  if (await prisma.housingTransaction.count() === 0) {
    const contribution = await prisma.category.findFirst({ where: { name: "اشتراك السكن" } });
    const gas = await prisma.category.create({ data: { name: "غاز", type: "expense", amount: 120, dueDay: 20, frequency: "monthly", amountMode: "flexible", description: "فاتورة الغاز" } });
    await prisma.housingTransaction.createMany({ data: [
      { type: "income", party: "محمد علي", amount: 1580, note: "حصة شهر سبتمبر", date: new Date("2026-09-01T12:00:00Z"), categoryId: contribution.id },
      { type: "income", party: "عمر خالد", amount: 1580, note: "حصة شهر سبتمبر", date: new Date("2026-09-01T12:00:00Z"), categoryId: contribution.id },
      { type: "income", party: "يوسف أحمد", amount: 1580, note: "حصة شهر سبتمبر", date: new Date("2026-09-02T12:00:00Z"), categoryId: contribution.id, userId: youssef.id },
      { type: "expense", party: "فاتورة الغاز", amount: 120, note: "فاتورة سبتمبر", date: new Date("2026-09-02T12:00:00Z"), categoryId: gas.id }
    ] });
  }

  if (await prisma.personalTransaction.count() === 0) {
    await prisma.personalTransaction.createMany({ data: [
      { ownerId: youssef.id, type: "income", title: "الراتب الشهري", amount: 18000, account: "الحساب البنكي", category: "راتب", note: "راتب سبتمبر", date: new Date("2026-09-01T12:00:00Z") },
      { ownerId: youssef.id, type: "income", title: "عمل حر", amount: 4500, account: "المحفظة الإلكترونية", category: "عمل إضافي", note: "مشروع تصميم", date: new Date("2026-09-02T12:00:00Z") },
      { ownerId: youssef.id, type: "expense", title: "مشتريات شخصية", amount: 1200, account: "الحساب البنكي", category: "تسوق", note: "مستلزمات الشهر", date: new Date("2026-09-02T12:00:00Z") }
    ] });
  }

  if (await prisma.debt.count() === 0) {
    await prisma.debt.createMany({ data: [
      { ownerId: youssef.id, creditor: "أحمد محمود", title: "مبلغ شخصي", amount: 5000, paid: 1500, dueDate: new Date("2026-09-20T12:00:00Z"), note: "سداد على دفعات" },
      { ownerId: youssef.id, creditor: "البنك", title: "قسط جهاز", amount: 8000, paid: 4000, dueDate: new Date("2026-10-05T12:00:00Z"), note: "القسط المتبقي" }
    ] });
  }
  await prisma.setting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

main().finally(() => prisma.$disconnect());
