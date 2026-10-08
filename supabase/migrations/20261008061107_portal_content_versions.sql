ALTER FUNCTION learning_internal.portal_call(text,jsonb) RENAME TO portal_call_v1;
REVOKE ALL ON FUNCTION learning_internal.portal_call_v1(text,jsonb) FROM public,anon,authenticated;
CREATE FUNCTION learning_internal.portal_call(p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cid uuid; version integer; cc public.learning_class_courses;
BEGIN
 IF p_action<>'set_content_version' THEN RETURN learning_internal.portal_call_v1(p_action,p_data); END IF;
 cid:=(p_data->>'class_id')::uuid;version:=(p_data->>'version')::integer;
 IF NOT learning_internal.portal_class_access(cid,true) THEN RAISE EXCEPTION 'class_access_denied'; END IF;
 IF EXISTS(SELECT 1 FROM public.learning_classes WHERE class_id=cid AND status='archived') THEN RAISE EXCEPTION 'class_archived'; END IF;
 SELECT * INTO cc FROM public.learning_class_courses WHERE class_id=cid FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.learning_portal_releases WHERE course_id=cc.course_id AND learning_portal_releases.version=version) THEN RAISE EXCEPTION 'invalid_course_version'; END IF;
 UPDATE public.learning_class_courses SET content_version=version WHERE class_id=cid;
 INSERT INTO public.learning_audit_events(actor_id,class_id,action,details) VALUES(auth.uid(),cid,p_action,jsonb_build_object('from',cc.content_version,'to',version));
 RETURN jsonb_build_object('ok',true,'existing_assignments_preserved',true);
END $$;
REVOKE ALL ON FUNCTION learning_internal.portal_call(text,jsonb) FROM public,anon;
GRANT EXECUTE ON FUNCTION learning_internal.portal_call(text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.learning_portal_call(p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT learning_internal.portal_call(p_action,p_data); $$;
NOTIFY pgrst,'reload schema';
