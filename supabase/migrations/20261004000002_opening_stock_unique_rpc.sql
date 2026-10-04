-- Fix Opening Stock RPC overload ambiguity.
-- Keep the original opening-stock implementation, but move the
-- timestamp-aware overload to a unique internal name so the public
-- set_opening_stock_batch call cannot become ambiguous.

DO $$
BEGIN
  IF to_regprocedure(
       'public.set_opening_stock_batch_date_impl(bigint,jsonb,text,timestamptz)'
     ) IS NULL
     AND to_regprocedure(
       'public.set_opening_stock_batch(bigint,jsonb,text,timestamptz)'
     ) IS NOT NULL
  THEN
    ALTER FUNCTION public.set_opening_stock_batch(
      bigint,
      jsonb,
      text,
      timestamptz
    ) RENAME TO set_opening_stock_batch_date_impl;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.set_opening_stock_batch_date_impl(
  p_location_id bigint,
  p_items jsonb,
  p_notes text,
  p_opening_date timestamp with time zone DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_started_at timestamptz;
begin
  v_started_at := clock_timestamp();

  perform public.set_opening_stock_batch(
    p_location_id,
    p_items,
    p_notes
  );

  update public.stock_transactions
  set transaction_date = p_opening_date
  where location_id = p_location_id
    and transaction_type = 'OPENING'
    and created_at >= v_started_at;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_opening_stock_batch_with_date(
  p_location_id bigint,
  p_items jsonb,
  p_notes text,
  p_opening_date timestamp with time zone
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.set_opening_stock_batch_date_impl(
    p_location_id,
    p_items,
    p_notes,
    p_opening_date
  );

  RETURN jsonb_array_length(p_items);
END;
$function$;

REVOKE ALL
ON FUNCTION public.set_opening_stock_batch_date_impl(
  bigint,
  jsonb,
  text,
  timestamptz
)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.set_opening_stock_batch_with_date(
  bigint,
  jsonb,
  text,
  timestamptz
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.set_opening_stock_batch_with_date(
  bigint,
  jsonb,
  text,
  timestamptz
)
TO authenticated;
