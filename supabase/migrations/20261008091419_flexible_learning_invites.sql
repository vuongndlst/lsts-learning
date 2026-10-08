-- Additive release. Existing classes, schedules, releases and progress are preserved.
CREATE TABLE learning_internal.portal_invites (
 class_id uuid PRIMARY KEY REFERENCES public.learning_classes ON DELETE CASCADE,
 token text NOT NULL UNIQUE CHECK(token ~ '^[a-f0-9]{64}$'), created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE learning_internal.portal_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON learning_internal.portal_invites FROM public,anon,authenticated;
GRANT ALL ON learning_internal.portal_invites TO service_role;
CREATE TABLE public.learning_selfstudy_enrollments (
 user_id uuid REFERENCES auth.users ON DELETE CASCADE, course_id text REFERENCES public.learning_courses,
 enrollment_id uuid NOT NULL UNIQUE REFERENCES public.learning_enrollments ON DELETE CASCADE,
 PRIMARY KEY(user_id,course_id)
);
CREATE TABLE public.learning_course_certificates (
 certificate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
 course_id text NOT NULL REFERENCES public.learning_courses,content_version integer NOT NULL,
 issued_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,course_id)
);
ALTER TABLE public.learning_selfstudy_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_course_certificates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.learning_selfstudy_enrollments,public.learning_course_certificates FROM public,anon,authenticated;
GRANT ALL ON public.learning_selfstudy_enrollments,public.learning_course_certificates TO service_role;
GRANT SELECT ON public.learning_selfstudy_enrollments,public.learning_course_certificates TO authenticated;
CREATE POLICY selfstudy_own ON public.learning_selfstudy_enrollments FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY certificates_own ON public.learning_course_certificates FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE INDEX selfstudy_course_fk ON public.learning_selfstudy_enrollments(course_id);
CREATE INDEX certificate_course_fk ON public.learning_course_certificates(course_id);
CREATE FUNCTION learning_internal.invitation_preview(p_token text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE((SELECT jsonb_build_object('name',c.name,'school_year',c.school_year,'course_title',co.title)
 FROM learning_internal.portal_invites i JOIN public.learning_classes c USING(class_id)
 JOIN public.learning_class_courses cc USING(class_id) JOIN public.learning_courses co USING(course_id)
 WHERE i.token=p_token AND c.join_open AND c.status='active'),'{}');
$$;
CREATE FUNCTION public.learning_invitation_preview(p_token text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT learning_internal.invitation_preview(p_token); $$;
REVOKE ALL ON FUNCTION learning_internal.invitation_preview(text),public.learning_invitation_preview(text) FROM public;
GRANT EXECUTE ON FUNCTION learning_internal.invitation_preview(text),public.learning_invitation_preview(text) TO anon,authenticated;
CREATE OR REPLACE FUNCTION learning_internal.portal_lesson_access(p_class uuid,p_lesson uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT learning_internal.portal_class_access(p_class) AND EXISTS(
 SELECT 1 FROM public.learning_class_courses cc JOIN public.learning_classes c USING(class_id)
 JOIN public.learning_lessons l ON l.course_id=cc.course_id WHERE cc.class_id=p_class AND l.lesson_id=p_lesson
 AND (c.status IN ('active','archived') OR learning_internal.portal_class_access(p_class,true))
 AND (l.content_version=cc.content_version OR EXISTS(SELECT 1 FROM public.learning_assignments a WHERE a.class_id=p_class AND a.lesson_id=p_lesson AND a.published)));
$$;
ALTER FUNCTION learning_internal.portal_legacy_gate(uuid,uuid) RENAME TO portal_legacy_gate_v1;
REVOKE ALL ON FUNCTION learning_internal.portal_legacy_gate_v1(uuid,uuid) FROM public,anon,authenticated;
CREATE FUNCTION learning_internal.portal_legacy_gate(p_enrollment uuid,p_lesson uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.learning_selfstudy_enrollments e WHERE e.enrollment_id=p_enrollment AND e.user_id=auth.uid()) THEN
 IF NOT learning_internal.portal_session_ok() OR EXISTS(SELECT 1 FROM public.learning_portal_security WHERE user_id=auth.uid() AND must_change_password) THEN RAISE EXCEPTION 'authentication_required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.learning_selfstudy_enrollments e JOIN public.learning_lessons l USING(course_id) JOIN public.learning_courses c USING(course_id) JOIN public.learning_portal_releases r ON r.course_id=l.course_id AND r.version=l.content_version WHERE e.enrollment_id=p_enrollment AND e.user_id=auth.uid() AND l.lesson_id=p_lesson AND c.published) THEN RAISE EXCEPTION 'lesson_not_in_course'; END IF;
 ELSE PERFORM learning_internal.portal_legacy_gate_v1(p_enrollment,p_lesson); END IF;
END $$;
REVOKE ALL ON FUNCTION learning_internal.portal_legacy_gate(uuid,uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION learning_internal.portal_legacy_gate(uuid,uuid) TO authenticated;
ALTER FUNCTION learning_internal.portal_call(text,jsonb) RENAME TO portal_call_v2;
REVOKE ALL ON FUNCTION learning_internal.portal_call_v2(text,jsonb) FROM public,anon,authenticated;
CREATE FUNCTION learning_internal.portal_call(p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_column
DECLARE who uuid:=auth.uid(); cid uuid; lid uuid; eid uuid; rid uuid; course text; result jsonb; token text; cnt integer; cc public.learning_class_courses; version integer; cert jsonb; stats jsonb;
BEGIN
 IF NOT learning_internal.portal_session_ok() THEN RAISE EXCEPTION 'authentication_required'; END IF;
 IF p_action<>'bootstrap' AND EXISTS(SELECT 1 FROM public.learning_portal_security WHERE user_id=who AND must_change_password) THEN RAISE EXCEPTION 'password_change_required'; END IF;
 IF p_action='class_invite' THEN
 cid:=(p_data->>'class_id')::uuid;
 IF NOT learning_internal.portal_class_access(cid,true) THEN RAISE EXCEPTION 'class_access_denied'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.learning_classes WHERE class_id=cid AND status='active' AND join_open) THEN RETURN jsonb_build_object('closed',true); END IF;
 IF COALESCE((p_data->>'rotate')::boolean,false) THEN DELETE FROM learning_internal.portal_invites WHERE class_id=cid; END IF;
 INSERT INTO learning_internal.portal_invites(class_id,token) VALUES(cid,replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','')) ON CONFLICT(class_id) DO NOTHING;
 SELECT i.token INTO token FROM learning_internal.portal_invites i WHERE class_id=cid;
 RETURN jsonb_build_object('token',token);
 ELSIF p_action='join_link' THEN
 INSERT INTO learning_internal.portal_join_limits(user_id,slot) VALUES(who,date_trunc('hour',now())) ON CONFLICT(user_id,slot) DO UPDATE SET attempts=learning_internal.portal_join_limits.attempts+1 RETURNING attempts INTO cnt;
 IF cnt>20 THEN RETURN jsonb_build_object('error','join_rate_limit'); END IF;
 SELECT c.class_id INTO cid FROM learning_internal.portal_invites i JOIN public.learning_classes c USING(class_id) WHERE i.token=p_data->>'token' AND c.join_open AND c.status='active';
 IF cid IS NULL THEN RETURN jsonb_build_object('error','invalid_join_link'); END IF;
 IF EXISTS(SELECT 1 FROM public.learning_class_members WHERE class_id=cid AND user_id=who AND status='removed') THEN RETURN jsonb_build_object('error','member_removed'); END IF;
 INSERT INTO public.learning_class_members(class_id,user_id,academic_snapshot) SELECT cid,who,class_label FROM public.learning_profiles WHERE user_id=who ON CONFLICT DO NOTHING;
 SELECT * INTO cc FROM public.learning_class_courses WHERE class_id=cid;
 eid:=learning_internal.portal_enrollment(cc.class_course_id);
 INSERT INTO public.learning_audit_events(actor_id,class_id,action) VALUES(who,cid,p_action);
 RETURN jsonb_build_object('class_id',cid,'enrollment_id',eid);
 ELSIF p_action IN ('learn_lesson','save_selfstudy_progress','selfstudy_attempt') THEN
 lid:=(p_data->>'lesson_id')::uuid;
 result:=learning_internal.guest_call('lesson',jsonb_build_object('lesson_id',lid));course:=result->>'course_id';
 INSERT INTO public.learning_course_runs(course_id,label,registration_open) VALUES(course,'Tự học · '||course,false) ON CONFLICT(course_id,label) DO NOTHING;
 SELECT run_id INTO rid FROM public.learning_course_runs WHERE course_id=course AND label='Tự học · '||course;
 INSERT INTO public.learning_enrollments(user_id,run_id,course_id) VALUES(who,rid,course) ON CONFLICT(user_id,run_id) DO NOTHING;
 SELECT enrollment_id INTO eid FROM public.learning_enrollments WHERE user_id=who AND run_id=rid AND status='active';
 IF eid IS NULL THEN RAISE EXCEPTION 'enrollment_not_active'; END IF;
 INSERT INTO public.learning_selfstudy_enrollments(user_id,course_id,enrollment_id) VALUES(who,course,eid) ON CONFLICT DO NOTHING;
 INSERT INTO public.learning_progress(enrollment_id,user_id,course_id,lesson_id) VALUES(eid,who,course,lid) ON CONFLICT DO NOTHING;
 IF p_action='save_selfstudy_progress' THEN RETURN learning_internal.save_progress(eid,lid,(p_data->>'revision')::integer,p_data->'state',(p_data->>'mutation_id')::uuid); END IF;
 IF p_action='selfstudy_attempt' THEN RETURN learning_internal.record_attempt(eid,lid,(p_data->>'attempt_id')::uuid,p_data->'payload'); END IF;
 RETURN result||jsonb_build_object('guest',false,'enrollment_id',eid,'run_id',rid,'progress',(SELECT to_jsonb(p) FROM public.learning_progress p WHERE enrollment_id=eid AND lesson_id=lid));
 ELSIF p_action='course_stats' THEN
 course:=p_data->>'course_id';SELECT max(r.version) INTO version FROM public.learning_portal_releases r WHERE r.course_id=course;
 WITH owned AS (SELECT l.lesson_key,bool_or(COALESCE(p.state->>'completed','false')='true' OR COALESCE(p.state->>'dat','false')='true' OR length(COALESCE(p.state->>'completedAt',''))>0) completed,
 max(CASE WHEN p.state->>'xp' ~ '^[0-9]{1,6}$' THEN least((p.state->>'xp')::integer,10000) ELSE 0 END) xp
 FROM public.learning_progress p JOIN public.learning_lessons l USING(lesson_id) WHERE p.user_id=who AND p.course_id=course GROUP BY l.lesson_key),
 current AS (SELECT l.lesson_id,l.lesson_key,l.title,COALESCE(o.completed,false) completed,COALESCE(o.xp,0) xp FROM public.learning_lessons l LEFT JOIN owned o USING(lesson_key) WHERE l.course_id=course AND l.content_version=version)
 SELECT jsonb_build_object('total',count(*),'completed',count(*) FILTER(WHERE completed),'xp',COALESCE(sum(xp),0),'lessons',COALESCE(jsonb_agg(to_jsonb(current)),'[]')) INTO stats FROM current;
 IF (stats->>'total')::integer>0 AND stats->>'total'=stats->>'completed' THEN INSERT INTO public.learning_course_certificates(user_id,course_id,content_version) VALUES(who,course,version) ON CONFLICT(user_id,course_id) DO NOTHING; END IF;
 SELECT to_jsonb(c) INTO cert FROM public.learning_course_certificates c WHERE user_id=who AND course_id=course;
 RETURN stats||jsonb_build_object('certificate',cert,'profile',(SELECT to_jsonb(p) FROM public.learning_profiles p WHERE user_id=who));
 END IF;
 result:=learning_internal.portal_call_v2(p_action,p_data);
 IF p_action='lesson' THEN result:=result||jsonb_build_object('self_study',true);
 ELSIF p_action='class_detail' THEN
 cid:=(p_data->>'class_id')::uuid;SELECT * INTO cc FROM public.learning_class_courses WHERE class_id=cid;
 result:=result||jsonb_build_object('lessons',COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY position) FROM public.learning_lessons l WHERE l.course_id=cc.course_id AND l.content_version=cc.content_version),'[]'));
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION learning_internal.portal_call(text,jsonb) FROM public,anon;
GRANT EXECUTE ON FUNCTION learning_internal.portal_call(text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.learning_portal_call(p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT learning_internal.portal_call(p_action,p_data); $$;
NOTIFY pgrst,'reload schema';
