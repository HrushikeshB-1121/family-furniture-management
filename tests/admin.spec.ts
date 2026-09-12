import { test, expect } from "@playwright/test";

test.describe("Admin", () => {
  test("Admin can see admin navigation", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("button", {
        name: "Products",
        exact: true,
      })
    ).toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "Pending Purchases",
        exact: true,
      })
    ).toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "Customer Outstanding",
        exact: true,
      })
    ).toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "Supplier Outstanding",
        exact: true,
      })
    ).toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "Payments",
        exact: true,
      })
    ).toBeVisible();
  });

  test("Admin can open Products", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", {
      name: "Products",
      exact: true,
    }).click();

    await expect(
      page.getByRole("heading", {
        name: "Products",
        exact: true,
      })
    ).toBeVisible();
  });

  test("Admin can open Payments", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", {
      name: "Payments",
      exact: true,
    }).click();

    await expect(
      page.getByRole("heading", {
        name: "Payments",
        exact: true,
      })
    ).toBeVisible();
  });

  test("Admin can open Customer Outstanding", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", {
      name: "Customer Outstanding",
      exact: true,
    }).click();

    await expect(
      page.getByRole("heading", {
        name: "Customer Outstanding",
        exact: true,
      })
    ).toBeVisible();
  });

  test("Admin can confirm a pending purchase", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", {
      name: "Pending Purchases",
      exact: true,
    }).click();

    await expect(
      page.getByRole("heading", {
        name: "Pending Purchases",
        exact: true,
      })
    ).toBeVisible();

    const confirmButtons = page.getByRole("button", {
      name: "Confirm Purchase",
      exact: true,
    });

    const pendingCountBefore = await confirmButtons.count();

    expect(pendingCountBefore).toBeGreaterThan(0);

    const numberInputs = page.locator('input[type="number"]');

    await expect(numberInputs.first()).toBeVisible();
    await expect(numberInputs.nth(1)).toBeVisible();

    // First pending purchase:
    // first number input = unit cost
    // second number input = paid now
    await numberInputs.first().fill("6500");
    await numberInputs.nth(1).fill("1000");

    const paymentMethod = page.locator("select").first();

    await expect(paymentMethod).toBeVisible();
    await paymentMethod.selectOption("CASH");

    await confirmButtons.first().click();

    // Successful confirmation removes the purchase from
    // the pending-purchase list.
    await expect
      .poll(async () => {
        return page.getByRole("button", {
          name: "Confirm Purchase",
          exact: true,
        }).count();
      })
      .toBe(pendingCountBefore - 1);
  });
});