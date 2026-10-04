-- PostgreSQL cannot remove DEFAULT arguments from an existing function with
-- CREATE OR REPLACE FUNCTION. Keep each implementation and its body intact,
-- but move the timestamp-aware overloads to unique internal names. Their
-- same-name calls to the original (shorter) implementations then resolve
-- without competing defaulted overloads.
alter function public.receive_stock(
  bigint, bigint, bigint, numeric, text, text, timestamp with time zone
) rename to receive_stock_date_impl;

alter function public.adjust_stock(
  bigint, bigint, numeric, text, text, timestamp with time zone
) rename to adjust_stock_date_impl;

alter function public.transfer_stock(
  bigint, bigint, bigint, numeric, text, timestamp with time zone
) rename to transfer_stock_date_impl;

alter function public.confirm_purchase(
  bigint, numeric, numeric, text, timestamp with time zone
) rename to confirm_purchase_date_impl;

-- Recreate the same timestamped signatures as thin, non-defaulted shims.
-- This preserves explicit callers of the existing names while allowing the
-- date implementation's calls with the older argument count to resolve.
create or replace function public.receive_stock(
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
  select public.receive_stock_date_impl(
    p_supplier_id, p_location_id, p_product_id, p_quantity,
    p_invoice_number, p_notes, p_purchase_date
  );
$$;

create or replace function public.adjust_stock(
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
  select public.adjust_stock_date_impl(
    p_product_id, p_location_id, p_quantity, p_reason, p_notes,
    p_adjustment_date
  );
$$;

create or replace function public.transfer_stock(
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
  select public.transfer_stock_date_impl(
    p_product_id, p_source_location_id, p_destination_location_id,
    p_quantity, p_notes, p_transfer_date
  );
$$;

create or replace function public.confirm_purchase(
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
  select public.confirm_purchase_date_impl(
    p_purchase_id, p_unit_cost, p_paid_now, p_payment_method, p_payment_date
  );
$$;

revoke all on function public.receive_stock(bigint, bigint, bigint, numeric, text, text, timestamp with time zone) from public;
revoke all on function public.adjust_stock(bigint, bigint, numeric, text, text, timestamp with time zone) from public;
revoke all on function public.transfer_stock(bigint, bigint, bigint, numeric, text, timestamp with time zone) from public;
revoke all on function public.confirm_purchase(bigint, numeric, numeric, text, timestamp with time zone) from public;
grant execute on function public.receive_stock(bigint, bigint, bigint, numeric, text, text, timestamp with time zone) to authenticated;
grant execute on function public.adjust_stock(bigint, bigint, numeric, text, text, timestamp with time zone) to authenticated;
grant execute on function public.transfer_stock(bigint, bigint, bigint, numeric, text, timestamp with time zone) to authenticated;
grant execute on function public.confirm_purchase(bigint, numeric, numeric, text, timestamp with time zone) to authenticated;

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
  select public.receive_stock_date_impl(
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
  select public.adjust_stock_date_impl(
    p_product_id, p_location_id, p_quantity, p_reason, p_notes,
    p_adjustment_date
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
  select public.transfer_stock_date_impl(
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
  select public.confirm_purchase_date_impl(
    p_purchase_id, p_unit_cost, p_paid_now, p_payment_method, p_payment_date
  );
$$;
