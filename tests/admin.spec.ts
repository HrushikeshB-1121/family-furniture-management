import { test, expect } from '@playwright/test';

test('Admin can see admin navigation', async ({ page }) => {
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

  await expect(
    page.getByRole('button', {
      name: 'Products',
      exact: true,
    }),
  ).toBeVisible();

  await expect(
    page.getByRole('button', {
      name: 'Pending Purchases',
      exact: true,
    }),
  ).toBeVisible();

  await expect(
    page.getByRole('button', {
      name: 'Customer Outstanding',
      exact: true,
    }),
  ).toBeVisible();

  await expect(
    page.getByRole('button', {
      name: 'Supplier Outstanding',
      exact: true,
    }),
  ).toBeVisible();

  await expect(
    page.getByRole('button', {
      name: 'Payments',
      exact: true,
    }),
  ).toBeVisible();
});

test('Admin can open Products', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', {
    name: 'Products',
    exact: true,
  }).click();

  await expect(
    page.getByRole('heading', {
      name: 'Products',
      exact: true,
    }),
  ).toBeVisible();
});

test('Admin can open Payments', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', {
    name: 'Payments',
    exact: true,
  }).click();

  await expect(
    page.getByRole('heading', {
      name: 'Payments',
      exact: true,
    }),
  ).toBeVisible();
});