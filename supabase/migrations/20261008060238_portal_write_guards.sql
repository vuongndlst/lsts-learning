CREATE OR REPLACE FUNCTION learning_internal.save_practice(p_event uuid, p_enrollment uuid, p_lesson uuid, p_kind text, p_code text, p_summary jsonb, p_snapshot text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE e public.learning_enrollments; old public.learning_practice;
BEGIN
 PERFORM learning_internal.portal_legacy_gate(p_enrollment,p_lesson);
 SELECT * INTO e FROM public.learning_enrollments WHERE enrollment_id=p_enrollment AND user_id=auth.uid() AND status='active';
 IF auth.uid() IS NULL OR e.enrollment_id IS NULL THEN RAISE EXCEPTION 'enrollment_required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.learning_lessons WHERE lesson_id=p_lesson AND course_id=e.course_id) THEN RAISE EXCEPTION 'lesson_not_in_course'; END IF;
 -- Serialize retention checks, including when two devices append simultaneously.
 PERFORM 1 FROM public.learning_enrollments WHERE enrollment_id=p_enrollment FOR UPDATE;
 SELECT * INTO old FROM public.learning_practice WHERE event_id=p_event;
 IF FOUND THEN
  IF old.user_id<>auth.uid() OR old.enrollment_id<>p_enrollment OR old.lesson_id<>p_lesson THEN RAISE EXCEPTION 'event_owner_mismatch'; END IF;
  RETURN jsonb_build_object('ok',true,'duplicate',true);
 END IF;
 INSERT INTO public.learning_practice(event_id,enrollment_id,user_id,course_id,lesson_id,kind,code,summary,snapshot_sql)
 VALUES(p_event,e.enrollment_id,e.user_id,e.course_id,p_lesson,p_kind,p_code,p_summary,p_snapshot);
 -- Keep 30 events, 3 full backups, and <=300 KB per learner/lesson. Never prune other users.
 DELETE FROM public.learning_practice WHERE event_id IN (
 SELECT event_id FROM (SELECT event_id,row_number() OVER(ORDER BY created_at DESC,event_id) AS n,
 sum(octet_length(code)+octet_length(summary::text)+coalesce(octet_length(snapshot_sql),0)) OVER(ORDER BY created_at DESC,event_id) AS bytes
 FROM public.learning_practice WHERE enrollment_id=p_enrollment AND lesson_id=p_lesson) x WHERE n>30 OR bytes>300000);
 DELETE FROM public.learning_practice WHERE event_id IN (SELECT event_id FROM (
 SELECT event_id,row_number() OVER(ORDER BY created_at DESC,event_id) AS n FROM public.learning_practice
 WHERE enrollment_id=p_enrollment AND lesson_id=p_lesson AND snapshot_sql IS NOT NULL) x WHERE n>3);
 RETURN jsonb_build_object('ok',true);
END $function$
;
NOTIFY pgrst,'reload schema';
