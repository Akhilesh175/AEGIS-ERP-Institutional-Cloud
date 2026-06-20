-- =====================================================================
-- SPORTS ERP — PAYROLL UNIQUE CONSTRAINT
-- Enforce that an employee (user_id) can only have ONE salary record 
-- per school, month, and year (formatted as YYYY-MM in the 'month' column)
-- =====================================================================

ALTER TABLE public.sports_salary_records 
ADD CONSTRAINT uniq_school_employee_month UNIQUE (school_id, user_id, month);
