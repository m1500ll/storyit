import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Joins class names; later Tailwind utilities win over earlier conflicting ones (e.g. `w-full` then `w-auto`). */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
