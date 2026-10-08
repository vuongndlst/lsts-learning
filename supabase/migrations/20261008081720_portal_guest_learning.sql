-- Guests can read published course material, never class data or stored work.
CREATE FUNCTION learning_internal.guest_call(p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE course text; current_version integer; lid uuid;
BEGIN
 IF p_action='courses' THEN
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('course_id',c.course_id,'title',c.title,'version',r.version,'lesson_count',jsonb_array_length(r.manifest)) ORDER BY c.title) FROM public.learning_courses c JOIN LATERAL(SELECT version,manifest FROM public.learning_portal_releases WHERE course_id=c.course_id ORDER BY version DESC LIMIT 1) r ON true WHERE c.published),'[]');
 ELSIF p_action='lessons' THEN
 course:=p_data->>'course_id';SELECT max(version) INTO current_version FROM public.learning_portal_releases WHERE course_id=course;
 IF NOT EXISTS(SELECT 1 FROM public.learning_courses WHERE course_id=course AND published) THEN RAISE EXCEPTION 'course_unavailable'; END IF;
 RETURN COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY position) FROM public.learning_lessons l WHERE course_id=course AND content_version=current_version),'[]');
 ELSIF p_action='lesson' THEN
 lid:=(p_data->>'lesson_id')::uuid;
 SELECT l.course_id INTO course FROM public.learning_lessons l JOIN public.learning_courses c USING(course_id) WHERE l.lesson_id=lid AND c.published AND l.content_version=(SELECT max(version) FROM public.learning_portal_releases r WHERE r.course_id=l.course_id);
 IF course IS NULL THEN RAISE EXCEPTION 'lesson_unavailable'; END IF;
 RETURN jsonb_build_object('course_id',course,'lesson',(SELECT to_jsonb(l) FROM public.learning_lessons l WHERE lesson_id=lid),'payload',(SELECT string_agg(source,'' ORDER BY block)::jsonb FROM public.learning_portal_blocks WHERE lesson_id=lid),'progress',jsonb_build_object('state','{}'::jsonb,'revision',0),'self_study',true,'guest',true,'read_only',false);
 END IF;
 RAISE EXCEPTION 'guest_read_only';
END $$;
CREATE FUNCTION public.learning_guest_call(p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT learning_internal.guest_call(p_action,p_data); $$;
REVOKE ALL ON FUNCTION public.learning_guest_call(text,jsonb),learning_internal.guest_call(text,jsonb) FROM public;
GRANT USAGE ON SCHEMA learning_internal TO anon;
GRANT EXECUTE ON FUNCTION public.learning_guest_call(text,jsonb),learning_internal.guest_call(text,jsonb) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
