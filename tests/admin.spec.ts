import {
  test,
  expect,
  type Page,
} from "@playwright/test";

import {
  getAdminClient,
  getE2ETestData,
} from "./e2eData";

async function getSupplierOutstanding(
  page: Page,
  supplierName: string,
): Promise<number> {
  await page.getByRole("button", {
    name: "Supplier Outstanding",
    exact: true,
  }).click();

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

  const supplierExists = await supplierHeading
    .isVisible({ timeout: 2000 })
    .catch(() => false);

  if (!supplierExists) {
    return 0;
  }

  const supplierArticle = supplierHeading.locator("..");

  const text =
    (await supplierArticle.textContent()) ?? "";

  const match = text.match(
    /Outstanding:\s*INR\s*([\d,]+(?:\.\d+)?)/i,
  );

  if (!match) {
    throw new Error(
      `Could not read outstanding for supplier "${supplierName}".`,
    );
  }

  return Number(
    match[1].replace(/,/g, ""),
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
  test("Admin can see admin navigation", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("button", {
        name: "Products",
        exact: true,
      }),
    ).toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "Pending Purchases",
        exact: true,
      }),
    ).toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "Customer Outstanding",
        exact: true,
      }),
    ).toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "Supplier Outstanding",
        exact: true,
      }),
    ).toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "Payments",
        exact: true,
      }),
    ).toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "Stock Adjustment",
        exact: true,
      }),
    ).toBeVisible();
  });

  test("Admin can open Products", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("button", {
      name: "Products",
      exact: true,
    }).click();

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

    await page.getByRole("button", {
      name: "Payments",
      exact: true,
    }).click();

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

    await page.getByRole("button", {
      name: "Customer Outstanding",
      exact: true,
    }).click();

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

    const supplierSelect =
      page.getByLabel("Supplier");

    await expect(
      supplierSelect,
    ).toBeAttached();

    await supplierSelect.selectOption(
      String(testData.supplierId),
    );

    const locationSelect =
      page.getByLabel("Location");

    await expect(
      locationSelect,
    ).toBeAttached();

    await locationSelect.selectOption(
      String(testData.locationId),
    );

    const productSelect =
      page.getByLabel("Product");

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
    await page.getByRole("button", {
      name: "Pending Purchases",
      exact: true,
    }).click();

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
      purchaseHeading.locator("..");

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
    await page.getByRole("button", {
      name: "Stock Adjustment",
      exact: true,
    }).click();

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
    await page.getByLabel("Product").selectOption(
      String(testData.productId),
    );

    await page.getByLabel("Location").selectOption(
      String(testData.locationId),
    );

    await page.getByLabel("Adjustment Type")
      .selectOption("INCREASE");

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
    await page.getByLabel("Product").selectOption(
      String(testData.productId),
    );

    await page.getByLabel("Location").selectOption(
      String(testData.locationId),
    );

    await page.getByLabel("Adjustment Type")
      .selectOption("DECREASE");

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

    await page.getByRole("button", {
      name: "Supplier Outstanding",
      exact: true,
    }).click();

    await expect(
      page.getByRole("heading", {
        name: "Supplier Outstanding",
        exact: true,
      }),
    ).toBeVisible();
  });
});