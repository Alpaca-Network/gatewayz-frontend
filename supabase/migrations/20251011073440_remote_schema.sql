create sequence "public"."referrals_id_seq";

drop trigger if exists "trigger_log_role_change" on "public"."users";

drop policy "Authenticated users can read role_audit_log" on "public"."role_audit_log";

drop policy "Service role has full access to role_audit_log" on "public"."role_audit_log";

drop policy "Authenticated users can read role_permissions" on "public"."role_permissions";

drop policy "Service role has full access to role_permissions" on "public"."role_permissions";

revoke delete on table "public"."activity_log" from "anon";

revoke insert on table "public"."activity_log" from "anon";

revoke references on table "public"."activity_log" from "anon";

revoke select on table "public"."activity_log" from "anon";

revoke trigger on table "public"."activity_log" from "anon";

revoke truncate on table "public"."activity_log" from "anon";

revoke update on table "public"."activity_log" from "anon";

revoke delete on table "public"."activity_log" from "authenticated";

revoke insert on table "public"."activity_log" from "authenticated";

revoke references on table "public"."activity_log" from "authenticated";

revoke select on table "public"."activity_log" from "authenticated";

revoke trigger on table "public"."activity_log" from "authenticated";

revoke truncate on table "public"."activity_log" from "authenticated";

revoke update on table "public"."activity_log" from "authenticated";

revoke delete on table "public"."activity_log" from "service_role";

revoke insert on table "public"."activity_log" from "service_role";

revoke references on table "public"."activity_log" from "service_role";

revoke select on table "public"."activity_log" from "service_role";

revoke trigger on table "public"."activity_log" from "service_role";

revoke truncate on table "public"."activity_log" from "service_role";

revoke update on table "public"."activity_log" from "service_role";

revoke delete on table "public"."api_keys_new" from "anon";

revoke insert on table "public"."api_keys_new" from "anon";

revoke references on table "public"."api_keys_new" from "anon";

revoke select on table "public"."api_keys_new" from "anon";

revoke trigger on table "public"."api_keys_new" from "anon";

revoke truncate on table "public"."api_keys_new" from "anon";

revoke update on table "public"."api_keys_new" from "anon";

revoke delete on table "public"."api_keys_new" from "authenticated";

revoke insert on table "public"."api_keys_new" from "authenticated";

revoke references on table "public"."api_keys_new" from "authenticated";

revoke select on table "public"."api_keys_new" from "authenticated";

revoke trigger on table "public"."api_keys_new" from "authenticated";

revoke truncate on table "public"."api_keys_new" from "authenticated";

revoke update on table "public"."api_keys_new" from "authenticated";

revoke delete on table "public"."api_keys_new" from "service_role";

revoke insert on table "public"."api_keys_new" from "service_role";

revoke references on table "public"."api_keys_new" from "service_role";

revoke select on table "public"."api_keys_new" from "service_role";

revoke trigger on table "public"."api_keys_new" from "service_role";

revoke truncate on table "public"."api_keys_new" from "service_role";

revoke update on table "public"."api_keys_new" from "service_role";

revoke delete on table "public"."chat_messages" from "anon";

revoke insert on table "public"."chat_messages" from "anon";

revoke references on table "public"."chat_messages" from "anon";

revoke select on table "public"."chat_messages" from "anon";

revoke trigger on table "public"."chat_messages" from "anon";

revoke truncate on table "public"."chat_messages" from "anon";

revoke update on table "public"."chat_messages" from "anon";

revoke delete on table "public"."chat_messages" from "authenticated";

revoke insert on table "public"."chat_messages" from "authenticated";

revoke references on table "public"."chat_messages" from "authenticated";

revoke select on table "public"."chat_messages" from "authenticated";

revoke trigger on table "public"."chat_messages" from "authenticated";

revoke truncate on table "public"."chat_messages" from "authenticated";

revoke update on table "public"."chat_messages" from "authenticated";

revoke delete on table "public"."chat_messages" from "service_role";

revoke insert on table "public"."chat_messages" from "service_role";

revoke references on table "public"."chat_messages" from "service_role";

revoke select on table "public"."chat_messages" from "service_role";

revoke trigger on table "public"."chat_messages" from "service_role";

revoke truncate on table "public"."chat_messages" from "service_role";

revoke update on table "public"."chat_messages" from "service_role";

revoke delete on table "public"."chat_sessions" from "anon";

revoke insert on table "public"."chat_sessions" from "anon";

revoke references on table "public"."chat_sessions" from "anon";

revoke select on table "public"."chat_sessions" from "anon";

revoke trigger on table "public"."chat_sessions" from "anon";

revoke truncate on table "public"."chat_sessions" from "anon";

revoke update on table "public"."chat_sessions" from "anon";

revoke delete on table "public"."chat_sessions" from "authenticated";

revoke insert on table "public"."chat_sessions" from "authenticated";

revoke references on table "public"."chat_sessions" from "authenticated";

revoke select on table "public"."chat_sessions" from "authenticated";

revoke trigger on table "public"."chat_sessions" from "authenticated";

revoke truncate on table "public"."chat_sessions" from "authenticated";

revoke update on table "public"."chat_sessions" from "authenticated";

revoke delete on table "public"."chat_sessions" from "service_role";

revoke insert on table "public"."chat_sessions" from "service_role";

revoke references on table "public"."chat_sessions" from "service_role";

revoke select on table "public"."chat_sessions" from "service_role";

revoke trigger on table "public"."chat_sessions" from "service_role";

revoke truncate on table "public"."chat_sessions" from "service_role";

revoke update on table "public"."chat_sessions" from "service_role";

revoke delete on table "public"."coupon_redemptions" from "anon";

revoke insert on table "public"."coupon_redemptions" from "anon";

revoke references on table "public"."coupon_redemptions" from "anon";

revoke select on table "public"."coupon_redemptions" from "anon";

revoke trigger on table "public"."coupon_redemptions" from "anon";

revoke truncate on table "public"."coupon_redemptions" from "anon";

revoke update on table "public"."coupon_redemptions" from "anon";

revoke delete on table "public"."coupon_redemptions" from "authenticated";

revoke insert on table "public"."coupon_redemptions" from "authenticated";

revoke references on table "public"."coupon_redemptions" from "authenticated";

revoke select on table "public"."coupon_redemptions" from "authenticated";

revoke trigger on table "public"."coupon_redemptions" from "authenticated";

revoke truncate on table "public"."coupon_redemptions" from "authenticated";

revoke update on table "public"."coupon_redemptions" from "authenticated";

revoke delete on table "public"."coupon_redemptions" from "service_role";

revoke insert on table "public"."coupon_redemptions" from "service_role";

revoke references on table "public"."coupon_redemptions" from "service_role";

revoke select on table "public"."coupon_redemptions" from "service_role";

revoke trigger on table "public"."coupon_redemptions" from "service_role";

revoke truncate on table "public"."coupon_redemptions" from "service_role";

revoke update on table "public"."coupon_redemptions" from "service_role";

revoke delete on table "public"."coupons" from "anon";

revoke insert on table "public"."coupons" from "anon";

revoke references on table "public"."coupons" from "anon";

revoke select on table "public"."coupons" from "anon";

revoke trigger on table "public"."coupons" from "anon";

revoke truncate on table "public"."coupons" from "anon";

revoke update on table "public"."coupons" from "anon";

revoke delete on table "public"."coupons" from "authenticated";

revoke insert on table "public"."coupons" from "authenticated";

revoke references on table "public"."coupons" from "authenticated";

revoke select on table "public"."coupons" from "authenticated";

revoke trigger on table "public"."coupons" from "authenticated";

revoke truncate on table "public"."coupons" from "authenticated";

revoke update on table "public"."coupons" from "authenticated";

revoke delete on table "public"."coupons" from "service_role";

revoke insert on table "public"."coupons" from "service_role";

revoke references on table "public"."coupons" from "service_role";

revoke select on table "public"."coupons" from "service_role";

revoke trigger on table "public"."coupons" from "service_role";

revoke truncate on table "public"."coupons" from "service_role";

revoke update on table "public"."coupons" from "service_role";

revoke delete on table "public"."credit_transactions" from "anon";

revoke insert on table "public"."credit_transactions" from "anon";

revoke references on table "public"."credit_transactions" from "anon";

revoke select on table "public"."credit_transactions" from "anon";

revoke trigger on table "public"."credit_transactions" from "anon";

revoke truncate on table "public"."credit_transactions" from "anon";

revoke update on table "public"."credit_transactions" from "anon";

revoke delete on table "public"."credit_transactions" from "authenticated";

revoke insert on table "public"."credit_transactions" from "authenticated";

revoke references on table "public"."credit_transactions" from "authenticated";

revoke select on table "public"."credit_transactions" from "authenticated";

revoke trigger on table "public"."credit_transactions" from "authenticated";

revoke truncate on table "public"."credit_transactions" from "authenticated";

revoke update on table "public"."credit_transactions" from "authenticated";

revoke delete on table "public"."credit_transactions" from "service_role";

revoke insert on table "public"."credit_transactions" from "service_role";

revoke references on table "public"."credit_transactions" from "service_role";

revoke select on table "public"."credit_transactions" from "service_role";

revoke trigger on table "public"."credit_transactions" from "service_role";

revoke truncate on table "public"."credit_transactions" from "service_role";

revoke update on table "public"."credit_transactions" from "service_role";

revoke delete on table "public"."openrouter_apps" from "anon";

revoke insert on table "public"."openrouter_apps" from "anon";

revoke references on table "public"."openrouter_apps" from "anon";

revoke select on table "public"."openrouter_apps" from "anon";

revoke trigger on table "public"."openrouter_apps" from "anon";

revoke truncate on table "public"."openrouter_apps" from "anon";

revoke update on table "public"."openrouter_apps" from "anon";

revoke delete on table "public"."openrouter_apps" from "authenticated";

revoke insert on table "public"."openrouter_apps" from "authenticated";

revoke references on table "public"."openrouter_apps" from "authenticated";

revoke select on table "public"."openrouter_apps" from "authenticated";

revoke trigger on table "public"."openrouter_apps" from "authenticated";

revoke truncate on table "public"."openrouter_apps" from "authenticated";

revoke update on table "public"."openrouter_apps" from "authenticated";

revoke delete on table "public"."openrouter_apps" from "service_role";

revoke insert on table "public"."openrouter_apps" from "service_role";

revoke references on table "public"."openrouter_apps" from "service_role";

revoke select on table "public"."openrouter_apps" from "service_role";

revoke trigger on table "public"."openrouter_apps" from "service_role";

revoke truncate on table "public"."openrouter_apps" from "service_role";

revoke update on table "public"."openrouter_apps" from "service_role";

revoke delete on table "public"."openrouter_models" from "anon";

revoke insert on table "public"."openrouter_models" from "anon";

revoke references on table "public"."openrouter_models" from "anon";

revoke select on table "public"."openrouter_models" from "anon";

revoke trigger on table "public"."openrouter_models" from "anon";

revoke truncate on table "public"."openrouter_models" from "anon";

revoke update on table "public"."openrouter_models" from "anon";

revoke delete on table "public"."openrouter_models" from "authenticated";

revoke insert on table "public"."openrouter_models" from "authenticated";

revoke references on table "public"."openrouter_models" from "authenticated";

revoke select on table "public"."openrouter_models" from "authenticated";

revoke trigger on table "public"."openrouter_models" from "authenticated";

revoke truncate on table "public"."openrouter_models" from "authenticated";

revoke update on table "public"."openrouter_models" from "authenticated";

revoke delete on table "public"."openrouter_models" from "service_role";

revoke insert on table "public"."openrouter_models" from "service_role";

revoke references on table "public"."openrouter_models" from "service_role";

revoke select on table "public"."openrouter_models" from "service_role";

revoke trigger on table "public"."openrouter_models" from "service_role";

revoke truncate on table "public"."openrouter_models" from "service_role";

revoke update on table "public"."openrouter_models" from "service_role";

revoke delete on table "public"."payments" from "anon";

revoke insert on table "public"."payments" from "anon";

revoke references on table "public"."payments" from "anon";

revoke select on table "public"."payments" from "anon";

revoke trigger on table "public"."payments" from "anon";

revoke truncate on table "public"."payments" from "anon";

revoke update on table "public"."payments" from "anon";

revoke delete on table "public"."payments" from "authenticated";

revoke insert on table "public"."payments" from "authenticated";

revoke references on table "public"."payments" from "authenticated";

revoke select on table "public"."payments" from "authenticated";

revoke trigger on table "public"."payments" from "authenticated";

revoke truncate on table "public"."payments" from "authenticated";

revoke update on table "public"."payments" from "authenticated";

revoke delete on table "public"."payments" from "service_role";

revoke insert on table "public"."payments" from "service_role";

revoke references on table "public"."payments" from "service_role";

revoke select on table "public"."payments" from "service_role";

revoke trigger on table "public"."payments" from "service_role";

revoke truncate on table "public"."payments" from "service_role";

revoke update on table "public"."payments" from "service_role";

revoke delete on table "public"."ping_stats" from "anon";

revoke insert on table "public"."ping_stats" from "anon";

revoke references on table "public"."ping_stats" from "anon";

revoke select on table "public"."ping_stats" from "anon";

revoke trigger on table "public"."ping_stats" from "anon";

revoke truncate on table "public"."ping_stats" from "anon";

revoke update on table "public"."ping_stats" from "anon";

revoke delete on table "public"."ping_stats" from "authenticated";

revoke insert on table "public"."ping_stats" from "authenticated";

revoke references on table "public"."ping_stats" from "authenticated";

revoke select on table "public"."ping_stats" from "authenticated";

revoke trigger on table "public"."ping_stats" from "authenticated";

revoke truncate on table "public"."ping_stats" from "authenticated";

revoke update on table "public"."ping_stats" from "authenticated";

revoke delete on table "public"."ping_stats" from "service_role";

revoke insert on table "public"."ping_stats" from "service_role";

revoke references on table "public"."ping_stats" from "service_role";

revoke select on table "public"."ping_stats" from "service_role";

revoke trigger on table "public"."ping_stats" from "service_role";

revoke truncate on table "public"."ping_stats" from "service_role";

revoke update on table "public"."ping_stats" from "service_role";

revoke delete on table "public"."plans" from "anon";

revoke insert on table "public"."plans" from "anon";

revoke references on table "public"."plans" from "anon";

revoke select on table "public"."plans" from "anon";

revoke trigger on table "public"."plans" from "anon";

revoke truncate on table "public"."plans" from "anon";

revoke update on table "public"."plans" from "anon";

revoke delete on table "public"."plans" from "authenticated";

revoke insert on table "public"."plans" from "authenticated";

revoke references on table "public"."plans" from "authenticated";

revoke select on table "public"."plans" from "authenticated";

revoke trigger on table "public"."plans" from "authenticated";

revoke truncate on table "public"."plans" from "authenticated";

revoke update on table "public"."plans" from "authenticated";

revoke delete on table "public"."plans" from "service_role";

revoke insert on table "public"."plans" from "service_role";

revoke references on table "public"."plans" from "service_role";

revoke select on table "public"."plans" from "service_role";

revoke trigger on table "public"."plans" from "service_role";

revoke truncate on table "public"."plans" from "service_role";

revoke update on table "public"."plans" from "service_role";

revoke delete on table "public"."pricing_tiers" from "anon";

revoke insert on table "public"."pricing_tiers" from "anon";

revoke references on table "public"."pricing_tiers" from "anon";

revoke select on table "public"."pricing_tiers" from "anon";

revoke trigger on table "public"."pricing_tiers" from "anon";

revoke truncate on table "public"."pricing_tiers" from "anon";

revoke update on table "public"."pricing_tiers" from "anon";

revoke delete on table "public"."pricing_tiers" from "authenticated";

revoke insert on table "public"."pricing_tiers" from "authenticated";

revoke references on table "public"."pricing_tiers" from "authenticated";

revoke select on table "public"."pricing_tiers" from "authenticated";

revoke trigger on table "public"."pricing_tiers" from "authenticated";

revoke truncate on table "public"."pricing_tiers" from "authenticated";

revoke update on table "public"."pricing_tiers" from "authenticated";

revoke delete on table "public"."pricing_tiers" from "service_role";

revoke insert on table "public"."pricing_tiers" from "service_role";

revoke references on table "public"."pricing_tiers" from "service_role";

revoke select on table "public"."pricing_tiers" from "service_role";

revoke trigger on table "public"."pricing_tiers" from "service_role";

revoke truncate on table "public"."pricing_tiers" from "service_role";

revoke update on table "public"."pricing_tiers" from "service_role";

revoke delete on table "public"."role_audit_log" from "anon";

revoke insert on table "public"."role_audit_log" from "anon";

revoke references on table "public"."role_audit_log" from "anon";

revoke select on table "public"."role_audit_log" from "anon";

revoke trigger on table "public"."role_audit_log" from "anon";

revoke truncate on table "public"."role_audit_log" from "anon";

revoke update on table "public"."role_audit_log" from "anon";

revoke delete on table "public"."role_audit_log" from "authenticated";

revoke insert on table "public"."role_audit_log" from "authenticated";

revoke references on table "public"."role_audit_log" from "authenticated";

revoke select on table "public"."role_audit_log" from "authenticated";

revoke trigger on table "public"."role_audit_log" from "authenticated";

revoke truncate on table "public"."role_audit_log" from "authenticated";

revoke update on table "public"."role_audit_log" from "authenticated";

revoke delete on table "public"."role_audit_log" from "service_role";

revoke insert on table "public"."role_audit_log" from "service_role";

revoke references on table "public"."role_audit_log" from "service_role";

revoke select on table "public"."role_audit_log" from "service_role";

revoke trigger on table "public"."role_audit_log" from "service_role";

revoke truncate on table "public"."role_audit_log" from "service_role";

revoke update on table "public"."role_audit_log" from "service_role";

revoke delete on table "public"."role_permissions" from "anon";

revoke insert on table "public"."role_permissions" from "anon";

revoke references on table "public"."role_permissions" from "anon";

revoke select on table "public"."role_permissions" from "anon";

revoke trigger on table "public"."role_permissions" from "anon";

revoke truncate on table "public"."role_permissions" from "anon";

revoke update on table "public"."role_permissions" from "anon";

revoke delete on table "public"."role_permissions" from "authenticated";

revoke insert on table "public"."role_permissions" from "authenticated";

revoke references on table "public"."role_permissions" from "authenticated";

revoke select on table "public"."role_permissions" from "authenticated";

revoke trigger on table "public"."role_permissions" from "authenticated";

revoke truncate on table "public"."role_permissions" from "authenticated";

revoke update on table "public"."role_permissions" from "authenticated";

revoke delete on table "public"."role_permissions" from "service_role";

revoke insert on table "public"."role_permissions" from "service_role";

revoke references on table "public"."role_permissions" from "service_role";

revoke select on table "public"."role_permissions" from "service_role";

revoke trigger on table "public"."role_permissions" from "service_role";

revoke truncate on table "public"."role_permissions" from "service_role";

revoke update on table "public"."role_permissions" from "service_role";

revoke delete on table "public"."trial_config" from "anon";

revoke insert on table "public"."trial_config" from "anon";

revoke references on table "public"."trial_config" from "anon";

revoke select on table "public"."trial_config" from "anon";

revoke trigger on table "public"."trial_config" from "anon";

revoke truncate on table "public"."trial_config" from "anon";

revoke update on table "public"."trial_config" from "anon";

revoke delete on table "public"."trial_config" from "authenticated";

revoke insert on table "public"."trial_config" from "authenticated";

revoke references on table "public"."trial_config" from "authenticated";

revoke select on table "public"."trial_config" from "authenticated";

revoke trigger on table "public"."trial_config" from "authenticated";

revoke truncate on table "public"."trial_config" from "authenticated";

revoke update on table "public"."trial_config" from "authenticated";

revoke delete on table "public"."trial_config" from "service_role";

revoke insert on table "public"."trial_config" from "service_role";

revoke references on table "public"."trial_config" from "service_role";

revoke select on table "public"."trial_config" from "service_role";

revoke trigger on table "public"."trial_config" from "service_role";

revoke truncate on table "public"."trial_config" from "service_role";

revoke update on table "public"."trial_config" from "service_role";

revoke delete on table "public"."usage_records" from "anon";

revoke insert on table "public"."usage_records" from "anon";

revoke references on table "public"."usage_records" from "anon";

revoke select on table "public"."usage_records" from "anon";

revoke trigger on table "public"."usage_records" from "anon";

revoke truncate on table "public"."usage_records" from "anon";

revoke update on table "public"."usage_records" from "anon";

revoke delete on table "public"."usage_records" from "authenticated";

revoke insert on table "public"."usage_records" from "authenticated";

revoke references on table "public"."usage_records" from "authenticated";

revoke select on table "public"."usage_records" from "authenticated";

revoke trigger on table "public"."usage_records" from "authenticated";

revoke truncate on table "public"."usage_records" from "authenticated";

revoke update on table "public"."usage_records" from "authenticated";

revoke delete on table "public"."usage_records" from "service_role";

revoke insert on table "public"."usage_records" from "service_role";

revoke references on table "public"."usage_records" from "service_role";

revoke select on table "public"."usage_records" from "service_role";

revoke trigger on table "public"."usage_records" from "service_role";

revoke truncate on table "public"."usage_records" from "service_role";

revoke update on table "public"."usage_records" from "service_role";

revoke delete on table "public"."user_plans" from "anon";

revoke insert on table "public"."user_plans" from "anon";

revoke references on table "public"."user_plans" from "anon";

revoke select on table "public"."user_plans" from "anon";

revoke trigger on table "public"."user_plans" from "anon";

revoke truncate on table "public"."user_plans" from "anon";

revoke update on table "public"."user_plans" from "anon";

revoke delete on table "public"."user_plans" from "authenticated";

revoke insert on table "public"."user_plans" from "authenticated";

revoke references on table "public"."user_plans" from "authenticated";

revoke select on table "public"."user_plans" from "authenticated";

revoke trigger on table "public"."user_plans" from "authenticated";

revoke truncate on table "public"."user_plans" from "authenticated";

revoke update on table "public"."user_plans" from "authenticated";

revoke delete on table "public"."user_plans" from "service_role";

revoke insert on table "public"."user_plans" from "service_role";

revoke references on table "public"."user_plans" from "service_role";

revoke select on table "public"."user_plans" from "service_role";

revoke trigger on table "public"."user_plans" from "service_role";

revoke truncate on table "public"."user_plans" from "service_role";

revoke update on table "public"."user_plans" from "service_role";

revoke delete on table "public"."users" from "anon";

revoke insert on table "public"."users" from "anon";

revoke references on table "public"."users" from "anon";

revoke select on table "public"."users" from "anon";

revoke trigger on table "public"."users" from "anon";

revoke truncate on table "public"."users" from "anon";

revoke update on table "public"."users" from "anon";

revoke delete on table "public"."users" from "authenticated";

revoke insert on table "public"."users" from "authenticated";

revoke references on table "public"."users" from "authenticated";

revoke select on table "public"."users" from "authenticated";

revoke trigger on table "public"."users" from "authenticated";

revoke truncate on table "public"."users" from "authenticated";

revoke update on table "public"."users" from "authenticated";

revoke delete on table "public"."users" from "service_role";

revoke insert on table "public"."users" from "service_role";

revoke references on table "public"."users" from "service_role";

revoke select on table "public"."users" from "service_role";

revoke trigger on table "public"."users" from "service_role";

revoke truncate on table "public"."users" from "service_role";

revoke update on table "public"."users" from "service_role";

alter table "public"."ping_stats" drop constraint "ping_stats_single_row";

alter table "public"."role_audit_log" drop constraint "role_audit_log_changed_by_fkey";

alter table "public"."role_audit_log" drop constraint "role_audit_log_user_id_fkey";

alter table "public"."chat_messages" drop constraint "chat_messages_role_check";

drop function if exists "public"."get_user_permissions"(p_user_id bigint);

drop function if exists "public"."increment_ping_count"();

drop function if exists "public"."log_role_change"();

drop function if exists "public"."user_has_permission"(p_user_id bigint, p_resource character varying, p_action character varying);

alter table "public"."ping_stats" drop constraint "ping_stats_pkey";

alter table "public"."role_audit_log" drop constraint "role_audit_log_pkey";

drop index if exists "public"."idx_role_audit_created_at";

drop index if exists "public"."idx_role_audit_user_id";

drop index if exists "public"."idx_role_permissions_resource";

drop index if exists "public"."idx_role_permissions_role";

drop index if exists "public"."ping_stats_pkey";

drop index if exists "public"."role_audit_log_pkey";

drop table "public"."ping_stats";

drop table "public"."role_audit_log";

create table "public"."referrals" (
    "id" integer not null default nextval('referrals_id_seq'::regclass),
    "referrer_id" integer,
    "referred_user_id" integer,
    "referral_code" character varying(8) not null,
    "bonus_amount" numeric(10,2) default 10.00,
    "status" character varying(20) default 'pending'::character varying,
    "created_at" timestamp with time zone default now(),
    "completed_at" timestamp with time zone
);


alter table "public"."referrals" enable row level security;

alter table "public"."api_keys_new" add column "auto_renew" boolean default false;

alter table "public"."api_keys_new" add column "is_trial" boolean default false;

alter table "public"."api_keys_new" add column "subscription_end_date" timestamp with time zone;

alter table "public"."api_keys_new" add column "subscription_plan" character varying(50) default 'free_trial'::character varying;

alter table "public"."api_keys_new" add column "subscription_start_date" timestamp with time zone;

alter table "public"."api_keys_new" add column "subscription_status" character varying(20) default 'trial'::character varying;

alter table "public"."api_keys_new" add column "trial_converted" boolean default false;

alter table "public"."api_keys_new" add column "trial_credits" numeric(10,2) default 10.00;

alter table "public"."api_keys_new" add column "trial_end_date" timestamp with time zone;

alter table "public"."api_keys_new" add column "trial_max_requests" integer default 1000;

alter table "public"."api_keys_new" add column "trial_max_tokens" integer default 100000;

alter table "public"."api_keys_new" add column "trial_start_date" timestamp with time zone;

alter table "public"."api_keys_new" add column "trial_used_credits" numeric(10,2) default 0.00;

alter table "public"."api_keys_new" add column "trial_used_requests" integer default 0;

alter table "public"."api_keys_new" add column "trial_used_tokens" integer default 0;

alter table "public"."role_permissions" drop column "updated_at";

alter table "public"."role_permissions" alter column "allowed" set default false;

alter table "public"."role_permissions" alter column "allowed" drop not null;

alter table "public"."role_permissions" alter column "id" set data type integer using "id"::integer;

alter table "public"."role_permissions" alter column "role" set data type character varying(20) using "role"::character varying(20);

alter table "public"."users" drop column "role_metadata";

alter table "public"."users" add column "balance" numeric(10,2) default 0.00;

alter table "public"."users" add column "has_made_first_purchase" boolean default false;

alter table "public"."users" add column "referral_code" character varying(8);

alter table "public"."users" add column "referred_by_code" character varying(8);

alter table "public"."users" alter column "role" set default 'user'::character varying;

alter table "public"."users" alter column "role" drop not null;

alter table "public"."users" alter column "role" set data type character varying(20) using "role"::character varying(20);

alter sequence "public"."referrals_id_seq" owned by "public"."referrals"."id";

drop sequence if exists "public"."role_audit_log_id_seq";

drop type "public"."user_role";

CREATE INDEX idx_api_keys_new_is_trial ON public.api_keys_new USING btree (is_trial);

CREATE INDEX idx_api_keys_new_subscription_status ON public.api_keys_new USING btree (subscription_status);

CREATE INDEX idx_api_keys_new_trial_dates ON public.api_keys_new USING btree (trial_start_date, trial_end_date);

CREATE INDEX idx_referrals_code ON public.referrals USING btree (referral_code);

CREATE INDEX idx_referrals_referred_user_id ON public.referrals USING btree (referred_user_id);

CREATE INDEX idx_referrals_referrer_id ON public.referrals USING btree (referrer_id);

CREATE INDEX idx_users_referral_code ON public.users USING btree (referral_code);

CREATE INDEX idx_users_referred_by_code ON public.users USING btree (referred_by_code);

CREATE UNIQUE INDEX referrals_pkey ON public.referrals USING btree (id);

alter table "public"."referrals" add constraint "referrals_pkey" PRIMARY KEY using index "referrals_pkey";

alter table "public"."referrals" add constraint "referrals_referred_user_id_fkey" FOREIGN KEY (referred_user_id) REFERENCES users(id) ON DELETE CASCADE not valid;

alter table "public"."referrals" validate constraint "referrals_referred_user_id_fkey";

alter table "public"."referrals" add constraint "referrals_referrer_id_fkey" FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE not valid;

alter table "public"."referrals" validate constraint "referrals_referrer_id_fkey";

alter table "public"."chat_messages" add constraint "chat_messages_role_check" CHECK (((role)::text = ANY ((ARRAY['user'::character varying, 'assistant'::character varying])::text[]))) not valid;

alter table "public"."chat_messages" validate constraint "chat_messages_role_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.generate_referral_code()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    characters TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(characters, floor(random() * length(characters) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_available_coupons(p_user_id bigint)
 RETURNS TABLE(coupon_id bigint, code character varying, value_usd numeric, coupon_scope coupon_scope_type, coupon_type coupon_type_enum, description text, valid_until timestamp with time zone, max_uses integer, times_used integer, remaining_uses integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.code,
    c.value_usd,
    c.coupon_scope,
    c.coupon_type,
    c.description,
    c.valid_until,
    c.max_uses,
    c.times_used,
    (c.max_uses - c.times_used) AS remaining_uses
  FROM public.coupons c
  WHERE c.is_active = true
    AND CURRENT_TIMESTAMP BETWEEN c.valid_from AND c.valid_until
    AND (
      -- User-specific coupons for this user
      (c.coupon_scope = 'user_specific' AND c.assigned_to_user_id = p_user_id)
      OR
      -- Global coupons not yet redeemed by this user
      (c.coupon_scope = 'global'
       AND c.times_used < c.max_uses
       AND NOT EXISTS (
         SELECT 1 FROM public.coupon_redemptions r
         WHERE r.coupon_id = c.id AND r.user_id = p_user_id
       ))
    )
  ORDER BY c.value_usd DESC, c.valid_until ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_coupon_redeemable(p_coupon_code character varying, p_user_id bigint)
 RETURNS TABLE(is_valid boolean, error_code character varying, error_message text, coupon_id bigint, coupon_value numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_coupon RECORD;
  v_already_redeemed BOOLEAN;
BEGIN
  -- Find the coupon (case-insensitive)
  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE UPPER(code) = UPPER(p_coupon_code);

  -- Check if coupon exists
  IF v_coupon IS NULL THEN
    RETURN QUERY SELECT false, 'COUPON_NOT_FOUND', 'Invalid coupon code', NULL::BIGINT, NULL::DECIMAL(10,2);
    RETURN;
  END IF;

  -- Check if active
  IF v_coupon.is_active = false THEN
    RETURN QUERY SELECT false, 'COUPON_INACTIVE', 'Coupon is no longer available', NULL::BIGINT, NULL::DECIMAL(10,2);
    RETURN;
  END IF;

  -- Check time validity
  IF CURRENT_TIMESTAMP < v_coupon.valid_from THEN
    RETURN QUERY SELECT false, 'COUPON_NOT_YET_ACTIVE', 'Coupon is not yet active', NULL::BIGINT, NULL::DECIMAL(10,2);
    RETURN;
  END IF;

  IF CURRENT_TIMESTAMP > v_coupon.valid_until THEN
    RETURN QUERY SELECT false, 'COUPON_EXPIRED', 'Coupon has expired', NULL::BIGINT, NULL::DECIMAL(10,2);
    RETURN;
  END IF;

  -- Check if user-specific and assigned to this user
  IF v_coupon.coupon_scope = 'user_specific' AND v_coupon.assigned_to_user_id != p_user_id THEN
    RETURN QUERY SELECT false, 'COUPON_NOT_ASSIGNED', 'This coupon is not valid for your account', NULL::BIGINT, NULL::DECIMAL(10,2);
    RETURN;
  END IF;

  -- Check max uses (for global coupons)
  IF v_coupon.coupon_scope = 'global' AND v_coupon.times_used >= v_coupon.max_uses THEN
    RETURN QUERY SELECT false, 'MAX_USES_EXCEEDED', 'Coupon has reached maximum usage limit', NULL::BIGINT, NULL::DECIMAL(10,2);
    RETURN;
  END IF;

  -- Check if user already redeemed this coupon
  SELECT EXISTS (
    SELECT 1 FROM public.coupon_redemptions
    WHERE coupon_id = v_coupon.id AND user_id = p_user_id
  ) INTO v_already_redeemed;

  IF v_already_redeemed THEN
    RETURN QUERY SELECT false, 'ALREADY_REDEEMED', 'You have already redeemed this coupon', NULL::BIGINT, NULL::DECIMAL(10,2);
    RETURN;
  END IF;

  -- All checks passed
  RETURN QUERY SELECT true, NULL::VARCHAR(50), NULL::TEXT, v_coupon.id, v_coupon.value_usd;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;



