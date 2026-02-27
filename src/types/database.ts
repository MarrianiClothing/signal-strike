export interface Deal {
  id: string;
  user_id: string;
  title: string;
  company: string;
  contact_name: string;
  contact_email: string;
  value: number;
  stage: "prospecting" | "qualification" | "proposal" | "negotiation" | "closed_won" | "closed_lost";
  probability: number;
  expected_close_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  user_id: string;
  deal_id: string;
  type: "call" | "email" | "meeting" | "note" | "stage_change" | "deal_created";
  title: string;
  body: string | null;
  external_id: string | null;
  occurred_at: string;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  year: number;
  annual_target: number;
  target_revenue: number;
  period_type: "monthly" | "quarterly" | "annual" | "multi-year";
  period_start: string;
  period_end: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  commission_rate: string;
  notify_new_deal: boolean;
  notify_stage_change: boolean;
  notify_goal_reached: boolean;
}
