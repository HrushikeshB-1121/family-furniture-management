import { test, expect } from '@playwright/test';

test('Staff can see staff navigation', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('button', {
      name: 'Stock',
      exact: true,
    }),
  ).toBeVisible();

  await expect(
    page.getByRole('button', {
      name: 'New Sale',
      exact: true,
    }),
  ).toBeVisible();

  await expect(
    page.getByRole('button', {
      name: 'Receive Stock',
      exact: true,
    }),
  ).toBeVisible();

  await expect(
    page.getByRole('button', {
      name: 'Customers',
      exact: true,
    }),
  ).toBeVisible();
});

test('Staff cannot see admin navigation', async ({
  page,
}) => {
  await page.goto('/');

  await expect(
    page.getByRole('button', {
      name: 'Products',
      exact: true,
    }),
  ).toHaveCount(0);

  await expect(
    page.getByRole('button', {
      name: 'Pending Purchases',
      exact: true,
    }),
  ).toHaveCount(0);

  await expect(
    page.getByRole('button', {
      name: 'Payments',
      exact: true,
    }),
  ).toHaveCount(0);

  await expect(
    page.getByRole('button', {
      name: 'Supplier Outstanding',
      exact: true,
    }),
  ).toHaveCount(0);

  await expect(
    page.getByRole('button', {
      name: 'Customer Outstanding',
      exact: true,
    }),
  ).toHaveCount(0);
});

test('Staff can open Receive Stock', async ({
  page,
}) => {
  await page.goto('/');

  await page.getByRole('button', {
    name: 'Receive Stock',
    exact: true,
  }).click();

  await expect(
    page.getByRole('heading', {
      name: 'Receive Stock',
      exact: true,
    }),
  ).toBeVisible();
});

test('Staff can open New Sale', async ({
  page,
}) => {
  await page.goto('/');

  await page.getByRole('button', {
    name: 'New Sale',
    exact: true,
  }).click();

  await expect(
    page.getByRole('heading', {
      name: 'Create Sale',
      exact: true,
    }),
  ).toBeVisible();
});