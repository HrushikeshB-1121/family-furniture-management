import { test as setup, expect, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const authDirectory = path.join(
  process.cwd(),
  'playwright',
  '.auth',
);

fs.mkdirSync(authDirectory, { recursive: true });

async function loginAndSave(
  page: Page,
  email: string,
  password: string,
  authFile: string,
  expectedRole: 'ADMIN' | 'STAFF',
) {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: 'Furniture Management System',
    }),
  ).toBeVisible();

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);

  await page.getByRole('button', { name: 'Login' }).click();

  if (expectedRole === 'ADMIN') {
    await expect(
      page.getByRole('button', { name: 'Products' }),
    ).toBeVisible();

    await expect(
      page.getByRole('button', {
        name: 'Pending Purchases',
      }),
    ).toBeVisible();
  } else {
    await expect(
      page.getByRole('button', { name: 'Receive Stock' }),
    ).toBeVisible();

    await expect(
      page.getByRole('button', { name: 'New Sale' }),
    ).toBeVisible();
  }

  await page.context().storageState({
    path: authFile,
  });
}

setup('authenticate admin', async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required.',
    );
  }

  await loginAndSave(
    page,
    email,
    password,
    path.join(authDirectory, 'admin.json'),
    'ADMIN',
  );
});

setup('authenticate staff', async ({ page }) => {
  const email = process.env.E2E_STAFF_EMAIL;
  const password = process.env.E2E_STAFF_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'E2E_STAFF_EMAIL and E2E_STAFF_PASSWORD are required.',
    );
  }

  await loginAndSave(
    page,
    email,
    password,
    path.join(authDirectory, 'staff.json'),
    'STAFF',
  );
});