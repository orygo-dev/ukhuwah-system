import "server-only";
import { isAllowedUploadUrl } from "@/lib/upload-url";
import { normalizeAssignmentOptions } from "@/lib/assignment-engine";
import { prisma } from "@/lib/prisma";
import { deleteStoredObject } from "@/lib/object-storage";

const ASSIGNMENT_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

export function assignmentMediaFolder(userId: string) {
  return `assignments/${userId}`;
}

export function isValidAssignmentImageUrl(value: string | null | undefined, userId: string) {
  if (!value) return true;
  return isAllowedUploadUrl(value, assignmentMediaFolder(userId), {
    extensions: ASSIGNMENT_IMAGE_EXTENSIONS,
  });
}

export function assignmentQuestionImageUrls(questions: Array<{ imageUrl?: string | null; options?: unknown }>) {
  const urls = new Set<string>();
  for (const question of questions) {
    if (question.imageUrl) urls.add(question.imageUrl);
    for (const option of normalizeAssignmentOptions(question.options)) {
      if (option.imageUrl) urls.add(option.imageUrl);
    }
  }
  return urls;
}

export function validateAssignmentQuestionImages(
  questions: Array<{ imageUrl?: string | null; options?: unknown }>,
  userId: string,
) {
  return [...assignmentQuestionImageUrls(questions)].every((url) =>
    isValidAssignmentImageUrl(url, userId),
  );
}

export async function deleteAssignmentMediaIfUnreferenced(urls: Iterable<string>) {
  const candidates = new Set([...urls].filter(Boolean));
  if (!candidates.size) return;
  const questions = await prisma.assignmentQuestion.findMany({
    select: { imageUrl: true, options: true },
  });
  for (const question of questions) {
    if (question.imageUrl) candidates.delete(question.imageUrl);
    for (const option of normalizeAssignmentOptions(question.options)) {
      if (option.imageUrl) candidates.delete(option.imageUrl);
    }
    if (!candidates.size) return;
  }
  await Promise.all([...candidates].map((url) => deleteStoredObject(url)));
}
