-- Read-only regression assertions. No notifications, emails or profile writes.
-- Each assertion fails by division by zero if its concrete rule regresses.
SELECT 1 / CASE WHEN public.notification_preference_allows(NULL,'in_app','Provider selected',false) THEN 1 ELSE 0 END AS acceptance_required;
SELECT 1 / CASE WHEN public.notification_preference_allows(NULL,'in_app','Network completion recorded',false) THEN 1 ELSE 0 END AS completion_required;
SELECT 1 / CASE WHEN public.notification_preference_allows(NULL,'email','Network payment disputed',false) THEN 1 ELSE 0 END AS disputes_required;
SELECT 1 / CASE WHEN public.notification_preference_allows(NULL,'email','Network payment overdue',false) THEN 1 ELSE 0 END AS deadlines_required;
SELECT 1 / CASE WHEN public.notification_preference_allows(NULL,'email','New offer received',true) THEN 1 ELSE 0 END AS required_override;
SELECT 1 / CASE WHEN public.notification_preference_allows(NULL,'in_app','unmapped event',false) THEN 1 ELSE 0 END AS unmapped_unchanged;
SELECT 1 / CASE WHEN public.notification_preference_allows(NULL,'in_app','New offer received',false) THEN 1 ELSE 0 END AS missing_preference_default;