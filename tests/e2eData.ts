import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

const supabaseUrl =
  process.env.E2E_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;

const supabaseKey =
  process.env.E2E_SUPABASE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase environment variables for E2E test data.",
  );
}

if (!adminEmail || !adminPassword) {
  throw new Error(
    "E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required.",
  );
}

export type E2ETestData = {
  categoryId: number;
  locationId: number;
  supplierId: number;
  productId: number;
  customerId: number;
};

export async function getAdminClient(): Promise<SupabaseClient> {
  const client = createClient(
    supabaseUrl!,
    supabaseKey!,
  );

  const { error } =
    await client.auth.signInWithPassword({
      email: adminEmail!,
      password: adminPassword!,
    });

  if (error) {
    throw new Error(
      `E2E admin login failed: ${error.message}`,
    );
  }

  return client;
}

async function getOrCreateByName(
  client: SupabaseClient,
  table: string,
  name: string,
  insertData: Record<string, unknown>,
): Promise<number> {
  const { data: existing, error: lookupError } =
    await client
      .from(table)
      .select("id")
      .eq("name", name)
      .maybeSingle();

  if (lookupError) {
    throw new Error(
      `Failed to find ${table} '${name}': ${lookupError.message}`,
    );
  }

  if (existing) {
    return Number(existing.id);
  }

  const { data, error } = await client
    .from(table)
    .insert(insertData)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create ${table} '${name}': ${
        error?.message ?? "No data returned"
      }`,
    );
  }

  return Number(data.id);
}

async function getOrCreateProduct(
  client: SupabaseClient,
  categoryId: number,
): Promise<number> {
  const sku = "E2E-SOF-001";

  const { data: existing, error: lookupError } =
    await client
      .from("products")
      .select("id")
      .eq("sku", sku)
      .maybeSingle();

  if (lookupError) {
    throw new Error(
      `Failed to find E2E product: ${lookupError.message}`,
    );
  }

  if (existing) {
    return Number(existing.id);
  }

  const { data, error } = await client
    .from("products")
    .insert({
      sku,
      name: "E2E Test Sofa",
      category_id: categoryId,
      default_selling_price: 20000,
      unit: "PCS",
      is_active: true,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create E2E product: ${
        error?.message ?? "No data returned"
      }`,
    );
  }

  return Number(data.id);
}

export async function getE2ETestData(): Promise<E2ETestData> {
  const client = await getAdminClient();

  try {
    const categoryId = await getOrCreateByName(
      client,
      "categories",
      "E2E Test Category",
      {
        name: "E2E Test Category",
        is_active: true,
      },
    );

    const locationId = await getOrCreateByName(
      client,
      "locations",
      "E2E Test Location",
      {
        name: "E2E Test Location",
        is_active: true,
      },
    );

    const supplierId = await getOrCreateByName(
      client,
      "suppliers",
      "E2E Test Supplier",
      {
        name: "E2E Test Supplier",
        phone: "9999999999",
        address: "E2E Test Address",
        is_active: true,
      },
    );

    const productId = await getOrCreateProduct(
      client,
      categoryId,
    );

    const customerId = await getOrCreateByName(
      client,
      "customers",
      "E2E Test Customer",
      {
        name: "E2E Test Customer",
        phone: "9888888888",
        customer_type: "INDIVIDUAL",
        is_active: true,
      },
    );

    return {
      categoryId,
      locationId,
      supplierId,
      productId,
      customerId,
    };
  } finally {
    await client.auth.signOut();
  }
}