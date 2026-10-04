-- Snapshot the product's configured default purchase cost on new sale items.
-- Existing sale rows are intentionally left untouched because their historical
-- cost cannot be reconstructed safely from this repository's available schema.

-- Add uniquely named RPC entry points so PostgREST never has to choose among
-- overloaded legacy function names. These delegate all business logic to the
-- existing timestamp-aware implementations; the existing functions remain
-- intact.
create or replace function public.receive_stock_with_date(
  p_supplier_id bigint,
  p_location_id bigint,
  p_product_id bigint,
  p_quantity numeric,
  p_invoice_number text,
  p_notes text,
  p_purchase_date timestamp with time zone
)
returns bigint
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.receive_stock(
    p_supplier_id, p_location_id, p_product_id, p_quantity,
    p_invoice_number, p_notes, p_purchase_date
  );
$$;

create or replace function public.adjust_stock_with_date(
  p_product_id bigint,
  p_location_id bigint,
  p_quantity numeric,
  p_reason text,
  p_notes text,
  p_adjustment_date timestamp with time zone
)
returns bigint
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.adjust_stock(
    p_product_id, p_location_id, p_quantity, p_reason, p_notes, p_adjustment_date
  );
$$;

create or replace function public.transfer_stock_with_date(
  p_product_id bigint,
  p_source_location_id bigint,
  p_destination_location_id bigint,
  p_quantity numeric,
  p_notes text,
  p_transfer_date timestamp with time zone
)
returns bigint
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.transfer_stock(
    p_product_id, p_source_location_id, p_destination_location_id,
    p_quantity, p_notes, p_transfer_date
  );
$$;

create or replace function public.confirm_purchase_with_date(
  p_purchase_id bigint,
  p_unit_cost numeric,
  p_paid_now numeric,
  p_payment_method text,
  p_payment_date timestamp with time zone
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.confirm_purchase(
    p_purchase_id, p_unit_cost, p_paid_now, p_payment_method, p_payment_date
  );
$$;

revoke all on function public.receive_stock_with_date(bigint, bigint, bigint, numeric, text, text, timestamp with time zone) from public;
revoke all on function public.adjust_stock_with_date(bigint, bigint, numeric, text, text, timestamp with time zone) from public;
revoke all on function public.transfer_stock_with_date(bigint, bigint, bigint, numeric, text, timestamp with time zone) from public;
revoke all on function public.confirm_purchase_with_date(bigint, numeric, numeric, text, timestamp with time zone) from public;
grant execute on function public.receive_stock_with_date(bigint, bigint, bigint, numeric, text, text, timestamp with time zone) to authenticated;
grant execute on function public.adjust_stock_with_date(bigint, bigint, numeric, text, text, timestamp with time zone) to authenticated;
grant execute on function public.transfer_stock_with_date(bigint, bigint, bigint, numeric, text, timestamp with time zone) to authenticated;
grant execute on function public.confirm_purchase_with_date(bigint, numeric, numeric, text, timestamp with time zone) to authenticated;

-- create_sale accepts p_sale_date but the current deployed body stores now().
-- create_sale accepts p_sale_date but the current deployed body stores now().
-- Keep the existing implementation and transaction behavior, then correct the
-- newly-created row in the same transaction through a uniquely named wrapper.
create or replace function public.create_sale_with_date(
  p_customer_id bigint,
  p_items jsonb,
  p_paid_now numeric,
  p_payment_method text,
  p_notes text,
  p_sale_date timestamp with time zone
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  created_sale_id bigint;
begin
  created_sale_id := public.create_sale(
    p_customer_id => p_customer_id,
    p_items => p_items,
    p_paid_now => p_paid_now,
    p_payment_method => p_payment_method,
    p_notes => p_notes,
    p_sale_date => p_sale_date
  );

  update public.sales
     set sale_date = p_sale_date
   where id = created_sale_id;

  if not found then
    raise exception 'Sale % was created but its date could not be updated', created_sale_id;
  end if;

  return created_sale_id;
end;
$$;

revoke all on function public.create_sale_with_date(bigint, jsonb, numeric, text, text, timestamp with time zone) from public;
grant execute on function public.create_sale_with_date(bigint, jsonb, numeric, text, text, timestamp with time zone) to authenticated;

alter table public.sale_items
  add column if not exists unit_cost numeric,
  add column if not exists total_cost numeric,
  add column if not exists gross_profit numeric;

create or replace function public.set_sale_item_cost_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  configured_cost numeric;
begin
  if new.unit_cost is null then
    select pc.default_purchase_cost
      into configured_cost
      from public.product_costs pc
     where pc.product_id = new.product_id;

    new.unit_cost := configured_cost;
  end if;

  if new.unit_cost is null then
    -- Keep cost/profit unknown rather than presenting an invented zero cost.
    new.total_cost := null;
    new.gross_profit := null;
  else
    new.total_cost := new.unit_cost * new.quantity;
    new.gross_profit := new.total_amount - new.total_cost;
  end if;

  return new;
end;
$$;

drop trigger if exists sale_items_cost_snapshot on public.sale_items;
create trigger sale_items_cost_snapshot
before insert or update of product_id, quantity, total_amount, unit_cost
on public.sale_items
for each row
execute function public.set_sale_item_cost_snapshot();

comment on column public.sale_items.unit_cost is
  'Configured product default purchase cost captured when the sale item is written; NULL means unavailable.';
comment on column public.sale_items.total_cost is
  'Unit cost snapshot multiplied by sale item quantity; NULL means unavailable.';
comment on column public.sale_items.gross_profit is
  'Sale item total less the captured configured purchase cost; NULL means unavailable.';
