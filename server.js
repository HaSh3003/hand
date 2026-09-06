import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

function json(response, status, data, headers = {}) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  response.end(JSON.stringify(data));
}
function corsHeaders(request) {
  const origin = request.headers.origin || "*";
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Cookie", "Access-Control-Allow-Credentials": "true" };
}
function setCors(response, request) { for (const [key, value] of Object.entries(corsHeaders(request))) response.setHeader(key, value); }

function hashToken(token) { return createHash("sha256").update(token).digest("hex"); }
function hashPassword(password) { const salt = randomBytes(16).toString("hex"); return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`; }
function verifyPassword(password, stored) { try { const [salt, hash] = stored.split(":"); return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hash, "hex")); } catch { return false; } }
function cookieValue(request, name) { const item = String(request.headers.cookie || "").split(";").map(value => value.trim()).find(value => value.startsWith(`${name}=`)); return item ? decodeURIComponent(item.slice(name.length + 1)) : null; }
async function authenticatedUser(request) { const token = cookieValue(request, "hand_session"); if (!token) return null; const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } }); if (!session || session.expiresAt <= new Date() || session.user.status !== "active") { if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => {}); return null; } return session.user; }
function publicUser(user) { const { passwordHash, ...safe } = user; return safe; }
const userPublicSelect = { id: true, name: true, email: true, phone: true, role: true, monthlyShare: true, status: true, joinDate: true, createdAt: true, avatarUrl: true };

async function body(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 1_000_000) throw new Error("Request is too large");
  }
  return raw ? JSON.parse(raw) : {};
}

function validType(value) {
  return value === "income" || value === "expense";
}

function dateValue(value) {
  const result = value ? new Date(`${value}T12:00:00Z`) : new Date();
  if (Number.isNaN(result.getTime())) throw new Error("Invalid date");
  return result;
}

async function api(request, response, url) {
  const route = url.pathname;
  const method = request.method;

  if (route === "/api/login" && method === "POST") {
    const input = await body(request);
    const user = await prisma.user.findUnique({ where: { email: String(input.email || "").trim().toLowerCase() } });
    if (!user || user.status !== "active" || !verifyPassword(String(input.password || ""), user.passwordHash)) return json(response, 401, { error: "البريد أو كلمة المرور غير صحيحة" });
    const token = randomBytes(32).toString("base64url"), remember = Boolean(input.remember);
    const expiresAt = new Date(Date.now() + (remember ? 30 : 1) * 86400000);
    await prisma.session.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt } });
    return json(response, 200, { user: publicUser(user) }, { "Set-Cookie": `hand_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/${remember ? `; Max-Age=${30 * 86400}` : ""}` });
  }
  if (route === "/api/logout" && method === "POST") {
    const token = cookieValue(request, "hand_session");
    if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
    return json(response, 200, { ok: true }, { "Set-Cookie": "hand_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" });
  }

  const currentUser = await authenticatedUser(request);
  if (!currentUser) return json(response, 401, { error: "يجب تسجيل الدخول أولًا" });
  const currentUserId = currentUser.id;
  if (route === "/api/me" && method === "GET") return json(response, 200, { user: publicUser(currentUser) });
  if (route === "/api/me" && method === "PUT") {
    const input = await body(request);
    if (!input.name || !input.email) return json(response, 400, { error: "الاسم والبريد مطلوبان" });
    const updated = await prisma.user.update({ where: { id: currentUserId }, data: { name: String(input.name).trim(), email: String(input.email).trim().toLowerCase(), phone: String(input.phone || "").trim() || null } });
    return json(response, 200, { user: publicUser(updated) });
  }
  if (route === "/api/me/password" && method === "PUT") {
    const input = await body(request);
    if (!verifyPassword(String(input.currentPassword || ""), currentUser.passwordHash)) return json(response, 400, { error: "كلمة المرور الحالية غير صحيحة" });
    if (String(input.newPassword || "").length < 8) return json(response, 400, { error: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل" });
    await prisma.user.update({ where: { id: currentUserId }, data: { passwordHash: hashPassword(String(input.newPassword)) } });
    return json(response, 200, { ok: true });
  }

  if (route === "/api/bootstrap" && method === "GET") {
    const [users, categories, housingTransactions, personalTransactions, debts, settings] = await Promise.all([
      prisma.user.findMany({ orderBy: { id: "asc" } }),
      prisma.category.findMany({ where: { active: true }, orderBy: { dueDay: "asc" } }),
      prisma.housingTransaction.findMany({ include: { category: true }, orderBy: [{ date: "desc" }, { id: "desc" }] }),
      prisma.personalTransaction.findMany({ where: { ownerId: currentUserId }, orderBy: [{ date: "desc" }, { id: "desc" }] }),
      prisma.debt.findMany({ where: { OR: [{ ownerId: currentUserId }, { counterpartyId: currentUserId }] }, include: { owner: { select: userPublicSelect }, counterparty: { select: userPublicSelect }, payments: true }, orderBy: { dueDate: "asc" } }),
      prisma.setting.findUnique({ where: { id: 1 } })
    ]);
    return json(response, 200, { currentUserId, currentUser: publicUser(currentUser), users: users.map(publicUser), categories, housingTransactions, personalTransactions, debts, settings });
  }

  if (route === "/api/users" && method === "GET") return json(response, 200, (await prisma.user.findMany({ orderBy: { id: "asc" } })).map(publicUser));
  if (route === "/api/users" && method === "POST") {
    const input = await body(request);
    if (!input.name || !input.email) return json(response, 400, { error: "الاسم والبريد مطلوبان" });
    const user = await prisma.user.create({ data: { name: String(input.name).trim(), email: String(input.email).trim().toLowerCase(), phone: String(input.phone || "").trim() || null, role: input.role === "manager" ? "manager" : "resident", monthlyShare: Number(input.share) || 0, status: ["active", "pending", "disabled"].includes(input.status) ? input.status : "active", joinDate: dateValue(input.joinDate), passwordHash: hashPassword(String(input.password || "Hand@123")) } });
    return json(response, 201, publicUser(user));
  }
  const userStatusMatch = route.match(/^\/api\/users\/(\d+)\/status$/);
  if (userStatusMatch && method === "PATCH") {
    const input = await body(request);
    const status = ["active", "pending", "disabled"].includes(input.status) ? input.status : "disabled";
    return json(response, 200, await prisma.user.update({ where: { id: Number(userStatusMatch[1]) }, data: { status } }));
  }

  if (route === "/api/categories" && method === "GET") return json(response, 200, await prisma.category.findMany({ where: { active: true }, orderBy: { dueDay: "asc" } }));
  if (route === "/api/categories" && method === "POST") {
    const input = await body(request);
    if (!input.name || !validType(input.type) || Number(input.amount) <= 0) return json(response, 400, { error: "بيانات التصنيف غير مكتملة" });
    const category = await prisma.category.create({ data: { name: String(input.name).trim(), type: input.type, amount: Number(input.amount), dueDay: Math.min(31, Math.max(1, Number(input.dueDay) || 1)), frequency: input.frequency === "once" ? "once" : "monthly", amountMode: input.amountMode === "flexible" ? "flexible" : "fixed", description: String(input.description || "").trim() || null } });
    return json(response, 201, category);
  }
  const categoryMatch = route.match(/^\/api\/categories\/(\d+)$/);
  if (categoryMatch && method === "DELETE") {
    await prisma.category.update({ where: { id: Number(categoryMatch[1]) }, data: { active: false } });
    return json(response, 200, { ok: true });
  }

  if (route === "/api/housing-transactions" && method === "GET") return json(response, 200, await prisma.housingTransaction.findMany({ include: { category: true }, orderBy: [{ date: "desc" }, { id: "desc" }] }));
  if (route === "/api/housing-transactions" && method === "POST") {
    const input = await body(request);
    if (!validType(input.type) || !input.party || Number(input.amount) <= 0) return json(response, 400, { error: "بيانات الحركة غير مكتملة" });
    const transaction = await prisma.housingTransaction.create({ data: { type: input.type, party: String(input.party).trim(), amount: Number(input.amount), note: String(input.note || "").trim() || null, date: dateValue(input.date), categoryId: input.categoryId ? Number(input.categoryId) : null, userId: input.userId ? Number(input.userId) : null }, include: { category: true } });
    return json(response, 201, transaction);
  }

  if (route === "/api/personal-transactions" && method === "GET") return json(response, 200, await prisma.personalTransaction.findMany({ where: { ownerId: currentUserId }, orderBy: [{ date: "desc" }, { id: "desc" }] }));
  if (route === "/api/personal-transactions" && method === "POST") {
    const input = await body(request);
    if (!validType(input.type) || !input.title || Number(input.amount) <= 0) return json(response, 400, { error: "بيانات الحركة غير مكتملة" });
    const transaction = await prisma.personalTransaction.create({ data: { ownerId: currentUserId, type: input.type, title: String(input.title).trim(), amount: Number(input.amount), account: String(input.account || "نقدي"), category: String(input.category || "أخرى"), note: String(input.note || "").trim() || null, date: dateValue(input.date) } });
    return json(response, 201, transaction);
  }

  if (route === "/api/debts" && method === "GET") return json(response, 200, await prisma.debt.findMany({ where: { OR: [{ ownerId: currentUserId }, { counterpartyId: currentUserId }] }, include: { owner: { select: userPublicSelect }, counterparty: { select: userPublicSelect }, payments: true }, orderBy: { dueDate: "asc" } }));
  if (route === "/api/debts" && method === "POST") {
    const input = await body(request);
    const amount = Number(input.amount), paid = Number(input.paid) || 0;
    if (!input.title || amount <= 0 || paid < 0 || paid > amount) return json(response, 400, { error: "بيانات الدين غير صحيحة" });
    const direction = input.direction === "owed_to_me" ? "owed_to_me" : "i_owe";
    const counterpartyId = Number(input.counterpartyId) || null;
    if (direction === "owed_to_me" && !counterpartyId) return json(response, 400, { error: "يجب اختيار مستخدم عند تسجيل دين ليك" });
    if (counterpartyId === currentUserId) return json(response, 400, { error: "لا يمكن اختيار نفسك كطرف في الدين" });
    let creditor = String(input.creditor || "").trim();
    if (counterpartyId) {
      const counterparty = await prisma.user.findUnique({ where: { id: counterpartyId } });
      if (!counterparty) return json(response, 404, { error: "المستخدم غير موجود" });
      creditor = direction === "i_owe" ? counterparty.name : currentUser.name;
    } else if (!creditor) {
      return json(response, 400, { error: "يجب تحديد جهة الدين" });
    }
    const debt = await prisma.debt.create({ data: { ownerId: currentUserId, direction, counterpartyId, creditor, title: String(input.title).trim(), amount, paid, dueDate: dateValue(input.dueDate), note: String(input.note || "").trim() || null }, include: { owner: { select: userPublicSelect }, counterparty: { select: userPublicSelect }, payments: true } });
    return json(response, 201, debt);
  }
  const debtPayMatch = route.match(/^\/api\/debts\/(\d+)\/payments$/);
  if (debtPayMatch && method === "POST") {
    const debtId = Number(debtPayMatch[1]);
    const input = await body(request);
    const payment = Number(input.amount);
    const debt = await prisma.debt.findFirst({ where: { id: debtId, OR: [{ ownerId: currentUserId }, { counterpartyId: currentUserId }] }, include: { owner: { select: userPublicSelect }, counterparty: { select: userPublicSelect }, payments: true } });
    if (!debt || payment <= 0 || payment > debt.amount - debt.paid) return json(response, 400, { error: "مبلغ السداد غير صحيح" });
    const isDebtor = (debt.direction === "i_owe" && debt.ownerId === currentUserId) || (debt.direction === "owed_to_me" && debt.counterpartyId === currentUserId);
    if (!isDebtor) return json(response, 403, { error: "فقط المدين يمكنه تسجيل السداد" });
    const updated = await prisma.$transaction(async tx => {
      await tx.debtPayment.create({ data: { debtId, amount: payment, date: new Date() } });
      await tx.personalTransaction.create({ data: { ownerId: currentUserId, type: "expense", title: `سداد ${debt.title}`, amount: payment, account: String(input.account || "نقدي"), category: "سداد ديون", note: `سداد إلى ${debt.creditor}`, date: new Date() } });
      return tx.debt.update({ where: { id: debtId }, data: { paid: { increment: payment } }, include: { owner: { select: userPublicSelect }, counterparty: { select: userPublicSelect }, payments: true } });
    });
    return json(response, 200, updated);
  }
  const debtDeleteMatch = route.match(/^\/api\/debts\/(\d+)$/);
  if (debtDeleteMatch && method === "DELETE") {
    const debtId = Number(debtDeleteMatch[1]);
    const debt = await prisma.debt.findFirst({ where: { id: debtId, OR: [{ ownerId: currentUserId }, { counterpartyId: currentUserId }] } });
    if (!debt) return json(response, 404, { error: "الدين غير موجود" });
    const isCreditor = (debt.direction === "i_owe" && debt.counterpartyId === currentUserId) || (debt.direction === "owed_to_me" && debt.ownerId === currentUserId);
    if (!isCreditor && debt.ownerId !== currentUserId) return json(response, 403, { error: "لا يمكنك حذف هذا الدين" });
    await prisma.debt.delete({ where: { id: debtId } });
    return json(response, 200, { ok: true });
  }

  if (route === "/api/settings" && method === "GET") return json(response, 200, await prisma.setting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }));
  if (route === "/api/settings" && method === "PUT") {
    const input = await body(request);
    const settingsData = { residenceName: String(input.residenceName || "سكن النخيل"), residentCount: Math.max(1, Number(input.residentCount) || 1), currency: String(input.currency || "EGP"), monthStart: Math.min(28, Math.max(1, Number(input.monthStart) || 1)), splitMethod: input.splitMethod === "custom" ? "custom" : "equal", includeManager: Boolean(input.includeManager), dueReminder: Boolean(input.dueReminder), lowBalanceAlert: Boolean(input.lowBalanceAlert), transactionAlert: Boolean(input.transactionAlert), reminderDays: Number(input.reminderDays) || 3, theme: input.theme === "light" ? "light" : "dark", hidePersonalTotals: Boolean(input.hidePersonalTotals), requireLogin: Boolean(input.requireLogin) };
    const settings = await prisma.setting.upsert({ where: { id: 1 }, update: settingsData, create: { id: 1, ...settingsData } });
    return json(response, 200, settings);
  }
  return json(response, 404, { error: "المسار غير موجود" });
}

async function serveStatic(response, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(root, `.${decodeURIComponent(requested)}`);
  if (!filePath.startsWith(`${root}${path.sep}`)) return json(response, 403, { error: "غير مسموح" });
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("Not a file");
    const content = await readFile(filePath);
    response.writeHead(200, { "Content-Type": mime[path.extname(filePath)] || "application/octet-stream" });
    response.end(content);
  } catch {
    json(response, 404, { error: "الملف غير موجود" });
  }
}

const server = http.createServer(async (request, response) => {
  setCors(response, request);
  if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) await api(request, response, url);
    else {
      const isLogin = url.pathname === "/" || url.pathname === "/index.html";
      const isProtectedPage = url.pathname.endsWith(".html") && !isLogin;
      const user = isLogin || isProtectedPage ? await authenticatedUser(request) : null;
      if (isProtectedPage && !user) { response.writeHead(302, { Location: "/index.html" }); response.end(); return; }
      if (isLogin && user) { response.writeHead(302, { Location: "/dashboard.html" }); response.end(); return; }
      await serveStatic(response, url.pathname);
    }
  } catch (error) {
    console.error(error);
    const duplicate = error?.code === "P2002";
    json(response, duplicate ? 409 : 500, { error: duplicate ? "هذه البيانات مسجلة بالفعل" : "حدث خطأ في الخادم" });
  }
});

server.listen(port, "127.0.0.1", () => console.log(`Hand is running at http://127.0.0.1:${port}`));

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, async () => {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
});
