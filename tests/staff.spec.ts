import { test, expect } from "@playwright/test";
import { getE2ETestData } from "./e2eData";

test.describe("Staff", () => {
  test("Staff can see staff navigation", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("button", {
        name: "Stock",
        exact: true,
      }),
    ).toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "New Sale",
        exact: true,
      }),
    ).toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "Receive Stock",
        exact: true,
      }),
    ).toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "Customers",
        exact: true,
      }),
    ).toBeVisible();
  });

  test("Staff cannot see admin navigation", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("button", {
        name: "Products",
        exact: true,
      }),
    ).not.toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "Pending Purchases",
        exact: true,
      }),
    ).not.toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "Customer Outstanding",
        exact: true,
      }),
    ).not.toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "Supplier Outstanding",
        exact: true,
      }),
    ).not.toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "Payments",
        exact: true,
      }),
    ).not.toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "Sales History",
        exact: true,
      }),
    ).not.toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "Stock Adjustment",
        exact: true,
      }),
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
      }),
    ).toBeVisible({
      timeout: 10000,
    });
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
      }),
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
      }),
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
      }),
    ).toBeVisible();
  });

  test("Staff can receive E2E test stock", async ({ page }) => {
    const testData = await getE2ETestData();

    await page.goto("/");

    await page.getByRole("button", {
      name: "Receive Stock",
      exact: true,
    }).click();

    await expect(
      page.getByRole("heading", {
        name: "Receive Stock",
        exact: true,
      }),
    ).toBeVisible();

    const supplierSelect = page.getByLabel("Supplier");

    await expect(
      supplierSelect,
    ).toBeAttached();

    await supplierSelect.selectOption(
      String(testData.supplierId),
    );

    const locationSelect = page.getByLabel("Location");

    await expect(
      locationSelect,
    ).toBeAttached();

    await locationSelect.selectOption(
      String(testData.locationId),
    );

    const productSelect = page.getByLabel("Product");

    await expect(
      productSelect,
    ).toBeAttached();

    await productSelect.selectOption(
      String(testData.productId),
    );

    await page.getByLabel("Quantity").fill("1");

    await page
      .locator("form")
      .getByRole("button", {
        name: "Receive Stock",
        exact: true,
      })
      .click();

    await expect(
      page.getByText(/received successfully/i),
    ).toBeVisible();
  });

  test("Staff can create an E2E sale with partial payment", async ({
    page,
  }) => {
    const testData = await getE2ETestData();

    await page.goto("/");

    await page.getByRole("button", {
      name: "New Sale",
      exact: true,
    }).click();

    await expect(
      page.getByRole("heading", {
        name: "New Sale",
        exact: true,
      }),
    ).toBeVisible();

    /*
     * New Sale selects:
     *
     * 0 = Location
     * 1 = Product
     * 2 = Customer
     */
    const selects = page.locator("form select");

    await expect(selects).toHaveCount(3);

    await selects
      .nth(0)
      .selectOption(String(testData.locationId));

    await selects
      .nth(1)
      .selectOption(String(testData.productId));

    await selects
      .nth(2)
      .selectOption(String(testData.customerId));

    /*
     * Number inputs:
     *
     * 0 = Quantity
     * 1 = Selling Price
     * 2 = Paid Now
     */
    const numberInputs = page.locator(
      'form input[type="number"]',
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
      page.getByText(/sale created successfully/i),
    ).toBeVisible();

    await expect(
      page.getByText(/Customer due:\s*₹19,000/i),
    ).toBeVisible();
  });

  test("E2E sale is reflected in Admin Customer Outstanding", async ({
    page,
    browser,
  }) => {
    const testData = await getE2ETestData();

    /*
     * Step 1: Receive stock for this test.
     *
     * This makes the test independent from the separate
     * "Staff can receive E2E test stock" test.
     */
    await page.goto("/");

    await page.getByRole("button", {
      name: "Receive Stock",
      exact: true,
    }).click();

    await expect(
      page.getByRole("heading", {
        name: "Receive Stock",
        exact: true,
      }),
    ).toBeVisible();

    const supplierSelect = page.getByLabel("Supplier");

    await expect(
      supplierSelect,
    ).toBeAttached();

    await supplierSelect.selectOption(
      String(testData.supplierId),
    );

    const locationSelect = page.getByLabel("Location");

    await expect(
      locationSelect,
    ).toBeAttached();

    await locationSelect.selectOption(
      String(testData.locationId),
    );

    const receiveProductSelect =
      page.getByLabel("Product");

    await expect(
      receiveProductSelect,
    ).toBeAttached();

    await receiveProductSelect.selectOption(
      String(testData.productId),
    );

    await page.getByLabel("Quantity").fill("1");

    await page
      .locator("form")
      .getByRole("button", {
        name: "Receive Stock",
        exact: true,
      })
      .click();

    await expect(
      page.getByText(/received successfully/i),
    ).toBeVisible();

    /*
     * Step 2: Open New Sale.
     */
    await page.getByRole("button", {
      name: "New Sale",
      exact: true,
    }).click();

    await expect(
      page.getByRole("heading", {
        name: "New Sale",
        exact: true,
      }),
    ).toBeVisible();

    /*
     * New Sale selects:
     *
     * 0 = Location
     * 1 = Product
     * 2 = Customer
     */
    const selects = page.locator("form select");

    await expect(selects).toHaveCount(3);

    await selects
      .nth(0)
      .selectOption(String(testData.locationId));

    await selects
      .nth(1)
      .selectOption(String(testData.productId));

    /*
     * Step 3: Create a unique customer.
     *
     * This ensures the expected ₹19,000 balance starts
     * from zero for this test.
     */
    await page.getByRole("button", {
      name: "New Customer",
      exact: true,
    }).click();

    await expect(
      page.getByRole("heading", {
        name: "Quick Customer Creation",
        exact: true,
      }),
    ).toBeVisible();

    const timestamp = Date.now();

    const customerName =
      `E2E Outstanding Customer ${timestamp}`;

    const customerPhone =
      `9${String(timestamp).slice(-9)}`;

    /*
     * Text inputs:
     *
     * 0 = Customer search
     * 1 = New customer name
     * 2 = New customer phone
     */
    const customerInputs = page.locator(
      'form input:not([type="number"])',
    );

    await expect(customerInputs).toHaveCount(3);

    await customerInputs.nth(1).fill(customerName);
    await customerInputs.nth(2).fill(customerPhone);

    await page.getByRole("button", {
      name: "Create Customer",
      exact: true,
    }).click();

    await expect(
      page.getByText("Customer created.", {
        exact: true,
      }),
    ).toBeVisible();

    /*
     * Step 4: Create ₹20,000 sale with ₹1,000 paid.
     */
    const numberInputs = page.locator(
      'form input[type="number"]',
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
      page.getByText(/sale created successfully/i),
    ).toBeVisible();

    await expect(
      page.getByText(/Customer due:\s*₹19,000/i),
    ).toBeVisible();

    /*
     * Step 5: Open Admin using the saved Admin auth state.
     */
    const adminContext = await browser.newContext({
      storageState: "playwright/.auth/admin.json",
    });

    const adminPage = await adminContext.newPage();

    try {
      await adminPage.goto("/");

      await adminPage.getByRole("button", {
        name: "Customer Outstanding",
        exact: true,
      }).click();

      await expect(
        adminPage.getByRole("heading", {
          name: "Customer Outstanding",
          exact: true,
        }),
      ).toBeVisible();

      /*
       * CustomerOutstanding renders each customer inside
       * an <article>, with the customer name as an <h2>.
       */
      const customerHeading =
        adminPage.getByRole("heading", {
          name: customerName,
          exact: true,
        });

      await expect(customerHeading).toBeVisible();

      const customerArticle =
        customerHeading.locator("..");

      /*
       * Actual CustomerOutstanding.tsx output:
       *
       * Outstanding: INR 19,000
       */
      await expect(customerArticle).toContainText(
        "Outstanding: INR 19,000",
      );
    } finally {
      await adminContext.close();
    }
  });

  test("Staff can transfer E2E stock between locations", async ({
    page,
  }) => {
    const testData = await getE2ETestData();

    const destinationLocationId = 1; // Main Shop

    /*
     * Step 1: Receive 1 unit so this test has
     * its own stock to transfer.
     */
    await page.goto("/");

    await page.getByRole("button", {
      name: "Receive Stock",
      exact: true,
    }).click();

    await expect(
      page.getByRole("heading", {
        name: "Receive Stock",
        exact: true,
      }),
    ).toBeVisible();

    await page.getByLabel("Supplier").selectOption(
      String(testData.supplierId),
    );

    await page.getByLabel("Location").selectOption(
      String(testData.locationId),
    );

    await page.getByLabel("Product").selectOption(
      String(testData.productId),
    );

    await page.getByLabel("Quantity").fill("1");

    await page
      .locator("form")
      .getByRole("button", {
        name: "Receive Stock",
        exact: true,
      })
      .click();

    await expect(
      page.getByText(/received successfully/i),
    ).toBeVisible();

    /*
     * Step 2: Read stock after receiving.
     */
    const getStock = async (
      productId: number,
      locationId: number,
    ) => {
      const client = await (
        await import("./e2eData")
      ).getAdminClient();

      try {
        const { data, error } = await client
          .from("current_stock")
          .select("quantity")
          .eq("product_id", productId)
          .eq("location_id", locationId)
          .maybeSingle();

        if (error) {
          throw new Error(
            `Failed to read stock: ${error.message}`,
          );
        }

        return Number(data?.quantity ?? 0);
      } finally {
        await client.auth.signOut();
      }
    };

    const sourceBefore = await getStock(
      testData.productId,
      testData.locationId,
    );

    const destinationBefore = await getStock(
      testData.productId,
      destinationLocationId,
    );

    /*
     * Step 3: Open Stock Transfer.
     */
    await page.getByRole("button", {
      name: "Stock Transfer",
      exact: true,
    }).click();

    await expect(
      page.getByRole("heading", {
        name: "Stock Transfer",
        exact: true,
      }),
    ).toBeVisible();

    /*
     * Step 4: Select product and locations.
     */
    await page.getByLabel("Product").selectOption(
      String(testData.productId),
    );

    await page.getByLabel("From Location").selectOption(
      String(testData.locationId),
    );

    await page.getByLabel("To Location").selectOption(
      String(destinationLocationId),
    );

    await page.getByLabel("Quantity").fill("1");

    await page.getByLabel("Notes").fill(
      "E2E stock transfer",
    );

    await page.getByRole("button", {
      name: "Transfer Stock",
      exact: true,
    }).click();

    /*
     * Step 5: Verify UI success.
     */
    await expect(
      page.getByText(/stock transferred successfully/i),
    ).toBeVisible();

    /*
     * Step 6: Verify actual database stock movement.
     */
    const sourceAfter = await getStock(
      testData.productId,
      testData.locationId,
    );

    const destinationAfter = await getStock(
      testData.productId,
      destinationLocationId,
    );

    expect(sourceAfter).toBe(sourceBefore - 1);
    expect(destinationAfter).toBe(
      destinationBefore + 1,
    );
  });
});