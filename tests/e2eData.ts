import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

const supabaseUrl =
  process.env.E2E_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;

const supabaseKey =
  process.env.E2E_SUPABASE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing E2E_SUPABASE_URL/E2E_SUPABASE_KEY or VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY"
  );
}

if (!adminEmail || !adminPassword) {
  throw new Error(
    "Missing E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD"
  );
}

export type E2ETestData = {
  categoryId: number;
  locationId: number;
  supplierId: number;
  productId: number;
  customerId: number;
};

async function getAdminClient(): Promise<SupabaseClient> {
  const client = createClient(
    supabaseUrl!,
    supabaseKey!
  );

  const { error } = await client.auth.signInWithPassword({
    email: adminEmail!,
    password: adminPassword!,
  });

  if (error) {
    throw new Error(
      `E2E admin login failed: ${error.message}`
    );
  }

  return client;
}

async function getOrCreate(
  client: SupabaseClient,
  table: string,
  name: string,
  insertData: Record<string, unknown>
): Promise<number> {
  const { data: existing, error: selectError } =
    await client
      .from(table)
      .select("id")
      .eq("name", name)
      .maybeSingle();

  if (selectError) {
    throw new Error(
      `Failed to find ${table}: ${selectError.message}`
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
      `Failed to create ${table}: ${
        error?.message ?? "No data returned"
      }`
    );
  }

  return Number(data.id);
}

export async function getE2ETestData(): Promise<E2ETestData> {
  const client = await getAdminClient();

  const categoryId = await getOrCreate(
    client,
    "categories",
    "E2E Test Category",
    {
      name: "E2E Test Category",
      is_active: true,
    }
  );

  const locationId = await getOrCreate(
    client,
    "locations",
    "E2E Test Location",
    {
      name: "E2E Test Location",
      is_active: true,
    }
  );

  const supplierId = await getOrCreate(
    client,
    "suppliers",
    "E2E Test Supplier",
    {
      name: "E2E Test Supplier",
      phone: "9999999999",
      address: "E2E Test Address",
      is_active: true,
    }
  );

  const { data: existingProduct, error: productLookupError } =
    await client
      .from("products")
      .select("id")
      .eq("sku", "E2E-SOF-001")
      .maybeSingle();

  if (productLookupError) {
    throw new Error(
      `Failed to find E2E product: ${productLookupError.message}`
    );
  }

  let productId: number;

  if (existingProduct) {
    productId = Number(existingProduct.id);
  } else {
    const { data, error } = await client
      .from("products")
      .insert({
        sku: "E2E-SOF-001",
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
        }`
      );
    }

    productId = Number(data.id);
  }

  const customerId = await getOrCreate(
    client,
    "customers",
    "E2E Test Customer",
    {
      name: "E2E Test Customer",
      phone: "9888888888",
      customer_type: "INDIVIDUAL",
      is_active: true,
    }
  );

  await client.auth.signOut();

  return {
    categoryId,
    locationId,
    supplierId,
    productId,
    customerId,
  };
}