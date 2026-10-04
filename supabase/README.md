# Supabase V1 migrations

The migrations in `migrations/` have been applied successfully.

## Date-aware RPCs

The frontend uses the uniquely named `*_with_date` RPCs for stock receipt, stock adjustment, stock transfer, purchase confirmation, and sales. Their wrappers preserve the existing transaction implementations and pass the selected timestamp. The follow-up migration keeps the timestamp-aware implementation bodies under unique internal names and exposes non-defaulted timestamp shims, avoiding ambiguity with the original shorter function signatures.

Sale date persistence is verified end to end. The Sales form sends `p_sale_date` as an ISO UTC timestamp; the RPC stores it in `sales.sale_date`, which Sales History and Daily Transactions use for their date filtering and display.

## Sale item cost snapshot

New sale items capture the product's configured default purchase cost when available. Their total cost and gross profit are calculated from that snapshot. Historical rows without a valid cost remain unknown rather than receiving fabricated values.
