'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import bcrypt from 'bcrypt';
import { sql } from '@/lib/db/client';

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}

const RegisterSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Please enter a valid email.'),
  password: z.string().min(8, 'Password must be at least 8 characters long.'),
});

export async function register(
  prevState: string | undefined,
  formData: FormData,
) {
  const parsed = RegisterSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid form values.';
    return message;
  }

  const { name, email, password } = parsed.data;

  try {
    // Ensure UUID extension exists if this is a fresh DB.
    await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;

    const hashedPassword = await bcrypt.hash(password, 10);
    await sql`
      INSERT INTO users (name, email, password)
      VALUES (${name}, ${email}, ${hashedPassword})
    `;
  } catch (error: any) {
    // Postgres unique constraint violation
    if (error?.code === '23505') {
      return 'An account with that email already exists.';
    }
    console.error('Failed to create user:', error);
    return 'Something went wrong creating your account.';
  }

  // Sign in immediately after successful registration.
  try {
    const fd = new FormData();
    fd.set('email', email);
    fd.set('password', password);
    fd.set('redirectTo', '/dashboard');
    await signIn('credentials', fd);
  } catch (error) {
    if (error instanceof AuthError) {
      // If something odd happens, fall back to login.
      redirect('/login');
    }
    throw error;
  }
}

