/**
 * Audit chat fase 1 & 2.
 * Jalankan: npx tsx scripts/audit-chat.ts
 */
import {
  directConversationKey,
  findOrCreateDirectConversation,
  getUnreadCount,
  userAllowsMessages,
} from "../src/lib/chat";
import { prisma } from "../src/lib/prisma";

type Check = { name: string; ok: boolean; detail: string };

async function main() {
  const checks: Check[] = [];

  const teacherA = await prisma.user.findUnique({
    where: { email: "guru@demo.sch.id" },
  });
  const teacherB = await prisma.user.findUnique({
    where: { email: "rina.ipa@guru.demo" },
  });

  if (!teacherA || !teacherB) {
    checks.push({
      name: "Guru demo tersedia",
      ok: false,
      detail: "Butuh guru@demo dan rina.ipa@guru.demo",
    });
    printReport(checks);
    return;
  }

  checks.push({
    name: "Guru menerima pesan (default)",
    ok: await userAllowsMessages(teacherB.id),
    detail: `rina allows=${await userAllowsMessages(teacherB.id)}`,
  });

  try {
    await findOrCreateDirectConversation(teacherA.id, teacherA.id);
    checks.push({
      name: "Self chat ditolak",
      ok: false,
      detail: "should throw",
    });
  } catch (e) {
    checks.push({
      name: "Self chat ditolak",
      ok: e instanceof Error && e.message === "SELF_CHAT",
      detail: e instanceof Error ? e.message : "error",
    });
  }

  const conv = await findOrCreateDirectConversation(teacherA.id, teacherB.id);
  checks.push({
    name: "Buat/temukan conversation 1-on-1",
    ok: !!conv.directKey,
    detail: `key=${conv.directKey}`,
  });

  const key = directConversationKey(teacherA.id, teacherB.id);
  checks.push({
    name: "directKey konsisten",
    ok: conv.directKey === key,
    detail: key,
  });

  const conv2 = await findOrCreateDirectConversation(teacherA.id, teacherB.id);
  checks.push({
    name: "Idempotent create conversation",
    ok: conv2.id === conv.id,
    detail: `same id=${conv.id === conv2.id}`,
  });

  const msg = await prisma.message.create({
    data: {
      conversationId: conv.id,
      senderId: teacherB.id,
      content: `Audit ping ${Date.now()}`,
    },
  });
  await prisma.conversation.update({
    where: { id: conv.id },
    data: { updatedAt: new Date() },
  });

  const unreadA = await getUnreadCount(teacherA.id);
  checks.push({
    name: "Unread count untuk penerima",
    ok: unreadA >= 1,
    detail: `unread=${unreadA}`,
  });

  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: {
        conversationId: conv.id,
        userId: teacherA.id,
      },
    },
    data: { lastReadAt: new Date() },
  });
  const unreadAfterRead = await getUnreadCount(teacherA.id);
  checks.push({
    name: "Mark read mengurangi unread",
    ok: unreadAfterRead < unreadA,
    detail: `${unreadA} -> ${unreadAfterRead}`,
  });

  await prisma.message.delete({ where: { id: msg.id } });

  printReport(checks);
}

function printReport(checks: Check[]) {
  console.log("\n=== Audit Chat Fase 1 & 2 ===\n");
  let failed = 0;
  for (const c of checks) {
    const mark = c.ok ? "PASS" : "FAIL";
    if (!c.ok) failed++;
    console.log(`[${mark}] ${c.name}`);
    console.log(`       ${c.detail}\n`);
  }
  console.log(failed === 0 ? "Semua cek lulus.\n" : `${failed} cek gagal.\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
