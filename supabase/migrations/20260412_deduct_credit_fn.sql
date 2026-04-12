-- Atomic function to deduct one credit (prevents race conditions)
CREATE OR REPLACE FUNCTION deduct_credit(p_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE credits
  SET
    balance    = GREATEST(balance - 1, 0),
    total_used = total_used + 1,
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
