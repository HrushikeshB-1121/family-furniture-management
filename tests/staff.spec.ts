import {
  test,
  expect,
  type Page,
} from "@playwright/test";

import {
  getAdminClient,
  getE2ETestData,
} from "./e2eData";

async function receiveE2EStock(
  page: Page,
  productId: number,
  locationId: number,
  testData: Awaited<
    ReturnType<typeof getE2ETestData>
  >,
) {
  await page
    .getByRole("navigation")
    .getByRole("button", {
      name: "Receive Stock",
      exact: true,
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "Receive Stock",
      exact: true,
    }),
  ).toBeVisible();

  await page
    .getByLabel("Supplier")
    .selectOption(
      String(testData.supplierId),
    );

  await page
    .getByLabel("Location")
    .selectOption(
      String(locationId),
    );

  await page
    .getByLabel("Product")
    .selectOption(
      String(productId),
    );

  await page
    .getByLabel("Quantity")
    .fill("1");

  await page
    .locator("form")
    .getByRole("button", {
      name: "Receive Stock",
      exact: true,
    })
    .click();

  await expect(
    page.getByText(
      /received successfully/i,
    ),
  ).toBeVisible();
}

async function getStock(
  productId: number,
  locationId: number,
) {
  const client = await getAdminClient();

  try {
    const {
      data,
      error,
    } = await client
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

    return Number(
      data?.quantity ?? 0,
    );
  } finally {
    await client.auth.signOut();
  }
}

async function createE2ECustomer(
  page: Page,
  name: string,
  phone: string,
  address: string,
) {
  await page
    .getByLabel("Phone Number")
    .fill(phone);

  await expect(
    page.getByRole("heading", {
      name: "New Customer",
      exact: true,
    }),
  ).toBeVisible();

  const customerSection =
    page
      .getByRole("heading", {
        name: "New Customer",
        exact: true,
      })
      .locator("..");

  const inputs =
    customerSection.locator("input");

  await expect(inputs).toHaveCount(2);

  await inputs
    .nth(0)
    .fill(name);

  await inputs
    .nth(1)
    .fill(address);

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
   * After creation, the customer is selected.
   * Verify the selected-customer section rather than
   * looking for the bare name text.
   */
  const selectedCustomerSection =
    page
      .locator(".sales-section")
      .filter({
        hasText: `Name: ${name}`,
      })
      .first();

  await expect(
    selectedCustomerSection,
  ).toBeVisible({
    timeout: 10000,
  });
}

test.describe("Staff", () => {
  test("Staff can see staff navigation", async ({
    page,
  }) => {
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

  test("Staff cannot see admin navigation", async ({
    page,
  }) => {
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

  test("Staff can open Stock", async ({
    page,
  }) => {
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

  test("Staff can open Customers", async ({
    page,
  }) => {
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

  test("Staff can open Receive Stock", async ({
    page,
  }) => {
    await page.goto("/");

    await page
      .getByRole("navigation")
      .getByRole("button", {
        name: "Receive Stock",
        exact: true,
      })
      .click();

    await expect(
      page.getByRole("heading", {
        name: "Receive Stock",
        exact: true,
      }),
    ).toBeVisible();
  });

  test("Staff can open New Sale", async ({
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
      }),
    ).toBeVisible();
  });

  test("Staff can receive E2E test stock", async ({
    page,
  }) => {
    const testData =
      await getE2ETestData();

    await page.goto("/");

    await receiveE2EStock(
      page,
      testData.productId,
      testData.locationId,
      testData,
    );
  });

  test(
    "Staff can create an E2E multi-product sale with partial payment",
    async ({ page }) => {
      const testData =
        await getE2ETestData();

      const timestamp =
        Date.now();

      const customerName =
        `E2E Multi Product Customer ${timestamp}`;

      const customerPhone =
        `9${String(timestamp).slice(-9)}`;

      /*
       * Step 1:
       * Give SOF-001 stock at Main Shop.
       */
      await page.goto("/");

      await receiveE2EStock(
        page,
        1,
        1,
        testData,
      );

      /*
       * Give E2E product stock at E2E Test Location.
       */
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
       * Step 3:
       * Create a customer.
       */
      await createE2ECustomer(
        page,
        customerName,
        customerPhone,
        "E2E Test Address",
      );

      /*
       * Step 4:
       * Leave the current sale screen and reopen it.
       * Then verify phone lookup finds the saved customer.
       */
      await page.getByRole("button", {
        name: "Stock",
        exact: true,
      }).click();

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

      await page
        .getByLabel("Phone Number")
        .fill(customerPhone);

      await expect(
        page.getByText(
          /Existing customer:/i,
        ),
      ).toBeVisible({
        timeout: 10000,
      });

      const existingCustomerSection =
        page
          .locator(".sales-section")
          .filter({
            hasText: `Name: ${customerName}`,
          })
          .first();

      await expect(
        existingCustomerSection,
      ).toBeVisible({
        timeout: 10000,
      });

      /*
       * Step 5:
       * Add SOF-001 from Main Shop.
       */
      await page
        .getByLabel("Product")
        .selectOption("1");

      await page
        .getByLabel("Stock Location")
        .selectOption("1");

      await page
        .getByLabel("Quantity")
        .fill("1");

      await page
        .getByLabel("Selling Price")
        .fill("20000");

      await page.getByRole("button", {
        name: "Add Product",
        exact: true,
      }).click();

      /*
       * Step 6:
       * Add E2E Test Sofa from E2E Test Location.
       */
      await page
        .getByLabel("Product")
        .selectOption(
          String(
            testData.productId,
          ),
        );

      await page
        .getByLabel("Stock Location")
        .selectOption(
          String(
            testData.locationId,
          ),
        );

      await page
        .getByLabel("Quantity")
        .fill("1");

      await page
        .getByLabel("Selling Price")
        .fill("20000");

      await page.getByRole("button", {
        name: "Add Product",
        exact: true,
      }).click();

      /*
       * Step 7:
       * Verify the cart itself.
       *
       * Scope product assertions to the cart table so
       * the <option> text cannot cause strict-mode errors.
       */
      const cart =
        page.locator(".sales-cart");

      await expect(
        cart,
      ).toBeVisible();

      await expect(
        cart.getByRole("cell", {
          name: /SOF-001 Malaysia Sofa Set - 4 Legs/i,
        }),
      ).toBeVisible();

      await expect(
        cart.getByRole("cell", {
          name: /E2E-SOF-001 E2E Test Sofa/i,
        }),
      ).toBeVisible();

      await expect(
        page.getByText(
          /Total:\s*₹40,000/i,
        ),
      ).toBeVisible();

      await expect(
        page.getByText(
          /Due:\s*₹40,000/i,
        ),
      ).toBeVisible();

      /*
       * Step 8:
       * Partial payment.
       */
      await page
        .getByLabel("Paid Now")
        .fill("1000");

      await expect(
        page.getByText(
          /Due:\s*₹39,000/i,
        ),
      ).toBeVisible();

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
       * Verify printable bill.
       */
      await expect(
        page.getByRole("button", {
          name: "Print Bill",
          exact: true,
        }),
      ).toBeVisible();

      const printableBill =
        page.locator(
          ".printable-bill",
        );

      await expect(
        printableBill,
      ).toContainText(
        "Sri Krishna Furniture And Home Appliances",
      );

      await expect(
        printableBill,
      ).toContainText(
        customerName,
      );

      await expect(
        printableBill,
      ).toContainText(
        "₹40,000",
      );

      await expect(
        printableBill,
      ).toContainText(
        "₹1,000",
      );

      await expect(
        printableBill,
      ).toContainText(
        "₹39,000",
      );

      /*
       * Location is internal stock data and should
       * not appear on the customer bill.
       */
      await expect(
        printableBill,
      ).not.toContainText(
        "Main Shop",
      );

      await expect(
        printableBill,
      ).not.toContainText(
        "E2E Test Location",
      );

      /*
       * Cost/profit must not appear on the customer bill.
       */
      await expect(
        printableBill,
      ).not.toContainText(
        /unit cost|total cost|gross profit|purchase cost/i,
      );

      /*
       * Step 10:
       * Verify the sale was stored correctly in DB.
       */
      const adminClient =
        await getAdminClient();

      try {
        const {
          data: customer,
          error: customerError,
        } = await adminClient
          .from("customers")
          .select("id")
          .eq(
            "phone",
            customerPhone,
          )
          .maybeSingle();

        if (
          customerError ||
          !customer
        ) {
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
          .eq(
            "customer_id",
            customer.id,
          )
          .order(
            "created_at",
            {
              ascending: false,
            },
          )
          .limit(1)
          .maybeSingle();

        if (
          saleError ||
          !sale
        ) {
          throw new Error(
            `Failed to find E2E sale: ${
              saleError?.message ??
              "Sale not found"
            }`,
          );
        }

        expect(
          Number(
            sale.total_amount,
          ),
        ).toBe(40000);

        expect(
          Number(
            sale.paid_now,
          ),
        ).toBe(1000);

        const {
          data: items,
          error: itemsError,
        } = await adminClient
          .from("sale_items")
          .select(
            "product_id, location_id, quantity, selling_price",
          )
          .eq(
            "sale_id",
            sale.id,
          )
          .order(
            "product_id",
          );

        if (itemsError) {
          throw new Error(
            `Failed to read E2E sale items: ${itemsError.message}`,
          );
        }

        expect(
          items,
        ).toHaveLength(2);

        const sofItem =
          items?.find(
            (item) =>
              Number(
                item.product_id,
              ) === 1,
          );

        const e2eItem =
          items?.find(
            (item) =>
              Number(
                item.product_id,
              ) ===
              testData.productId,
          );

        expect(
          sofItem,
        ).toBeTruthy();

        expect(
          e2eItem,
        ).toBeTruthy();

        expect(
          Number(
            sofItem?.location_id,
          ),
        ).toBe(1);

        expect(
          Number(
            e2eItem?.location_id,
          ),
        ).toBe(
          testData.locationId,
        );

        expect(
          Number(
            sofItem?.quantity,
          ),
        ).toBe(1);

        expect(
          Number(
            e2eItem?.quantity,
          ),
        ).toBe(1);
      } finally {
        await adminClient.auth.signOut();
      }
    },
  );

  test(
    "E2E sale is reflected in Admin Customer Outstanding",
    async ({
      page,
      browser,
    }) => {
      const testData =
        await getE2ETestData();

      const timestamp =
        Date.now();

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
       * Step 3:
       * Create customer.
       */
      await createE2ECustomer(
        page,
        customerName,
        customerPhone,
        "E2E Outstanding Address",
      );

      /*
       * Step 4:
       * Add one product.
       */
      await page
        .getByLabel("Product")
        .selectOption(
          String(
            testData.productId,
          ),
        );

      await page
        .getByLabel("Stock Location")
        .selectOption(
          String(
            testData.locationId,
          ),
        );

      await page
        .getByLabel("Quantity")
        .fill("1");

      await page
        .getByLabel("Selling Price")
        .fill("20000");

      await page.getByRole("button", {
        name: "Add Product",
        exact: true,
      }).click();

      /*
       * Step 5:
       * Create ₹20,000 sale with ₹1,000 paid.
       */
      await expect(
        page.getByText(
          /Total:\s*₹20,000/i,
        ),
      ).toBeVisible();

      await page
        .getByLabel("Paid Now")
        .fill("1000");

      await expect(
        page.getByText(
          /Due:\s*₹19,000/i,
        ),
      ).toBeVisible();

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
       * Open Admin using the saved Admin state.
       */
      const adminContext =
        await browser.newContext({
          storageState:
            "playwright/.auth/admin.json",
        });

      const adminPage =
        await adminContext.newPage();

      try {
        await adminPage.goto("/");

        await adminPage
          .getByRole("button", {
            name: "Customer Outstanding",
            exact: true,
          })
          .click();

        await expect(
          adminPage.getByRole(
            "heading",
            {
              name: "Customer Outstanding",
              exact: true,
            },
          ),
        ).toBeVisible({
          timeout: 10000,
        });

        /*
         * No search box is assumed here.
         * The customer name is unique for this test.
         */
        const customerHeading =
          adminPage.getByRole(
            "heading",
            {
              name: customerName,
              exact: true,
            },
          );

        await expect(
          customerHeading,
        ).toBeVisible({
          timeout: 10000,
        });

        const customerArticle =
          customerHeading.locator(
            "..",
          );

        await expect(
          customerArticle,
        ).toContainText(
          "Outstanding: INR 19,000",
        );
      } finally {
        await adminContext
          .close()
          .catch(() => undefined);
      }
    },
  );

  test(
    "Staff can transfer E2E stock between locations",
    async ({ page }) => {
      const testData =
        await getE2ETestData();

      const destinationLocationId =
        1;

      await page.goto("/");

      await receiveE2EStock(
        page,
        testData.productId,
        testData.locationId,
        testData,
      );

      const sourceBefore =
        await getStock(
          testData.productId,
          testData.locationId,
        );

      const destinationBefore =
        await getStock(
          testData.productId,
          destinationLocationId,
        );

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

      await page
        .getByLabel("Product")
        .selectOption(
          String(
            testData.productId,
          ),
        );

      await page
        .getByLabel("From Location")
        .selectOption(
          String(
            testData.locationId,
          ),
        );

      await page
        .getByLabel("To Location")
        .selectOption(
          String(
            destinationLocationId,
          ),
        );

      await page
        .getByLabel("Quantity")
        .fill("1");

      await page
        .getByLabel("Notes")
        .fill(
          "E2E stock transfer",
        );

      await page.getByRole("button", {
        name: "Transfer Stock",
        exact: true,
      }).click();

      await expect(
        page.getByText(
          /stock transferred successfully/i,
        ),
      ).toBeVisible();

      const sourceAfter =
        await getStock(
          testData.productId,
          testData.locationId,
        );

      const destinationAfter =
        await getStock(
          testData.productId,
          destinationLocationId,
        );

      expect(
        sourceAfter,
      ).toBe(
        sourceBefore - 1,
      );

      expect(
        destinationAfter,
      ).toBe(
        destinationBefore + 1,
      );
    },
  );
});