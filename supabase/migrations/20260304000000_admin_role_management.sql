-- ============================================================================
-- DIGITAL HEROES - PHASE F2: ATOMIC ADMIN ROLE MANAGEMENT RPC
-- ============================================================================
-- Enforces:
-- 1. Cluster-wide transaction serialization via pg_advisory_xact_lock
-- 2. Caller identity verification against auth.uid()
-- 3. Caller role verification (caller must be an active admin)
-- 4. Rejection of self-demotion (CANNOT_DEMOTE_SELF)
-- 5. Atomic protection of the last remaining admin (LAST_ADMIN_PROTECTED)
-- ============================================================================

create or replace function public.update_user_role_atomic(
  p_caller_id uuid,
  p_target_user_id uuid,
  p_new_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_target_profile record;
  v_admin_count integer;
  v_updated_profile record;
begin
  -- 1. TRANSACTION-LEVEL ADVISORY LOCK
  -- Serialize all role mutations globally across the cluster using transaction-scoped advisory lock.
  -- This guarantees concurrent demotions cannot race past the admin count check.
  perform pg_advisory_xact_lock(hashtext('digital_heroes_role_mutation_lock'));

  -- 2. CALLER IDENTITY & ADMIN AUTHORIZATION
  if p_caller_id is null then
    raise exception 'UNAUTHORIZED: caller user ID must be provided';
  end if;

  if auth.uid() is null or auth.uid() != p_caller_id then
    raise exception 'UNAUTHORIZED: caller does not match authenticated user ID';
  end if;

  select role into v_caller_role
  from public.profiles
  where id = p_caller_id;

  if v_caller_role is null or v_caller_role != 'admin' then
    raise exception 'UNAUTHORIZED: caller is not an administrator';
  end if;

  -- 3. VALIDATE PARAMETERS
  if p_new_role not in ('admin', 'subscriber') then
    raise exception 'INVALID_ROLE: Role must be either admin or subscriber';
  end if;

  -- 4. TARGET USER LOCK & EXISTENCE CHECK
  select * into v_target_profile
  from public.profiles
  where id = p_target_user_id
  for update;

  if v_target_profile is null then
    raise exception 'USER_NOT_FOUND: Target user does not exist';
  end if;

  -- If target already has the requested role, return early
  if v_target_profile.role = p_new_role then
    return jsonb_build_object(
      'success', true,
      'user_id', p_target_user_id,
      'role', p_new_role,
      'message', 'User already has this role'
    );
  end if;

  -- 5. PREVENT SELF-DEMOTION
  if p_caller_id = p_target_user_id and p_new_role != 'admin' then
    raise exception 'CANNOT_DEMOTE_SELF: Administrators cannot demote themselves';
  end if;

  -- 6. PREVENT LAST-ADMIN DEMOTION
  if v_target_profile.role = 'admin' and p_new_role != 'admin' then
    select count(*) into v_admin_count
    from public.profiles
    where role = 'admin';

    if v_admin_count <= 1 then
      raise exception 'LAST_ADMIN_PROTECTED: Cannot demote the last remaining administrator';
    end if;
  end if;

  -- 7. EXECUTE ROLE UPDATE
  update public.profiles
  set
    role = p_new_role,
    updated_at = now()
  where id = p_target_user_id
  returning * into v_updated_profile;

  return jsonb_build_object(
    'success', true,
    'user_id', v_updated_profile.id,
    'role', v_updated_profile.role,
    'email', v_updated_profile.email,
    'full_name', v_updated_profile.full_name,
    'updated_at', v_updated_profile.updated_at
  );
end;
$$;
