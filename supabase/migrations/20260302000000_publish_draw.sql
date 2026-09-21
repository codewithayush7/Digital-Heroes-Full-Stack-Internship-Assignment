-- ============================================================================
-- DIGITAL HEROES - PHASE C: PUBLISH DRAW ATOMIC RPC
-- ============================================================================

create or replace function public.publish_draw(
  p_draw_id uuid,
  p_admin_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_role text;
  v_draw record;
  v_prev_rollover numeric(10,2);
  v_authoritative_rollover numeric(10,2);
  v_t5_count integer;
  v_t5_sum numeric(10,2);
  v_t4_count integer;
  v_t4_sum numeric(10,2);
  v_t3_count integer;
  v_t3_sum numeric(10,2);
  v_non_winners_with_prizes integer;
  v_final_jackpot_rolled_over boolean;
  v_final_rollover_jackpot_out numeric(10,2);
  v_final_unclaimed_tier_4 numeric(10,2);
  v_final_unclaimed_tier_3 numeric(10,2);
  v_inserted_winners integer;
  v_published_timestamp timestamptz;
begin
  -- 1. TRANSACTION CONCURRENCY LOCK
  -- Serialize all draw publishing globally across the cluster using transaction-scoped advisory lock.
  perform pg_advisory_xact_lock(hashtext('digital_heroes_publish_draw_lock'));

  -- 2. ADMIN AUTHORIZATION & CALLER IDENTITY VERIFICATION
  -- Enforces security invariant: auth.uid() = p_admin_id AND profiles.id = p_admin_id AND profiles.role = 'admin'
  if p_admin_id is null then
    raise exception 'UNAUTHORIZED: admin user ID must be provided';
  end if;

  if auth.uid() is null or auth.uid() != p_admin_id then
    raise exception 'UNAUTHORIZED: caller does not match admin ID';
  end if;

  select role into v_admin_role
  from public.profiles
  where id = p_admin_id;

  if v_admin_role is null or v_admin_role != 'admin' then
    raise exception 'UNAUTHORIZED: supplied user % is not an active admin', p_admin_id;
  end if;

  -- 3. TARGET DRAW LOCKING & LIFECYCLE VALIDATION
  select * into v_draw
  from public.draws
  where id = p_draw_id
  for update;

  if not found then
    raise exception 'NOT_FOUND: draw % does not exist', p_draw_id;
  end if;

  if v_draw.status != 'simulated' then
    raise exception 'INVALID_STATUS: cannot publish draw % with status ''%'', expected ''simulated''',
      p_draw_id, v_draw.status;
  end if;

  if v_draw.drawn_numbers is null or array_length(v_draw.drawn_numbers, 1) != 5 then
    raise exception 'INVALID_DRAW: draw % does not have 5 drawn numbers', p_draw_id;
  end if;

  -- 4. AUTHORITATIVE ROLLOVER VALIDATION
  -- Derived strictly from the SINGLE latest published draw, regardless of whether it rolled over.
  select rollover_jackpot_out into v_prev_rollover
  from public.draws
  where status = 'published' and id != p_draw_id
  order by published_at desc nulls last, draw_date desc, created_at desc
  limit 1;

  if not found then
    v_authoritative_rollover := 0.00;
  else
    v_authoritative_rollover := coalesce(v_prev_rollover, 0.00);
  end if;

  if v_draw.rollover_jackpot_in != v_authoritative_rollover then
    raise exception 'STALE_ROLLOVER: target draw rollover_in (%) does not match current authoritative rollover (%) from latest published draw',
      v_draw.rollover_jackpot_in, v_authoritative_rollover;
  end if;

  -- 5. ACCOUNTING VALIDATION ON SIMULATION SNAPSHOT
  -- Invariant 1: total_prize_pool = subscription_pool_portion + rollover_jackpot_in
  if v_draw.total_prize_pool != (v_draw.subscription_pool_portion + v_draw.rollover_jackpot_in) then
    raise exception 'ACCOUNTING_MISMATCH: total_prize_pool (%) != subscription_pool_portion (%) + rollover_jackpot_in (%)',
      v_draw.total_prize_pool, v_draw.subscription_pool_portion, v_draw.rollover_jackpot_in;
  end if;

  -- Invariant 2: tier5_pool + tier4_pool + tier3_pool = total_prize_pool
  if (v_draw.tier_5_pool + v_draw.tier_4_pool + v_draw.tier_3_pool) != v_draw.total_prize_pool then
    raise exception 'ACCOUNTING_MISMATCH: tier sum (% + % + %) != total_prize_pool (%)',
      v_draw.tier_5_pool, v_draw.tier_4_pool, v_draw.tier_3_pool, v_draw.total_prize_pool;
  end if;

  -- Query simulation entries for winner payout and non-winner sanity
  select
    count(*) filter (where winning_tier = 'tier_5'),
    coalesce(sum(prize_amount) filter (where winning_tier = 'tier_5'), 0.00),
    count(*) filter (where winning_tier = 'tier_4'),
    coalesce(sum(prize_amount) filter (where winning_tier = 'tier_4'), 0.00),
    count(*) filter (where winning_tier = 'tier_3'),
    coalesce(sum(prize_amount) filter (where winning_tier = 'tier_3'), 0.00),
    count(*) filter (where winning_tier is null and prize_amount > 0)
  into
    v_t5_count, v_t5_sum,
    v_t4_count, v_t4_sum,
    v_t3_count, v_t3_sum,
    v_non_winners_with_prizes
  from public.draw_entries
  where draw_id = p_draw_id;

  -- Invariant 10: Non-winning entries must have prize_amount = 0
  if v_non_winners_with_prizes > 0 then
    raise exception 'ACCOUNTING_MISMATCH: found non-winning draw entries with non-zero prize amounts';
  end if;

  -- Invariants 3, 4, 5: Tier 5 validation & rollover determination
  if v_t5_count > 0 then
    if v_t5_sum != v_draw.tier_5_pool then
      raise exception 'ACCOUNTING_MISMATCH: tier 5 payouts (%) != tier 5 pool (%)', v_t5_sum, v_draw.tier_5_pool;
    end if;
    v_final_jackpot_rolled_over := false;
    v_final_rollover_jackpot_out := 0.00;
  else
    v_final_jackpot_rolled_over := true;
    v_final_rollover_jackpot_out := v_draw.tier_5_pool;
  end if;

  -- Invariants 3, 6, 7: Tier 4 validation & unclaimed determination
  if v_t4_count > 0 then
    if v_t4_sum != v_draw.tier_4_pool then
      raise exception 'ACCOUNTING_MISMATCH: tier 4 payouts (%) != tier 4 pool (%)', v_t4_sum, v_draw.tier_4_pool;
    end if;
    v_final_unclaimed_tier_4 := 0.00;
  else
    v_final_unclaimed_tier_4 := v_draw.tier_4_pool;
  end if;

  -- Invariants 3, 8, 9: Tier 3 validation & unclaimed determination
  if v_t3_count > 0 then
    if v_t3_sum != v_draw.tier_3_pool then
      raise exception 'ACCOUNTING_MISMATCH: tier 3 payouts (%) != tier 3 pool (%)', v_t3_sum, v_draw.tier_3_pool;
    end if;
    v_final_unclaimed_tier_3 := 0.00;
  else
    v_final_unclaimed_tier_3 := v_draw.tier_3_pool;
  end if;

  -- 6. ATOMIC WINNER CREATION
  -- Only create rows for winning entries; enforce pending statuses
  insert into public.winners (
    draw_entry_id,
    user_id,
    draw_id,
    tier,
    prize_amount,
    verification_status,
    payment_status,
    created_at,
    updated_at
  )
  select
    de.id,
    de.user_id,
    de.draw_id,
    de.winning_tier,
    de.prize_amount,
    'pending_submission',
    'pending',
    now(),
    now()
  from public.draw_entries de
  where de.draw_id = p_draw_id
    and de.winning_tier is not null;

  get diagnostics v_inserted_winners = row_count;

  -- 7. FINALIZE DRAW STATUS & ROLLOVER
  v_published_timestamp := now();

  update public.draws
  set
    status = 'published',
    published_at = v_published_timestamp,
    jackpot_rolled_over = v_final_jackpot_rolled_over,
    rollover_jackpot_out = v_final_rollover_jackpot_out,
    unclaimed_tier_4 = v_final_unclaimed_tier_4,
    unclaimed_tier_3 = v_final_unclaimed_tier_3,
    updated_at = v_published_timestamp
  where id = p_draw_id;

  -- 8. RETURN STRUCTURED JSONB SUMMARY
  return jsonb_build_object(
    'draw_id', p_draw_id,
    'status', 'published',
    'published_at', v_published_timestamp,
    'winners_count', v_inserted_winners,
    'tier_5_winners', v_t5_count,
    'tier_4_winners', v_t4_count,
    'tier_3_winners', v_t3_count,
    'jackpot_rolled_over', v_final_jackpot_rolled_over,
    'rollover_jackpot_out', v_final_rollover_jackpot_out,
    'unclaimed_tier_4', v_final_unclaimed_tier_4,
    'unclaimed_tier_3', v_final_unclaimed_tier_3
  );
end;
$$;

revoke execute on function public.publish_draw(uuid, uuid) from public;
grant execute on function public.publish_draw(uuid, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

