import { mkdirSync } from 'fs';
import { join } from 'path';

export const STUDENT_REQUEST_MAX_BYTES = 5 * 1024 * 1024;

export const STUDENT_REQUEST_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

export const STUDENT_REQUEST_EXT = new Set(['.pdf', '.jpg', '.jpeg', '.png']);

export function studentRequestUploadRoot(): string {
  const root =
    process.env.UPLOAD_DIR || join(process.cwd(), 'uploads', 'student-requests');
  mkdirSync(root, { recursive: true });
  return root;
}

export function isAllowedStudentRequestFile(
  originalName: string,
  mime: string,
): boolean {
  const lower = originalName.toLowerCase();
  const dot = lower.lastIndexOf('.');
  const ext = dot >= 0 ? lower.slice(dot) : '';
  const mimeOk = STUDENT_REQUEST_MIME.has((mime || '').toLowerCase());
  const extOk = STUDENT_REQUEST_EXT.has(ext);
  return mimeOk && extOk;
}
