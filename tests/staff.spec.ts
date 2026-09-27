import { test, expect } from "@playwright/test";
import {
  getAdminClient,
  getE2ETestData,
} from "./e2eData";

async function openDesktopMenuItem(
  page: import("@playwright/test").Page,
  groupLabel: string,
  itemLabel: string,
) {
  const directItems = page.getByRole("button", {
    name: itemLabel,
    exact: true,
  });

  for (let index = 0; index < await directItems.count(); index += 1) {
    const item = directItems.nth(index);

    if (await item.isVisible().catch(() => false)) {
      await item.click();
      return;
    }
  }

  const groupButton = page
    .locator(".desktop-nav-group-button")
    .filter({ hasText: groupLabel })
    .first();

  await expect(groupButton).toBeVisible();
  await groupButton.click();

  const dropdown = page.locator(".desktop-nav-dropdown");

  await expect(dropdown).toBeVisible();

  await dropdown
    .getByRole("button", {
      name: itemLabel,
      exact: true,
    })
    .click();
}

async function fillCustomerPopupField(
  page: import("@playwright/test").Page,
  labelText: string,
  value: string,
  fieldSelector: string,
) {
  const label = page
    .getByText(labelText, { exact: true })
    .last();

  const field = label.locator(
    "xpath=following::" + fieldSelector + "[1]",
  );

  await expect(field).toBeVisible();
  await field.fill(value);
}

async function receiveE2EStock(
  page: import("@playwright/test").Page,
  productId: number,
  locationId: number,
  testData: Awaited<ReturnType<typeof getE2ETestData>>,
) {
  await openDesktopMenuItem(
    page,
    "Inventory",
    "Receive Stock",
  );

  await expect(
    page.getByRole("heading", {
      name: "Receive Stock",
      exact: true,
    }),
  ).toBeVisible();

  const supplierSearch = page.locator("#supplier-search");

  await supplierSearch.fill("E2E Test Supplier");

  await page
    .getByText("E2E Test Supplier", {
      exact: true,
    })
    .last()
    .click();

  await page.getByLabel("Location").selectOption(
    String(locationId),
  );

  const productSearch = page.locator("#product-search");

  const productSearchText =
    productId === 1
      ? "SOF-001"
      : "E2E-SOF-001";

  const productPattern =
    productId === 1
      ? /SOF-001.*Malaysia Sofa Set - 4 Legs/i
      : /E2E-SOF-001.*E2E Test Sofa/i;

  await productSearch.fill(productSearchText);

  await page
    .getByText(productPattern)
    .last()
    .click();

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
}

test.describe("Staff", () => {
  test("Staff can see staff navigation", async ({ page }) => {
    await page.goto("/");

    await expect(
      page
        .locator(".desktop-nav-group-button")
        .filter({ hasText: "Sales" })
        .first(),
    ).toBeVisible();

    await expect(
      page
        .locator(".desktop-nav-group-button")
        .filter({ hasText: "Inventory" })
        .first(),
    ).toBeVisible();

    await expect(
      page
        .locator(".desktop-nav-group-button")
        .filter({ hasText: "People" })
        .first(),
    ).toBeVisible();
  });

  test("Staff cannot see admin navigation", async ({ page }) => {
    await page.goto("/");

    await expect(
      page
        .locator(".desktop-nav-group-button")
        .filter({ hasText: "Administration" })
        .first(),
    ).not.toBeVisible();

    await expect(
      page
        .locator(".desktop-nav-group-button")
        .filter({ hasText: "Payments & Outstanding" })
        .first(),
    ).not.toBeVisible();

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

    await openDesktopMenuItem(
      page,
      "Inventory",
      "Stock",
    );

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

    await openDesktopMenuItem(
      page,
      "People",
      "Customers",
    );

    await expect(
      page.getByRole("heading", {
        name: "Customers",
        exact: true,
      }),
    ).toBeVisible();
  });

  test("Staff can open Receive Stock", async ({ page }) => {
    await page.goto("/");

    await openDesktopMenuItem(
      page,
      "Inventory",
      "Receive Stock",
    );

    await expect(
      page.getByRole("heading", {
        name: "Receive Stock",
        exact: true,
      }),
    ).toBeVisible();
  });

  test("Staff can open New Sale", async ({ page }) => {
    await page.goto("/");

    await openDesktopMenuItem(
      page,
      "Sales",
      "New Sale",
    );

    await expect(
      page.getByRole("heading", {
        name: "New Sale",
        exact: true,
      }),
    ).toBeVisible();
  });

  test("Staff can receive E2E test stock", async ({
    page,
  }) => {
    const testData = await getE2ETestData();

    await page.goto("/");

    await receiveE2EStock(
      page,
      testData.productId,
      testData.locationId,
      testData,
    );
  });

  test("Staff can create an E2E multi-product sale with partial payment", async ({
  page,
}) => {
  const testData = await getE2ETestData();

  const timestamp = Date.now();

  const customerName =
    `E2E Multi Product Customer ${timestamp}`;

  const customerPhone =
    `9${String(timestamp).slice(-9)}`;

  /*
   * Step 1:
   * Give both products stock at different locations.
   *
   * Product 1 = SOF-001
   * Main Shop = location 1
   *
   * Product 3 = E2E Test Sofa
   * E2E Test Location = location 4
   */
  await page.goto("/");

  await receiveE2EStock(
    page,
    1,
    1,
    testData,
  );

  await receiveE2EStock(
    page,
    testData.productId,
    testData.locationId,
    testData,
  );

  /*
   * Step 2:
   * Open New Sale.
   */
  await openDesktopMenuItem(
    page,
    "Sales",
    "New Sale",
  );

  await expect(
    page.getByRole("heading", {
      name: "New Sale",
      exact: true,
    }),
  ).toBeVisible();

  /*
   * Step 3:
   * Create a new customer using phone-first flow.
   */
  await page.getByLabel("Phone Number").fill(
    customerPhone,
  );

  await expect(
    page.getByRole("heading", {
      name: "New Customer",
      exact: true,
    }),
  ).toBeVisible();

  await fillCustomerPopupField(
    page,
    "Customer Name",
    customerName,
    "input",
  );

  await fillCustomerPopupField(
    page,
    "Address",
    "E2E Test Address",
    "textarea",
  );

  await page.getByRole("button", {
    name: "Save Customer",
    exact: true,
  }).click();

  await expect(
    page.getByText("Customer created.", {
      exact: true,
    }),
  ).toBeVisible();

  /*
   * Step 4:
   * Verify the customer can be found by phone
   * after being saved.
   */
  await page.reload();

  await openDesktopMenuItem(
    page,
    "Sales",
    "New Sale",
  );

  await expect(
    page.getByRole("heading", {
      name: "New Sale",
      exact: true,
    }),
  ).toBeVisible();

  await page.getByLabel("Phone Number").fill(
    customerPhone,
  );

  await expect(
    page.getByText(/Existing customer:/i),
  ).toBeVisible();

  // The existing-customer message confirms the phone lookup succeeded.

  /*
   * Step 5:
   * Add SOF-001 from Main Shop.
   */
  const firstSaleProductSearch = page.locator("#sale-product-search");

  await firstSaleProductSearch.fill("SOF-001");

  await page
    .getByText(
      /SOF-001.*Malaysia Sofa Set - 4 Legs/i,
    )
    .last()
    .click();

  await page.getByLabel("Stock Location").selectOption(
    "1",
  );

  await page.getByLabel("Quantity").fill("1");

  await page.getByLabel("Selling Price").fill(
    "20000",
  );

  await page.getByRole("button", {
    name: "Add Product",
    exact: true,
  }).click();

  /*
   * Step 6:
   * Add E2E Test Sofa from E2E Test Location.
   */
  const saleProductSearch = page.locator(
    "#sale-product-search",
  );

  await saleProductSearch.fill("E2E-SOF-001");

  await page
    .getByText(
      /E2E-SOF-001.*E2E Test Sofa/i,
    )
    .last()
    .click();

  await page.getByLabel("Stock Location").selectOption(
    String(testData.locationId),
  );

  await page.getByLabel("Quantity").fill("1");

  await page.getByLabel("Selling Price").fill(
    "20000",
  );

  await page.getByRole("button", {
    name: "Add Product",
    exact: true,
  }).click();

  /*
   * Step 7:
   * Verify the combined bill.
   */
  await expect(
    page.getByText(/Malaysia Sofa Set - 4 Legs/i),
  ).toBeVisible();

  await expect(
    page.getByText(/E2E Test Sofa/i),
  ).toBeVisible();

  await expect(
    page.getByText(/Total:\s*₹40,000/i),
  ).toBeVisible();

  /*
   * Step 8:
   * Partial payment.
   */
  await page.getByLabel("Paid Now").fill("1000");

  await page.getByRole("button", {
    name: "Create Sale",
    exact: true,
  }).click();

  await expect(
    page.getByText(
      /Sale #\d+ created successfully/i,
    ),
  ).toBeVisible();

  /*
   * Step 9:
   * Printable bill should be available and
   * locations should not appear on the bill.
   */
  await expect(
    page.getByRole("button", {
      name: "Print Bill",
      exact: true,
    }),
  ).toBeVisible();

  const printableBill =
    page.locator(".printable-bill");

  await expect(printableBill).toContainText(
    "Sri Krishna Furniture And Home Appliances",
  );

  await expect(printableBill).toContainText(
    customerName,
  );

  await expect(printableBill).toContainText(
    "₹40,000",
  );

  await expect(printableBill).not.toContainText(
    "Main Shop",
  );

  await expect(printableBill).not.toContainText(
    "E2E Test Location",
  );

  /*
   * Step 10:
   * Verify the sale was stored with two items
   * and the correct source location per item.
   */
  const adminClient = await getAdminClient();

  try {
    const {
      data: customer,
      error: customerError,
    } = await adminClient
      .from("customers")
      .select("id")
      .eq("phone", customerPhone)
      .maybeSingle();

    if (customerError || !customer) {
      throw new Error(
        `Failed to find E2E customer: ${
          customerError?.message ??
          "Customer not found"
        }`,
      );
    }

    const {
      data: sale,
      error: saleError,
    } = await adminClient
      .from("sales")
      .select(
        "id, total_amount, paid_now, customer_id",
      )
      .eq("customer_id", customer.id)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (saleError || !sale) {
      throw new Error(
        `Failed to find E2E sale: ${
          saleError?.message ??
          "Sale not found"
        }`,
      );
    }

    expect(Number(sale.total_amount)).toBe(
      40000,
    );

    expect(Number(sale.paid_now)).toBe(
      1000,
    );

    const {
      data: items,
      error: itemsError,
    } = await adminClient
      .from("sale_items")
      .select(
        "product_id, location_id, quantity, selling_price",
      )
      .eq("sale_id", sale.id)
      .order("product_id");

    if (itemsError) {
      throw new Error(
        `Failed to read E2E sale items: ${itemsError.message}`,
      );
    }

    expect(items).toHaveLength(2);

    const sofItem = items?.find(
      (item) =>
        Number(item.product_id) === 1,
    );

    const e2eItem = items?.find(
      (item) =>
        Number(item.product_id) ===
        testData.productId,
    );

    expect(sofItem).toBeTruthy();
    expect(e2eItem).toBeTruthy();

    expect(
      Number(sofItem?.location_id),
    ).toBe(1);

    expect(
      Number(e2eItem?.location_id),
    ).toBe(testData.locationId);
  } finally {
    await adminClient.auth.signOut();
  }
});

test("E2E sale is reflected in Admin Customer Outstanding", async ({
  page,
  browser,
}) => {
  const testData = await getE2ETestData();

  const timestamp = Date.now();

  const customerName =
    `E2E Outstanding Customer ${timestamp}`;

  const customerPhone =
    `8${String(timestamp).slice(-9)}`;

  /*
   * Step 1:
   * Give the product one unit of stock.
   */
  await page.goto("/");

  await receiveE2EStock(
    page,
    testData.productId,
    testData.locationId,
    testData,
  );

  /*
   * Step 2:
   * Open New Sale.
   */
  await openDesktopMenuItem(
    page,
    "Sales",
    "New Sale",
  );

  await expect(
    page.getByRole("heading", {
      name: "New Sale",
      exact: true,
    }),
  ).toBeVisible();

  /*
   * Step 3:
   * Create customer.
   */
  await page.getByLabel("Phone Number").fill(
    customerPhone,
  );

  await expect(
    page.getByRole("heading", {
      name: "New Customer",
      exact: true,
    }),
  ).toBeVisible();

  await fillCustomerPopupField(
    page,
    "Customer Name",
    customerName,
    "input",
  );

  await fillCustomerPopupField(
    page,
    "Address",
    "E2E Outstanding Address",
    "textarea",
  );

  await page.getByRole("button", {
    name: "Save Customer",
    exact: true,
  }).click();

  await expect(
    page.getByText("Customer created.", {
      exact: true,
    }),
  ).toBeVisible();

  /*
   * Step 4:
   * Add one product.
   */
  const saleProductSearch = page.locator(
    "#sale-product-search",
  );

  await saleProductSearch.fill("E2E-SOF-001");

  await page
    .getByText(
      /E2E-SOF-001.*E2E Test Sofa/i,
    )
    .last()
    .click();

  await page.getByLabel("Stock Location").selectOption(
    String(testData.locationId),
  );

  await page.getByLabel("Quantity").fill("1");

  await page.getByLabel("Selling Price").fill(
    "20000",
  );

  await page.getByRole("button", {
    name: "Add Product",
    exact: true,
  }).click();

  /*
   * Step 5:
   * Create ₹20,000 sale with ₹1,000 paid.
   */
  await expect(
    page.getByText(/Total:\s*₹20,000/i),
  ).toBeVisible();

  await page.getByLabel("Paid Now").fill(
    "1000",
  );

  await page.getByRole("button", {
    name: "Create Sale",
    exact: true,
  }).click();

  await expect(
    page.getByText(
      /Sale #\d+ created successfully/i,
    ),
  ).toBeVisible();

  /*
   * Step 6:
   * Open Admin using the saved Admin auth state.
   */
  const adminContext = await browser.newContext({
    storageState:
      "playwright/.auth/admin.json",
  });

  const adminPage =
    await adminContext.newPage();

  try {
    await adminPage.goto("/");

    await openDesktopMenuItem(
      adminPage,
      "Payments & Outstanding",
      "Customer Outstanding",
    );

    await expect(
      adminPage.getByRole("heading", {
        name: "Customer Outstanding",
        exact: true,
      }),
    ).toBeVisible();

    const search = adminPage.locator(
      ".customer-outstanding-search",
    );

    await search.fill(customerName);

    const customerHeading =
      adminPage.getByRole("heading", {
        name: customerName,
        exact: true,
      });

    await expect(
      customerHeading,
    ).toBeVisible();

   const customerArticle = customerHeading.locator(
      'xpath=ancestor::article[contains(concat(" ", normalize-space(@class), " "), " balance-card ")][1]',
    );

    await expect(
      customerArticle.locator(".balance-main"),
    ).toContainText("INR 19,000");
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

    await receiveE2EStock(
      page,
      testData.productId,
      testData.locationId,
      testData,
    );

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
    await openDesktopMenuItem(
      page,
      "Inventory",
      "Stock Transfer",
    );

    await expect(
      page.getByRole("heading", {
        name: "Stock Transfer",
        exact: true,
      }),
    ).toBeVisible();

    /*
     * Step 4: Select product and locations.
     */
    const transferProductSearch = page.locator(
      "#transfer-product-search",
    );

    await transferProductSearch.fill("E2E-SOF-001");

    await page
      .getByText(
        /E2E-SOF-001.*E2E Test Sofa/i,
      )
      .last()
      .click();

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