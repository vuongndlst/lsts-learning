CREATE OR REPLACE FUNCTION learning_internal.portal_call(p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cid uuid; v_version integer; cc public.learning_class_courses; result jsonb;
BEGIN
 IF p_action<>'set_content_version' THEN
 result:=learning_internal.portal_call_v1(p_action,p_data);
 IF p_action='class_detail' AND NOT learning_internal.portal_class_access((p_data->>'class_id')::uuid,true) THEN
 result:=jsonb_set(result,'{meetings}',COALESCE((SELECT jsonb_agg(m) FROM jsonb_array_elements(COALESCE(result->'meetings','[]')) m WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(result->'assignments','[]')) a WHERE a->>'meeting_id'=m->>'meeting_id')),'[]'));
 ELSIF p_action='lesson' THEN result:=result||jsonb_build_object('read_only',EXISTS(SELECT 1 FROM public.learning_classes WHERE class_id=(p_data->>'class_id')::uuid AND status='archived'));
 END IF;RETURN result;
 END IF;
 cid:=(p_data->>'class_id')::uuid;v_version:=(p_data->>'version')::integer;
 IF NOT learning_internal.portal_class_access(cid,true) THEN RAISE EXCEPTION 'class_access_denied'; END IF;
 IF EXISTS(SELECT 1 FROM public.learning_classes WHERE class_id=cid AND status='archived') THEN RAISE EXCEPTION 'class_archived'; END IF;
 SELECT * INTO cc FROM public.learning_class_courses WHERE class_id=cid FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.learning_portal_releases r WHERE r.course_id=cc.course_id AND r.version=v_version) THEN RAISE EXCEPTION 'invalid_course_version'; END IF;
 UPDATE public.learning_class_courses SET content_version=v_version WHERE class_id=cid;
 INSERT INTO public.learning_audit_events(actor_id,class_id,action,details) VALUES(auth.uid(),cid,p_action,jsonb_build_object('from',cc.content_version,'to',v_version));
 RETURN jsonb_build_object('ok',true,'existing_assignments_preserved',true);
END $$;
DROP POLICY portal_meeting_read ON public.learning_meetings;
CREATE POLICY portal_meeting_read ON public.learning_meetings FOR SELECT TO authenticated USING(learning_internal.portal_class_access(class_id,true) OR (learning_internal.portal_class_access(class_id) AND EXISTS(SELECT 1 FROM public.learning_assignments a WHERE a.meeting_id=learning_meetings.meeting_id AND a.published AND (a.target_all OR learning_internal.portal_is_target(a.assignment_id)))));
ALTER TABLE public.learning_classes ADD CONSTRAINT portal_school_year_consecutive CHECK(right(school_year,4)::integer=left(school_year,4)::integer+1);
NOTIFY pgrst,'reload schema';

CREATE INDEX IF NOT EXISTS portal_fk_d7f9cd34c204 ON learning_internal.mutations(user_id);
CREATE INDEX IF NOT EXISTS portal_fk_79fa665e0edf ON public.learning_assignments(class_course_id,class_id);
CREATE INDEX IF NOT EXISTS portal_fk_b5e1497c5cb1 ON public.learning_assignments(created_by);
CREATE INDEX IF NOT EXISTS portal_fk_de1a42763a91 ON public.learning_assignments(lesson_id);
CREATE INDEX IF NOT EXISTS portal_fk_cc11c9150acb ON public.learning_assignments(meeting_id);
CREATE INDEX IF NOT EXISTS portal_fk_d6a0a0506e94 ON public.learning_attempts(enrollment_id,user_id,course_id);
CREATE INDEX IF NOT EXISTS portal_fk_a6ccf8d64f90 ON public.learning_attempts(lesson_id,course_id);
CREATE INDEX IF NOT EXISTS portal_fk_4fe2a034e55f ON public.learning_audit_events(actor_id);
CREATE INDEX IF NOT EXISTS portal_fk_5c9ec3146908 ON public.learning_class_courses(course_id);
CREATE INDEX IF NOT EXISTS portal_fk_eafe8b26d011 ON public.learning_classes(owner_id);
CREATE INDEX IF NOT EXISTS portal_fk_e518e63a8b4a ON public.learning_content(lesson_id,course_id);
CREATE INDEX IF NOT EXISTS portal_fk_7c4f06151e4e ON public.learning_enrollments(run_id,course_id);
CREATE INDEX IF NOT EXISTS portal_fk_cf0055a2665e ON public.learning_practice(enrollment_id,user_id,course_id);
CREATE INDEX IF NOT EXISTS portal_fk_b6dba8efa78a ON public.learning_practice(lesson_id,course_id);
CREATE INDEX IF NOT EXISTS portal_fk_929131674e77 ON public.learning_progress(enrollment_id,user_id,course_id);
CREATE INDEX IF NOT EXISTS portal_fk_9f0c3f79974c ON public.learning_progress(lesson_id,course_id);
CREATE INDEX IF NOT EXISTS portal_fk_cbf9bc15940a ON public.learning_project_members(project_id,run_id);
CREATE INDEX IF NOT EXISTS portal_fk_712f4edc1a2d ON public.learning_project_reviews(project_id,version);
CREATE INDEX IF NOT EXISTS portal_fk_3d95a2ef5004 ON public.learning_project_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS portal_fk_35d609f80ba5 ON public.learning_project_submissions(submitted_by);
CREATE INDEX IF NOT EXISTS portal_fk_aec887e7ba07 ON public.learning_projects(owner_id);
CREATE INDEX IF NOT EXISTS portal_fk_03c82e8c3336 ON public.learning_projects(run_id);
CREATE INDEX IF NOT EXISTS portal_fk_b44b7d867a8f ON public.learning_staff(run_id);
CREATE INDEX IF NOT EXISTS portal_fk_4e53a4163542 ON public.learning_teacher_course_grants(course_id);



