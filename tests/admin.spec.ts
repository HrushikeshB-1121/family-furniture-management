import {
  test,
  expect,
  type Page,
} from "@playwright/test";

import {
  getAdminClient,
  getE2ETestData,
} from "./e2eData";

async function openDesktopMenuItem(
  page: Page,
  groupLabel: string,
  itemLabel: string,
) {
  // Some frequently used admin pages (for example Pending Purchases)
  // may be exposed as a direct desktop button instead of a dropdown item.
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

async function getSupplierOutstanding(
  page: Page,
  supplierName: string,
): Promise<number> {
  await openDesktopMenuItem(
    page,
    "Payments & Outstanding",
    "Supplier Outstanding",
  );

  await expect(
    page.getByRole("heading", {
      name: "Supplier Outstanding",
      exact: true,
    }),
  ).toBeVisible();

  const search = page.getByPlaceholder(
    "Search supplier, phone or address",
  );

  await search.fill(supplierName);

  const supplierHeading = page.getByRole("heading", {
    name: supplierName,
    exact: true,
  });

  await expect(supplierHeading).toBeVisible();

  /*
   * Do not depend on a specific card class.
   * Find the nearest ancestor that contains the
   * supplier's "Outstanding" section.
   */
  const supplierCard = supplierHeading.locator(
    'xpath=ancestor::*[contains(normalize-space(.), "Outstanding")][1]',
  );

  await expect(supplierCard).toBeVisible();

  const supplierText =
    (await supplierCard.innerText()) ?? "";

  const balanceMatch = supplierText.match(
    /Outstanding\s*:?\s*(?:INR|₹)\s*([\d,]+(?:\.\d+)?)/i,
  );

  if (!balanceMatch) {
    throw new Error(
      `Could not read outstanding for supplier "${supplierName}". Text: ${supplierText}`,
    );
  }

  return Number(
    balanceMatch[1].replace(/,/g, ""),
  );
}

async function findLatestE2EPendingPurchase(
  supplierId: number,
  locationId: number,
  productId: number,
): Promise<number> {
  const client = await getAdminClient();

  try {
    const {
      data,
      error,
    } = await client
      .from("purchases")
      .select(`
        id,
        purchase_date,
        supplier_id,
        location_id,
        status,
        purchase_items!inner (
          product_id
        )
      `)
      .eq("supplier_id", supplierId)
      .eq("location_id", locationId)
      .eq("status", "PENDING")
      .eq(
        "purchase_items.product_id",
        productId,
      )
      .order("purchase_date", {
        ascending: false,
      })
      .limit(1);

    if (error) {
      throw new Error(
        `Failed to find E2E pending purchase: ${error.message}`,
      );
    }

    const purchase = data?.[0];

    if (!purchase) {
      throw new Error(
        "No E2E pending purchase was found.",
      );
    }

    return Number(purchase.id);
  } finally {
    await client.auth.signOut();
  }
}

async function getPurchaseStatus(
  purchaseId: number,
): Promise<string | null> {
  const client = await getAdminClient();

  try {
    const {
      data,
      error,
    } = await client
      .from("purchases")
      .select("status")
      .eq("id", purchaseId)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to read purchase status: ${error.message}`,
      );
    }

    return data?.status ?? null;
  } finally {
    await client.auth.signOut();
  }
}

async function getLatestSaleId(): Promise<number> {
  const client = await getAdminClient();

  try {
    const { data, error } = await client
      .from("sales")
      .select("id")
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to find latest sale: ${error.message}`,
      );
    }

    if (!data) {
      throw new Error("No sale was found.");
    }

    return Number(data.id);
  } finally {
    await client.auth.signOut();
  }
}

async function setAdjustmentType(
  page: Page,
  type: "INCREASE" | "DECREASE",
) {
  const label = type === "INCREASE" ? "Increase" : "Decrease";

  const radioCandidates = [
    page.locator(`input[type="radio"][value="${type}"]`).first(),
    page.locator(`input[name*="adjustment" i][value="${type}"]`).first(),
  ];

  for (const radio of radioCandidates) {
    if (await radio.count() > 0) {
      try {
        await radio.check({ force: true });
        return;
      } catch {
        await radio.evaluate((element) => {
          (element as HTMLInputElement).click();
        });
        return;
      }
    }
  }

  const button = page
    .getByRole("button", { name: new RegExp(label, "i") })
    .first();

  if (await button.count() > 0 && await button.isVisible().catch(() => false)) {
    await button.click();
    return;
  }

  const labelElement = page
    .locator("label")
    .filter({ hasText: label })
    .first();

  if (await labelElement.count() > 0 && await labelElement.isVisible().catch(() => false)) {
    await labelElement.click();
    return;
  }

  const textControl = page
    .getByText(label, { exact: true })
    .first();

  if (await textControl.count() > 0 && await textControl.isVisible().catch(() => false)) {
    await textControl.click();
    return;
  }

  throw new Error(`Could not select adjustment type ${type}.`);
}

async function findAdjustmentByReason(
  reason: string,
) {
  const client = await getAdminClient();

  try {
    const {
      data,
      error,
    } = await client
      .from("stock_adjustments")
      .select(
        "id, product_id, location_id, quantity, reason, notes",
      )
      .eq("reason", reason)
      .order("id", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to find stock adjustment: ${error.message}`,
      );
    }

    if (!data) {
      throw new Error(
        `No stock adjustment found for reason "${reason}".`,
      );
    }

    return data;
  } finally {
    await client.auth.signOut();
  }
}

test.describe("Admin", () => {
  test("Admin can manage supplier details and status", async ({ page }) => {
    const suffix = Date.now();
    const supplierName = `E2E Supplier ${suffix}`;
    await page.goto("/");
    await openDesktopMenuItem(page, "People", "Suppliers");
    await expect(page.getByRole("heading", { name: "Suppliers", exact: true })).toBeVisible();

    await page.getByLabel("Supplier Name").fill(supplierName);
    await page.getByLabel("Phone").fill("9777000001");
    await page.getByLabel("Address").fill("E2E Supplier Address");
    await page.getByRole("button", { name: "Add Supplier", exact: true }).click();
    await expect(page.getByText("Supplier added successfully.")).toBeVisible();

    const row = page.getByRole("row").filter({ hasText: supplierName });
    await expect(row).toContainText("Active");
    await row.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Supplier Name").fill(`${supplierName} Updated`);
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Supplier updated successfully.")).toBeVisible();

    const updatedRow = page.getByRole("row").filter({ hasText: `${supplierName} Updated` });
    await updatedRow.getByRole("button", { name: "Deactivate" }).click();
    await expect(page.getByText("Supplier deactivated. Existing purchases and transactions are preserved.")).toBeVisible();
    await expect(updatedRow).toContainText("Inactive");
    await updatedRow.getByRole("button", { name: "Reactivate" }).click();
    await expect(page.getByText("Supplier reactivated.")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: `${supplierName} Updated` })).toContainText("Active");
  });

  test("Admin can see admin navigation", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page
        .locator(".desktop-nav-group-button")
        .filter({ hasText: "Administration" })
        .first(),
    ).toBeVisible();

    await expect(
      page
        .locator(".desktop-nav-group-button")
        .filter({ hasText: "Payments & Outstanding" })
        .first(),
    ).toBeVisible();

    await openDesktopMenuItem(
      page,
      "Administration",
      "Products",
    );

    await expect(
      page.getByRole("heading", {
        name: "Products",
        exact: true,
      }),
    ).toBeVisible();

    await openDesktopMenuItem(
      page,
      "Administration",
      "Pending Purchases",
    );

    await expect(
      page.getByRole("heading", {
        name: "Pending Purchases",
        exact: true,
      }),
    ).toBeVisible();

    await openDesktopMenuItem(
      page,
      "Payments & Outstanding",
      "Customer Outstanding",
    );

    await expect(
      page.getByRole("heading", {
        name: "Customer Outstanding",
        exact: true,
      }),
    ).toBeVisible();
  });

  test("Admin can open Products", async ({
    page,
  }) => {
    await page.goto("/");

    await openDesktopMenuItem(
      page,
      "Administration",
      "Products",
    );

    await expect(
      page.getByRole("heading", {
        name: "Products",
        exact: true,
      }),
    ).toBeVisible();
  });

  test("Admin can open Payments", async ({
    page,
  }) => {
    await page.goto("/");

    await openDesktopMenuItem(
      page,
      "Payments & Outstanding",
      "Payments",
    );

    await expect(
      page.getByRole("heading", {
        name: "Payments",
        exact: true,
      }),
    ).toBeVisible();
  });

  test("Admin can open Customer Outstanding", async ({
    page,
  }) => {
    await page.goto("/");

    await openDesktopMenuItem(
      page,
      "Payments & Outstanding",
      "Customer Outstanding",
    );

    await expect(
      page.getByRole("heading", {
        name: "Customer Outstanding",
        exact: true,
      }),
    ).toBeVisible();
  });

  test("Admin can receive and confirm E2E purchase", async ({
    page,
  }) => {
    const testData = await getE2ETestData();
    const supplierName = "E2E Test Supplier";

    /*
     * Step 1:
     * Record the supplier's current outstanding.
     */
    await page.goto("/");

    const outstandingBefore =
      await getSupplierOutstanding(
        page,
        supplierName,
      );

    /*
     * Step 2:
     * Receive one E2E product.
     */
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

    const supplierSearch =
      page.locator("#supplier-search");

    await supplierSearch.fill(
      "E2E Test Supplier",
    );

    await page
      .getByText("E2E Test Supplier", {
        exact: true,
      })
      .last()
      .click();

    const locationSelect =
      page.getByLabel("Location");

    await expect(
      locationSelect,
    ).toBeAttached();

    await locationSelect.selectOption(
      String(testData.locationId),
    );

    const productSearch =
      page.locator("#product-search");

    await productSearch.fill(
      "E2E-SOF-001",
    );

    await page
      .getByText(
        /E2E-SOF-001.*E2E Test Sofa/i,
      )
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

    /*
     * Step 3:
     * Find the exact pending purchase created by
     * this stock-receive operation.
     */
    const purchaseId =
      await findLatestE2EPendingPurchase(
        testData.supplierId,
        testData.locationId,
        testData.productId,
      );

    /*
     * Step 4:
     * Open Pending Purchases.
     */
    await openDesktopMenuItem(
      page,
      "Administration",
      "Pending Purchases",
    );

    await expect(
      page.getByRole("heading", {
        name: "Pending Purchases",
        exact: true,
      }),
    ).toBeVisible();

    const purchaseHeading =
      page.getByRole("heading", {
        name: `Purchase #${purchaseId}`,
        exact: true,
      });

    await expect(
      purchaseHeading,
    ).toBeVisible();

    const purchaseContainer =
    purchaseHeading.locator(
      'xpath=ancestor::*[.//button[normalize-space()="Confirm Purchase"]][1]',
    );

    /*
     * Step 5:
     * Unit Cost = ₹6,500
     * Paid Now  = ₹1,000
     */
    const purchaseNumberInputs =
      purchaseContainer.locator(
        'input[type="number"]',
      );

    await expect(
      purchaseNumberInputs,
    ).toHaveCount(2);

    await purchaseNumberInputs
      .nth(0)
      .fill("6500");

    await purchaseNumberInputs
      .nth(1)
      .fill("1000");

    const paymentSelect =
      purchaseContainer.locator("select");

    await expect(
      paymentSelect,
    ).toHaveCount(1);

    await paymentSelect.selectOption("CASH");

    /*
     * Step 6:
     * Confirm this exact purchase.
     */
    await purchaseContainer
      .getByRole("button", {
        name: "Confirm Purchase",
        exact: true,
      })
      .click();

    /*
     * Step 7:
     * Verify the database state directly.
     */
    await expect
      .poll(
        async () =>
          getPurchaseStatus(purchaseId),
        {
          timeout: 10000,
          intervals: [250, 500, 1000],
        },
      )
      .toBe("CONFIRMED");

    /*
     * Step 8:
     * Verify supplier outstanding.
     *
     * Purchase = ₹6,500
     * Paid     = ₹1,000
     * Due      = ₹5,500
     */
    await page.reload();

    const outstandingAfter =
      await getSupplierOutstanding(
        page,
        supplierName,
      );

    expect(outstandingAfter).toBe(
      outstandingBefore + 5500,
    );
  });

  test("Admin can perform E2E stock adjustments", async ({
    page,
  }) => {
    const testData = await getE2ETestData();
    const timestamp = Date.now();

    const increaseReason =
      `E2E adjustment increase ${timestamp}`;

    const decreaseReason =
      `E2E adjustment decrease ${timestamp}`;

    await page.goto("/");

    /*
     * Step 1:
     * Open Stock Adjustment.
     */
    await openDesktopMenuItem(
      page,
      "Inventory",
      "Stock Adjustment",
    );

    await expect(
      page.getByRole("heading", {
        name: "Stock Adjustment",
        exact: true,
      }),
    ).toBeVisible();

    /*
     * Step 2:
     * Increase stock by 1.
     */
    const productSearch =
      page.locator(
        "#adjustment-product-search",
      );

    await productSearch.fill(
      "E2E-SOF-001",
    );

    await page
      .getByText(
        /E2E-SOF-001.*E2E Test Sofa/i,
      )
      .last()
      .click();

    await page.getByLabel("Location").selectOption(
      String(testData.locationId),
    );

    await setAdjustmentType(page, "INCREASE");

    await page.getByLabel("Quantity").fill("1");

    await page.getByLabel("Reason").fill(
      increaseReason,
    );

    await page.getByLabel("Notes").fill(
      "E2E stock increase",
    );

    await page.getByRole("button", {
      name: "Adjust Stock",
      exact: true,
    }).click();

    await expect(
      page.getByText(
        /stock adjustment completed successfully/i,
      ),
    ).toBeVisible();

    const increaseAdjustment =
      await findAdjustmentByReason(
        increaseReason,
      );

    expect(
      Number(increaseAdjustment.product_id),
    ).toBe(testData.productId);

    expect(
      Number(increaseAdjustment.location_id),
    ).toBe(testData.locationId);

    expect(
      Number(increaseAdjustment.quantity),
    ).toBe(1);

    /*
     * Step 3:
     * Decrease stock by 1.
     */
    const decreaseProductSearch =
      page.locator(
        "#adjustment-product-search",
      );

    await decreaseProductSearch.fill(
      "E2E-SOF-001",
    );

    await page
      .getByText(
        /E2E-SOF-001.*E2E Test Sofa/i,
      )
      .last()
      .click();

    await page.getByLabel("Location").selectOption(
      String(testData.locationId),
    );

    await setAdjustmentType(page, "DECREASE");

    await page.getByLabel("Quantity").fill("1");

    await page.getByLabel("Reason").fill(
      decreaseReason,
    );

    await page.getByLabel("Notes").fill(
      "E2E stock decrease",
    );

    await page.getByRole("button", {
      name: "Adjust Stock",
      exact: true,
    }).click();

    await expect(
      page.getByText(
        /stock adjustment completed successfully/i,
      ),
    ).toBeVisible();

    const decreaseAdjustment =
      await findAdjustmentByReason(
        decreaseReason,
      );

    expect(
      Number(decreaseAdjustment.product_id),
    ).toBe(testData.productId);

    expect(
      Number(decreaseAdjustment.location_id),
    ).toBe(testData.locationId);

    expect(
      Number(decreaseAdjustment.quantity),
    ).toBe(-1);
  });

  test("Admin can open Supplier Outstanding", async ({
    page,
  }) => {
    await page.goto("/");

    await openDesktopMenuItem(
      page,
      "Payments & Outstanding",
      "Supplier Outstanding",
    );

    await expect(
      page.getByRole("heading", {
        name: "Supplier Outstanding",
        exact: true,
      }),
    ).toBeVisible();
  });

  test("Admin can view Sales History", async ({
  page,
}) => {
  const saleId = await getLatestSaleId();

  await page.goto("/");

  await openDesktopMenuItem(
    page,
    "Sales",
    "Sales History",
  );

  await expect(
    page.getByRole("heading", {
      name: "Sales History",
      exact: true,
    }),
  ).toBeVisible();

  const search = page.locator(
    'input[type="text"][placeholder*="Search" i]',
  ).first();

  await expect(search).toBeVisible();

  await search.fill(String(saleId));

  const saleHeading = page.getByRole("heading", {
    name: `Sale #${saleId}`,
    exact: true,
  });

  await expect(saleHeading).toBeVisible();

  const saleArticle = saleHeading.locator(
    'xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " sale-card ")][1]',
  );

// The current Sales History UI renders these labels without a colon
// (for example `Total₹20,000`). Keep the check format-tolerant.
await expect(saleArticle).toContainText(/Total\s*₹/);
await expect(saleArticle).toContainText(/Paid\s*₹/);
await expect(saleArticle).toContainText(/Due\s*₹/);

  await expect(saleArticle).toContainText("Total Cost");
  await expect(saleArticle).toContainText("Gross Profit");
  });
});
