-- ============================================================================
-- DIGITAL HEROES - PHASE F3.2: DONATION CONCURRENCY & IDEMPOTENCY HARDENING
-- ============================================================================
-- Enforces:
-- 1. Database-level uniqueness on non-null stripe_payment_id via partial unique index
-- 2. Atomic donation reconciliation via record_independent_donation_atomic RPC
-- 3. Transaction-level advisory lock on stripe_payment_id to serialize concurrent webhooks
-- 4. Single atomic transaction: donation row insertion + charity total_funds_raised increment
-- 5. Strict security definer and service_role-only execution privileges
-- ============================================================================

-- 1. DATABASE UNIQUENESS
-- Enforce database-level uniqueness on non-null stripe_payment_id values
-- to prevent duplicate donation records from concurrent webhook deliveries or races.
-- Note: stripe_payment_id remains nullable to support subscription allocation records.
create unique index if not exists idx_donations_stripe_payment_id_unique
on public.donations (stripe_payment_id)
where stripe_payment_id is not null;

-- 2. ATOMIC DONATION RECONCILIATION FUNCTION
-- Dedicated exclusively to independent donations.
-- Atomically:
--   a. Acquires transaction-scoped advisory lock on hashed stripe_payment_id to serialize concurrent webhooks
--   b. Checks if the payment was already recorded
--   c. If already recorded: returns success (already_processed = true) without double-incrementing charity funds
--   d. If not recorded: inserts donation (donation_type = 'independent') and increments charity total_funds_raised atomically
--   e. Rolls back completely if any step fails
create or replace function public.record_independent_donation_atomic(
  p_charity_id uuid,
  p_amount numeric,
  p_currency text,
  p_stripe_payment_id text,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_id uuid;
  v_donation_id uuid;
  v_charity record;
begin
  -- Input validations
  if p_charity_id is null then
    raise exception 'INVALID_INPUT: charity ID is required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_INPUT: donation amount must be greater than zero';
  end if;

  if p_stripe_payment_id is null or trim(p_stripe_payment_id) = '' then
    raise exception 'INVALID_INPUT: stripe_payment_id is required';
  end if;

  -- Transaction advisory lock:
  -- Using a transaction-scoped advisory lock on the hashtext of 'donation_' || p_stripe_payment_id.
  -- This serializes concurrent executions for the exact same payment identifier.
  -- (Advisory lock hash collisions only serialize execution, never corrupt data.
  --  The partial unique index idx_donations_stripe_payment_id_unique provides the final database-level guarantee).
  perform pg_advisory_xact_lock(hashtext('donation_' || p_stripe_payment_id));

  -- Idempotency check:
  select id into v_existing_id
  from public.donations
  where stripe_payment_id = p_stripe_payment_id;

  if v_existing_id is not null then
    return jsonb_build_object(
      'success', true,
      'donation_created', false,
      'already_processed', true,
      'donation_id', v_existing_id,
      'message', 'Donation has already been recorded'
    );
  end if;

  -- Verify charity existence and lock charity row for update
  select id, total_funds_raised into v_charity
  from public.charities
  where id = p_charity_id
  for update;

  if v_charity is null then
    raise exception 'CHARITY_NOT_FOUND: Target charity does not exist';
  end if;

  -- Insert independent donation row
  insert into public.donations (
    user_id,
    charity_id,
    amount,
    currency,
    donation_type,
    stripe_payment_id,
    status,
    created_at
  ) values (
    p_user_id,
    p_charity_id,
    p_amount,
    coalesce(lower(p_currency), 'usd'),
    'independent',
    p_stripe_payment_id,
    'completed',
    now()
  )
  returning id into v_donation_id;

  -- Increment charity total_funds_raised
  update public.charities
  set
    total_funds_raised = coalesce(total_funds_raised, 0) + p_amount,
    updated_at = now()
  where id = p_charity_id;

  return jsonb_build_object(
    'success', true,
    'donation_created', true,
    'already_processed', false,
    'donation_id', v_donation_id,
    'charity_id', p_charity_id,
    'amount', p_amount,
    'currency', coalesce(lower(p_currency), 'usd')
  );
end;
$$;

-- Security hardening:
-- Prevent direct anonymous or authenticated client execution.
-- Accessible only via trusted backend server (service_role).
revoke all on function public.record_independent_donation_atomic(uuid, numeric, text, text, uuid) from public;
revoke all on function public.record_independent_donation_atomic(uuid, numeric, text, text, uuid) from anon, authenticated;
grant execute on function public.record_independent_donation_atomic(uuid, numeric, text, text, uuid) to service_role;

notify pgrst, 'reload schema';
