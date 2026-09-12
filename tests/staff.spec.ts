import { test, expect } from "@playwright/test";

test.describe("Staff", () => {
  test("Staff can see staff navigation", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("button", {
        name: "Stock",
        exact: true,
      })
    ).toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "New Sale",
        exact: true,
      })
    ).toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "Receive Stock",
        exact: true,
      })
    ).toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "Customers",
        exact: true,
      })
    ).toBeVisible();
  });

  test("Staff cannot see admin navigation", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("button", {
        name: "Products",
        exact: true,
      })
    ).not.toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "Pending Purchases",
        exact: true,
      })
    ).not.toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "Customer Outstanding",
        exact: true,
      })
    ).not.toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "Supplier Outstanding",
        exact: true,
      })
    ).not.toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "Payments",
        exact: true,
      })
    ).not.toBeVisible();
  });

  test("Staff can open Stock", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", {
      name: "Stock",
      exact: true,
    }).click();

    await expect(
      page.getByRole("heading", {
        name: "Stock",
        exact: true,
      })
    ).toBeVisible();
  });

  test("Staff can open Customers", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", {
      name: "Customers",
      exact: true,
    }).click();

    await expect(
      page.getByRole("heading", {
        name: "Customers",
        exact: true,
      })
    ).toBeVisible();
  });

  test("Staff can open Receive Stock", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", {
      name: "Receive Stock",
      exact: true,
    }).click();

    await expect(
      page.getByRole("heading", {
        name: "Receive Stock",
        exact: true,
      })
    ).toBeVisible();
  });

  test("Staff can open New Sale", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", {
      name: "New Sale",
      exact: true,
    }).click();

    await expect(
      page.getByRole("heading", {
        name: "New Sale",
        exact: true,
      })
    ).toBeVisible();
  });

  test("Staff can receive stock", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", {
      name: "Receive Stock",
      exact: true,
    }).click();

    await expect(
      page.getByRole("heading", {
        name: "Receive Stock",
        exact: true,
      })
    ).toBeVisible();

    // Supplier: azmath = id 3
    const supplierSelect = page.getByLabel("Supplier");

    await expect(supplierSelect).toBeAttached();
    await supplierSelect.selectOption("3");

    // Location: Main Shop = id 1
    const locationSelect = page.getByLabel("Location");

    await expect(locationSelect).toBeAttached();
    await locationSelect.selectOption("1");

    // Product: find SOF-001 from the actual rendered options.
    const productSelect = page.getByLabel("Product");

    await expect(productSelect).toBeAttached();

    const sofaOption = productSelect.locator("option").filter({
      hasText: "SOF-001",
    });

    await expect(sofaOption).toHaveCount(1);

    const sofaLabel = (await sofaOption.textContent())?.trim();

    expect(sofaLabel).toBeTruthy();

    await productSelect.selectOption({
      label: sofaLabel!,
    });

    // Quantity
    await page.getByLabel("Quantity").fill("1");

    // Submit the form button, not the navigation button.
    await page
      .locator("form")
      .getByRole("button", {
        name: "Receive Stock",
        exact: true,
      })
      .click();

    await expect(
      page.getByText(/received successfully/i)
    ).toBeVisible();
  });

  test("Staff can create a sale with partial payment", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("button", {
      name: "New Sale",
      exact: true,
    }).click();

    await expect(
      page.getByRole("heading", {
        name: "New Sale",
        exact: true,
      })
    ).toBeVisible();

    /*
     * New Sale currently has three selects before payment method
     * appears:
     *
     *   select 0 = Location
     *   select 1 = Product
     *   select 2 = Customer
     */

    const selects = page.locator("form select");

    await expect(selects).toHaveCount(3);

    // Main Shop = location id 1
    const saleLocationSelect = selects.nth(0);
    await saleLocationSelect.selectOption("1");

    // Product
    const saleProductSelect = selects.nth(1);

    const saleSofaOption = saleProductSelect.locator("option").filter({
      hasText: "SOF-001",
    });

    await expect(saleSofaOption).toHaveCount(1);

    const saleSofaLabel = (
      await saleSofaOption.textContent()
    )?.trim();

    expect(saleSofaLabel).toBeTruthy();

    await saleProductSelect.selectOption({
      label: saleSofaLabel!,
    });

    /*
     * Customer
     *
     * The first option is "Walk-in customer".
     * Use the first actual customer already present in the database.
     */
    const customerSelect = selects.nth(2);

    const customerOptions = customerSelect.locator("option");

    await expect
      .poll(async () => customerOptions.count())
      .toBeGreaterThan(1);

    await customerSelect.selectOption({
      index: 1,
    });

    /*
     * Current Sales.tsx number inputs:
     *
     *   0 = Quantity
     *   1 = Selling Price
     *   2 = Paid Now
     */
    const numberInputs = page.locator(
      'form input[type="number"]'
    );

    await expect(numberInputs).toHaveCount(3);

    await numberInputs.nth(0).fill("1");
    await numberInputs.nth(1).fill("20000");
    await numberInputs.nth(2).fill("1000");

    await page.getByRole("button", {
      name: "Create Sale",
      exact: true,
    }).click();

    await expect(
      page.getByText(/sale created successfully/i)
    ).toBeVisible();

    await expect(
      page.getByText(/customer due:\s*₹19,000/i)
    ).toBeVisible();
  });
});