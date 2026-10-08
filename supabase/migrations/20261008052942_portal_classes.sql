-- Additive portal foundation. Existing course runs, enrollments and progress are retained.
CREATE TABLE public.learning_portal_security (
 user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
 must_change_password boolean NOT NULL DEFAULT false, portal_only boolean NOT NULL DEFAULT false,
 changed_at timestamptz
);
CREATE TABLE public.learning_teacher_course_grants (
 user_id uuid REFERENCES auth.users ON DELETE CASCADE,
 course_id text REFERENCES public.learning_courses, PRIMARY KEY(user_id,course_id)
);
CREATE TABLE public.learning_classes (
 class_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 80),
 school_year text NOT NULL CHECK(school_year ~ '^20[0-9]{2}-20[0-9]{2}$'),
 owner_id uuid NOT NULL REFERENCES auth.users, status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','archived')),
 join_open boolean NOT NULL DEFAULT false, request_id uuid NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(name,school_year)
);
CREATE TABLE public.learning_class_teachers (
 class_id uuid REFERENCES public.learning_classes ON DELETE CASCADE, user_id uuid REFERENCES auth.users ON DELETE CASCADE,
 role text NOT NULL DEFAULT 'teacher' CHECK(role IN ('owner','teacher','assistant')), PRIMARY KEY(class_id,user_id)
);
CREATE TABLE public.learning_class_courses (
 class_course_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), class_id uuid NOT NULL REFERENCES public.learning_classes ON DELETE CASCADE,
 course_id text NOT NULL REFERENCES public.learning_courses, run_id uuid NOT NULL UNIQUE REFERENCES public.learning_course_runs,
 content_version integer NOT NULL DEFAULT 1 CHECK(content_version>0), UNIQUE(class_id,course_id), UNIQUE(class_course_id,class_id)
);
CREATE TABLE public.learning_class_members (
 class_id uuid REFERENCES public.learning_classes ON DELETE CASCADE, user_id uuid REFERENCES auth.users ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','removed')), academic_snapshot text NOT NULL DEFAULT '',
 joined_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(class_id,user_id)
);
CREATE TABLE public.learning_class_enrollments (
 class_course_id uuid REFERENCES public.learning_class_courses ON DELETE CASCADE,
 user_id uuid REFERENCES auth.users ON DELETE CASCADE, enrollment_id uuid NOT NULL UNIQUE REFERENCES public.learning_enrollments,
 legacy_link boolean NOT NULL DEFAULT false, PRIMARY KEY(class_course_id,user_id)
);
CREATE TABLE public.learning_meetings (
 meeting_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), class_id uuid NOT NULL REFERENCES public.learning_classes ON DELETE CASCADE,
 starts_at timestamptz NOT NULL, duration integer NOT NULL CHECK(duration BETWEEN 15 AND 240), room text NOT NULL DEFAULT '',
 cancelled boolean NOT NULL DEFAULT false, series_id uuid, request_id uuid NOT NULL UNIQUE
);
CREATE TABLE public.learning_assignments (
 assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), class_id uuid NOT NULL REFERENCES public.learning_classes,
 class_course_id uuid NOT NULL, lesson_id uuid NOT NULL REFERENCES public.learning_lessons,
 meeting_id uuid REFERENCES public.learning_meetings, release_at timestamptz NOT NULL, catchup_at timestamptz NOT NULL,
 due_at timestamptz, published boolean NOT NULL DEFAULT true, target_all boolean NOT NULL DEFAULT true,
 created_by uuid NOT NULL REFERENCES auth.users, request_id uuid NOT NULL UNIQUE,
 CHECK(catchup_at>=release_at), CHECK(due_at IS NULL OR due_at>=release_at),
 FOREIGN KEY(class_course_id,class_id) REFERENCES public.learning_class_courses(class_course_id,class_id)
);
CREATE TABLE public.learning_assignment_targets (
 assignment_id uuid REFERENCES public.learning_assignments ON DELETE CASCADE, user_id uuid REFERENCES auth.users ON DELETE CASCADE,
 PRIMARY KEY(assignment_id,user_id)
);
CREATE TABLE public.learning_portal_blocks (
 lesson_id uuid REFERENCES public.learning_lessons, block integer NOT NULL, source text NOT NULL CHECK(octet_length(source)<=200000),
 hash text NOT NULL, PRIMARY KEY(lesson_id,block)
);
CREATE TABLE public.learning_portal_releases (
 course_id text REFERENCES public.learning_courses, version integer NOT NULL, manifest jsonb NOT NULL, published_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(course_id,version)
);
CREATE TABLE public.learning_audit_events (
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid REFERENCES auth.users ON DELETE SET NULL,
 class_id uuid REFERENCES public.learning_classes, action text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE learning_internal.portal_codes (
 class_id uuid PRIMARY KEY REFERENCES public.learning_classes ON DELETE CASCADE, code_hash text NOT NULL UNIQUE,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE learning_internal.portal_join_limits (
 user_id uuid REFERENCES auth.users ON DELETE CASCADE, slot timestamptz, attempts integer NOT NULL DEFAULT 1,
 PRIMARY KEY(user_id,slot)
);
CREATE INDEX portal_teachers_user ON public.learning_class_teachers(user_id,class_id);
CREATE INDEX portal_members_user ON public.learning_class_members(user_id,class_id);
CREATE INDEX portal_meetings_class_time ON public.learning_meetings(class_id,starts_at);
CREATE INDEX portal_assignments_class ON public.learning_assignments(class_id,lesson_id);
CREATE INDEX portal_enrollments_user ON public.learning_class_enrollments(user_id);
CREATE INDEX portal_targets_user ON public.learning_assignment_targets(user_id,assignment_id);
CREATE INDEX portal_audit_class ON public.learning_audit_events(class_id,created_at);

CREATE FUNCTION learning_internal.portal_session_ok() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM auth.sessions s WHERE s.user_id=auth.uid() AND s.id::text=auth.jwt()->>'session_id');
$$;
CREATE FUNCTION learning_internal.portal_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT learning_internal.portal_session_ok() AND NOT EXISTS(SELECT 1 FROM public.learning_portal_security s WHERE s.user_id=auth.uid() AND s.must_change_password)
 AND EXISTS(SELECT 1 FROM public.learning_admins a WHERE a.user_id=auth.uid());
$$;
CREATE FUNCTION learning_internal.portal_class_access(p_class uuid,p_write boolean DEFAULT false) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT learning_internal.portal_session_ok()
 AND NOT EXISTS(SELECT 1 FROM public.learning_portal_security s WHERE s.user_id=auth.uid() AND s.must_change_password)
 AND (learning_internal.portal_admin() OR EXISTS(SELECT 1 FROM public.learning_class_teachers t WHERE t.class_id=p_class AND t.user_id=auth.uid())
 OR (NOT p_write AND EXISTS(SELECT 1 FROM public.learning_class_members m WHERE m.class_id=p_class AND m.user_id=auth.uid() AND m.status='active')));
$$;
CREATE FUNCTION learning_internal.portal_lesson_access(p_class uuid,p_lesson uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT learning_internal.portal_class_access(p_class) AND
 (learning_internal.portal_class_access(p_class,true) OR EXISTS(
 SELECT 1 FROM public.learning_assignments a JOIN public.learning_classes c USING(class_id)
 WHERE a.class_id=p_class AND a.lesson_id=p_lesson AND a.published AND a.release_at<=now() AND c.status IN ('active','archived')
 AND (a.target_all OR EXISTS(SELECT 1 FROM public.learning_assignment_targets t WHERE t.assignment_id=a.assignment_id AND t.user_id=auth.uid()))));
$$;
CREATE FUNCTION learning_internal.portal_enrollment(p_link uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cc public.learning_class_courses; eid uuid; who uuid:=auth.uid();
BEGIN
 SELECT * INTO cc FROM public.learning_class_courses WHERE class_course_id=p_link;
 IF NOT learning_internal.portal_class_access(cc.class_id) THEN RAISE EXCEPTION 'class_access_denied'; END IF;
 SELECT enrollment_id INTO eid FROM public.learning_class_enrollments WHERE class_course_id=p_link AND user_id=who;
 IF eid IS NOT NULL THEN RETURN eid; END IF;
 INSERT INTO public.learning_enrollments(user_id,run_id,course_id) VALUES(who,cc.run_id,cc.course_id) ON CONFLICT(user_id,run_id) DO NOTHING;
 SELECT enrollment_id INTO eid FROM public.learning_enrollments WHERE user_id=who AND run_id=cc.run_id;
 INSERT INTO public.learning_class_enrollments(class_course_id,user_id,enrollment_id) VALUES(p_link,who,eid);
 RETURN eid;
END $$;
CREATE FUNCTION learning_internal.portal_is_target(p_assignment uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.learning_assignment_targets WHERE assignment_id=p_assignment AND user_id=auth.uid());
$$;
CREATE FUNCTION learning_internal.portal_assignment_staff(p_assignment uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.learning_assignments WHERE assignment_id=p_assignment AND learning_internal.portal_class_access(class_id,true));
$$;

DO $rls$ DECLARE n text; BEGIN
 FOR n IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND (tablename IN ('learning_teacher_course_grants','learning_classes','learning_class_teachers','learning_class_courses','learning_class_members','learning_class_enrollments','learning_meetings','learning_assignments','learning_assignment_targets','learning_audit_events') OR tablename LIKE 'learning_portal_%') LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',n);
 EXECUTE format('REVOKE ALL ON public.%I FROM public,anon,authenticated',n);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',n);
 END LOOP;
END $rls$;
ALTER TABLE learning_internal.portal_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_internal.portal_join_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON learning_internal.portal_codes,learning_internal.portal_join_limits FROM public,anon,authenticated;
GRANT SELECT ON public.learning_portal_security,public.learning_teacher_course_grants,public.learning_classes,
 public.learning_class_teachers,public.learning_class_courses,public.learning_class_members,public.learning_class_enrollments,
 public.learning_meetings,public.learning_assignments,public.learning_assignment_targets,public.learning_audit_events TO authenticated;
CREATE POLICY portal_security_self ON public.learning_portal_security FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) OR learning_internal.portal_admin());
CREATE POLICY portal_grants_self ON public.learning_teacher_course_grants FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) OR learning_internal.portal_admin());
CREATE POLICY portal_class_read ON public.learning_classes FOR SELECT TO authenticated USING(learning_internal.portal_class_access(class_id));
CREATE POLICY portal_teacher_read ON public.learning_class_teachers FOR SELECT TO authenticated USING(learning_internal.portal_class_access(class_id));
CREATE POLICY portal_course_read ON public.learning_class_courses FOR SELECT TO authenticated USING(learning_internal.portal_class_access(class_id));
CREATE POLICY portal_member_read ON public.learning_class_members FOR SELECT TO authenticated USING(learning_internal.portal_class_access(class_id,true) OR (user_id=(SELECT auth.uid()) AND learning_internal.portal_class_access(class_id)));
CREATE POLICY portal_enrollment_read ON public.learning_class_enrollments FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.learning_class_courses c WHERE c.class_course_id=learning_class_enrollments.class_course_id AND learning_internal.portal_class_access(c.class_id)));
CREATE POLICY portal_meeting_read ON public.learning_meetings FOR SELECT TO authenticated USING(learning_internal.portal_class_access(class_id));
CREATE POLICY portal_assignment_read ON public.learning_assignments FOR SELECT TO authenticated USING(learning_internal.portal_class_access(class_id) AND (learning_internal.portal_class_access(class_id,true) OR (published AND (target_all OR learning_internal.portal_is_target(assignment_id)))));
CREATE POLICY portal_target_read ON public.learning_assignment_targets FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) OR learning_internal.portal_assignment_staff(assignment_id));
CREATE POLICY portal_audit_read ON public.learning_audit_events FOR SELECT TO authenticated USING(learning_internal.portal_admin() OR learning_internal.portal_class_access(class_id,true));

CREATE FUNCTION learning_internal.portal_call(p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_column
DECLARE who uuid:=auth.uid(); cid uuid; cc public.learning_class_courses; cls public.learning_classes; lid uuid; eid uuid;
 rid uuid; mid uuid; aid uuid; req uuid; target uuid; code text; teacher_id uuid; isadmin boolean; kind text; cnt integer;
 result jsonb; arr jsonb; entry jsonb; starts timestamptz; release_time timestamptz; duration_min integer; old public.learning_assignments;
BEGIN
 IF NOT learning_internal.portal_session_ok() THEN RAISE EXCEPTION 'authentication_required'; END IF;
 isadmin:=EXISTS(SELECT 1 FROM public.learning_admins WHERE user_id=who);
 IF p_action='bootstrap' THEN
 RETURN jsonb_build_object('profile',(SELECT to_jsonb(p) FROM public.learning_profiles p WHERE user_id=who),
 'role',CASE WHEN isadmin THEN 'admin' WHEN EXISTS(SELECT 1 FROM public.learning_teacher_course_grants WHERE user_id=who) OR EXISTS(SELECT 1 FROM public.learning_class_teachers WHERE user_id=who) THEN 'teacher' ELSE 'student' END,
 'must_change_password',EXISTS(SELECT 1 FROM public.learning_portal_security WHERE user_id=who AND must_change_password));
 END IF;
 IF EXISTS(SELECT 1 FROM public.learning_portal_security WHERE user_id=who AND must_change_password) THEN RAISE EXCEPTION 'password_change_required'; END IF;
 IF p_action='courses' THEN
 RETURN COALESCE((SELECT jsonb_agg(to_jsonb(c)||jsonb_build_object('versions',(SELECT jsonb_agg(version ORDER BY version DESC) FROM public.learning_portal_releases r WHERE r.course_id=c.course_id))) FROM public.learning_courses c WHERE published AND (isadmin OR EXISTS(SELECT 1 FROM public.learning_teacher_course_grants g WHERE g.user_id=who AND g.course_id=c.course_id))), '[]');
 ELSIF p_action='classes' THEN
 RETURN COALESCE((SELECT jsonb_agg(to_jsonb(c)||jsonb_build_object('course',to_jsonb(cc),'course_title',co.title,'teachers',(SELECT jsonb_agg(jsonb_build_object('user_id',t.user_id,'name',p.display_name,'role',t.role)) FROM public.learning_class_teachers t JOIN public.learning_profiles p USING(user_id) WHERE t.class_id=c.class_id),'member_count',(SELECT count(*) FROM public.learning_class_members m WHERE m.class_id=c.class_id AND m.status='active'),'assignment_count',(SELECT count(*) FROM public.learning_assignments a WHERE a.class_id=c.class_id),'mine',EXISTS(SELECT 1 FROM public.learning_class_teachers t WHERE t.class_id=c.class_id AND t.user_id=who)) ORDER BY c.name) FROM public.learning_classes c JOIN public.learning_class_courses cc USING(class_id) JOIN public.learning_courses co USING(course_id) WHERE learning_internal.portal_class_access(c.class_id)), '[]');
 ELSIF p_action='teachers' THEN
 IF NOT isadmin THEN RAISE EXCEPTION 'admin_required'; END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id',p.user_id,'name',p.display_name,'email',u.email,'courses',(SELECT jsonb_agg(g.course_id) FROM public.learning_teacher_course_grants g WHERE g.user_id=p.user_id),'must_change',COALESCE(s.must_change_password,false))) FROM public.learning_profiles p JOIN auth.users u ON u.id=p.user_id LEFT JOIN public.learning_portal_security s USING(user_id) WHERE EXISTS(SELECT 1 FROM public.learning_teacher_course_grants g WHERE g.user_id=p.user_id) OR EXISTS(SELECT 1 FROM public.learning_admins a WHERE a.user_id=p.user_id)), '[]');
 ELSIF p_action='create_class' THEN
 kind:=p_data->>'course_id';teacher_id:=COALESCE((p_data->>'teacher_id')::uuid,who);req:=(p_data->>'request_id')::uuid;
 IF req IS NULL OR NOT EXISTS(SELECT 1 FROM public.learning_portal_releases WHERE course_id=kind AND version=COALESCE((p_data->>'version')::integer,1)) THEN RAISE EXCEPTION 'invalid_course_version'; END IF;
 IF NOT isadmin AND (teacher_id<>who OR NOT EXISTS(SELECT 1 FROM public.learning_teacher_course_grants WHERE user_id=who AND course_id=kind)) THEN RAISE EXCEPTION 'course_grant_required'; END IF;
 IF isadmin AND teacher_id<>who AND NOT EXISTS(SELECT 1 FROM public.learning_teacher_course_grants WHERE user_id=teacher_id AND course_id=kind) THEN RAISE EXCEPTION 'teacher_course_grant_required'; END IF;
 SELECT class_id INTO cid FROM public.learning_classes WHERE request_id=req;
 IF cid IS NOT NULL THEN IF NOT learning_internal.portal_class_access(cid,true) THEN RAISE EXCEPTION 'class_access_denied'; END IF; RETURN jsonb_build_object('class_id',cid,'duplicate',true); END IF;
 INSERT INTO public.learning_classes(name,school_year,owner_id,request_id) VALUES(trim(p_data->>'name'),p_data->>'school_year',teacher_id,req) RETURNING class_id INTO cid;
 INSERT INTO public.learning_course_runs(course_id,label,registration_open) VALUES(kind,'Portal · '||(p_data->>'school_year')||' · '||trim(p_data->>'name'),false) RETURNING run_id INTO rid;
 INSERT INTO public.learning_class_courses(class_id,course_id,run_id,content_version) VALUES(cid,kind,rid,COALESCE((p_data->>'version')::integer,1));
 INSERT INTO public.learning_class_teachers(class_id,user_id,role) VALUES(cid,teacher_id,'owner');
 INSERT INTO public.learning_staff(user_id,run_id) VALUES(teacher_id,rid) ON CONFLICT DO NOTHING;
 result:=jsonb_build_object('class_id',cid);
 ELSE
 cid:=(p_data->>'class_id')::uuid;
 IF p_action='join_class' THEN
 INSERT INTO learning_internal.portal_join_limits(user_id,slot) VALUES(who,date_trunc('hour',now())) ON CONFLICT(user_id,slot) DO UPDATE SET attempts=learning_internal.portal_join_limits.attempts+1 RETURNING attempts INTO cnt;
 IF cnt>20 THEN RETURN jsonb_build_object('error','join_rate_limit'); END IF;
 code:=upper(trim(p_data->>'code'));
 SELECT c.class_id INTO cid FROM learning_internal.portal_codes k JOIN public.learning_classes c USING(class_id) WHERE k.code_hash=encode(sha256(convert_to(code,'UTF8')),'hex') AND c.join_open AND c.status='active';
 IF cid IS NULL THEN RETURN jsonb_build_object('error','invalid_join_code'); END IF;
 IF EXISTS(SELECT 1 FROM public.learning_class_members WHERE class_id=cid AND user_id=who AND status='removed') THEN RETURN jsonb_build_object('error','member_removed'); END IF;
 INSERT INTO public.learning_class_members(class_id,user_id,academic_snapshot) SELECT cid,who,class_label FROM public.learning_profiles WHERE user_id=who ON CONFLICT DO NOTHING;
 SELECT * INTO cc FROM public.learning_class_courses WHERE class_id=cid;
 eid:=learning_internal.portal_enrollment(cc.class_course_id);
 result:=jsonb_build_object('class_id',cid,'enrollment_id',eid);
 ELSE
 IF cid IS NULL OR NOT learning_internal.portal_class_access(cid) THEN RAISE EXCEPTION 'class_access_denied'; END IF;
 SELECT * INTO cls FROM public.learning_classes WHERE class_id=cid;
 SELECT * INTO cc FROM public.learning_class_courses WHERE class_id=cid;
 IF p_action='class_detail' THEN
 result:=jsonb_build_object('class',to_jsonb(cls),'course',to_jsonb(cc),'staff',learning_internal.portal_class_access(cid,true),
 'lessons',CASE WHEN learning_internal.portal_class_access(cid,true) THEN (SELECT jsonb_agg(to_jsonb(l) ORDER BY position) FROM public.learning_lessons l WHERE course_id=cc.course_id AND content_version=cc.content_version) ELSE '[]'::jsonb END,
 'members',CASE WHEN learning_internal.portal_class_access(cid,true) THEN (SELECT jsonb_agg(to_jsonb(p)||jsonb_build_object('member_status',m.status,'joined_at',m.joined_at)) FROM public.learning_class_members m JOIN public.learning_profiles p USING(user_id) WHERE m.class_id=cid) ELSE '[]'::jsonb END,
 'meetings',(SELECT jsonb_agg(to_jsonb(m) ORDER BY starts_at) FROM public.learning_meetings m WHERE class_id=cid),
 'assignments',(SELECT jsonb_agg(to_jsonb(a)||jsonb_build_object('title',l.title,'lesson_key',l.lesson_key,'content_version',l.content_version,'is_open',learning_internal.portal_lesson_access(cid,l.lesson_id),'self_study',now()>=a.catchup_at,'progress',(SELECT to_jsonb(p) FROM public.learning_class_enrollments e JOIN public.learning_progress p USING(enrollment_id) WHERE e.class_course_id=cc.class_course_id AND e.user_id=who AND p.lesson_id=a.lesson_id)) ORDER BY a.release_at) FROM public.learning_assignments a JOIN public.learning_lessons l USING(lesson_id) WHERE a.class_id=cid AND (learning_internal.portal_class_access(cid,true) OR (a.published AND (a.target_all OR EXISTS(SELECT 1 FROM public.learning_assignment_targets t WHERE t.assignment_id=a.assignment_id AND t.user_id=who))))));
 RETURN result;
 ELSIF p_action='lesson' OR p_action='save_progress' OR p_action='attempt' THEN
 lid:=(p_data->>'lesson_id')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.learning_lessons WHERE lesson_id=lid AND course_id=cc.course_id) OR NOT learning_internal.portal_lesson_access(cid,lid) THEN RAISE EXCEPTION 'lesson_not_open'; END IF;
 eid:=learning_internal.portal_enrollment(cc.class_course_id);
 INSERT INTO public.learning_progress(enrollment_id,user_id,course_id,lesson_id) VALUES(eid,who,cc.course_id,lid) ON CONFLICT DO NOTHING;
 IF p_action='lesson' THEN
 RETURN jsonb_build_object('enrollment_id',eid,'run_id',cc.run_id,'course_id',cc.course_id,'lesson',(SELECT to_jsonb(l) FROM public.learning_lessons l WHERE lesson_id=lid),'payload',(SELECT string_agg(source,'' ORDER BY block)::jsonb FROM public.learning_portal_blocks WHERE lesson_id=lid),'progress',(SELECT to_jsonb(p) FROM public.learning_progress p WHERE enrollment_id=eid AND lesson_id=lid),'self_study',learning_internal.portal_class_access(cid,true) OR EXISTS(SELECT 1 FROM public.learning_assignments a WHERE a.class_id=cid AND a.lesson_id=lid AND published AND catchup_at<=now() AND (target_all OR EXISTS(SELECT 1 FROM public.learning_assignment_targets t WHERE t.assignment_id=a.assignment_id AND t.user_id=who))));
 END IF;
 IF cls.status='archived' THEN RAISE EXCEPTION 'class_archived'; END IF;
 IF p_action='attempt' THEN RETURN learning_internal.record_attempt(eid,lid,(p_data->>'attempt_id')::uuid,p_data->'payload'); END IF;
 RETURN learning_internal.save_progress(eid,lid,(p_data->>'revision')::integer,p_data->'state',(p_data->>'mutation_id')::uuid);
 ELSIF p_action='results' THEN
 IF NOT learning_internal.portal_class_access(cid,true) THEN RAISE EXCEPTION 'staff_required'; END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('profile',to_jsonb(p),'progress',COALESCE((SELECT jsonb_agg(to_jsonb(s)||jsonb_build_object('title',l.title)) FROM public.learning_class_enrollments e JOIN public.learning_progress s USING(enrollment_id) JOIN public.learning_lessons l USING(lesson_id) WHERE e.class_course_id=cc.class_course_id AND e.user_id=p.user_id),'[]'))) FROM public.learning_class_members m JOIN public.learning_profiles p USING(user_id) WHERE m.class_id=cid AND m.status='active'),'[]');
 ELSE
 IF NOT learning_internal.portal_class_access(cid,true) THEN RAISE EXCEPTION 'staff_required'; END IF;
 IF cls.status='archived' AND p_action<>'restore_class' THEN RAISE EXCEPTION 'class_archived'; END IF;
 IF p_action IN ('publish_class','rotate_code') THEN
 code:=''; FOR cnt IN 0..7 LOOP code:=code||substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',1+get_byte(sha256(convert_to(gen_random_uuid()::text,'UTF8')),cnt)%31,1); END LOOP;
 INSERT INTO learning_internal.portal_codes(class_id,code_hash) VALUES(cid,encode(sha256(convert_to(code,'UTF8')),'hex')) ON CONFLICT(class_id) DO UPDATE SET code_hash=EXCLUDED.code_hash,updated_at=now();
 UPDATE public.learning_classes SET status='active',join_open=true WHERE class_id=cid;
 result:=jsonb_build_object('code',code,'class_id',cid);
 ELSIF p_action='close_join' THEN UPDATE public.learning_classes SET join_open=false WHERE class_id=cid;result:='{"ok":true}';
 ELSIF p_action='archive_class' THEN UPDATE public.learning_classes SET status='archived',join_open=false WHERE class_id=cid;result:='{"ok":true}';
 ELSIF p_action='restore_class' THEN UPDATE public.learning_classes SET status='draft',join_open=false WHERE class_id=cid;result:='{"ok":true}';
 ELSIF p_action='update_class' THEN
 UPDATE public.learning_classes SET name=trim(p_data->>'name') WHERE class_id=cid;result:='{"ok":true}';
 ELSIF p_action='member_status' THEN
 UPDATE public.learning_class_members SET status=p_data->>'status' WHERE class_id=cid AND user_id=(p_data->>'user_id')::uuid;result:='{"ok":true}';
 ELSIF p_action='assign_teacher' THEN
 IF NOT isadmin THEN RAISE EXCEPTION 'admin_required'; END IF;
 teacher_id:=(p_data->>'user_id')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.learning_teacher_course_grants WHERE user_id=teacher_id AND course_id=cc.course_id) THEN RAISE EXCEPTION 'teacher_course_grant_required'; END IF;
 INSERT INTO public.learning_class_teachers(class_id,user_id) VALUES(cid,teacher_id) ON CONFLICT DO NOTHING;
 INSERT INTO public.learning_staff(user_id,run_id) VALUES(teacher_id,cc.run_id) ON CONFLICT DO NOTHING;result:='{"ok":true}';
 ELSIF p_action='schedule' THEN
 IF jsonb_array_length(p_data->'items') NOT BETWEEN 1 AND 52 THEN RAISE EXCEPTION 'invalid_schedule'; END IF;
 arr:='[]';FOR entry IN SELECT value FROM jsonb_array_elements(p_data->'items') LOOP
 lid:=(entry->>'lesson_id')::uuid;req:=(entry->>'request_id')::uuid;starts:=(entry->>'starts_at')::timestamptz;
 release_time:=COALESCE((entry->>'release_at')::timestamptz,starts);duration_min:=(entry->>'duration')::integer;
 IF NOT EXISTS(SELECT 1 FROM public.learning_lessons WHERE lesson_id=lid AND course_id=cc.course_id AND content_version=cc.content_version) OR req IS NULL THEN RAISE EXCEPTION 'invalid_lesson_version'; END IF;
 SELECT assignment_id INTO aid FROM public.learning_assignments WHERE request_id=req;
 IF aid IS NULL THEN
 INSERT INTO public.learning_meetings(class_id,starts_at,duration,room,series_id,request_id) VALUES(cid,starts,duration_min,COALESCE(entry->>'room',''),(p_data->>'series_id')::uuid,req) RETURNING meeting_id INTO mid;
 INSERT INTO public.learning_assignments(class_id,class_course_id,lesson_id,meeting_id,release_at,catchup_at,due_at,created_by,request_id,target_all,published)
 VALUES(cid,cc.class_course_id,lid,mid,release_time,GREATEST(release_time,COALESCE((entry->>'catchup_at')::timestamptz,starts+make_interval(mins=>duration_min))),(entry->>'due_at')::timestamptz,who,req,COALESCE(jsonb_array_length(entry->'targets'),0)=0,COALESCE((entry->>'published')::boolean,true)) RETURNING assignment_id INTO aid;
 IF entry ? 'targets' THEN FOR target IN SELECT value::text::uuid FROM jsonb_array_elements_text(entry->'targets') LOOP
 IF NOT EXISTS(SELECT 1 FROM public.learning_class_members WHERE class_id=cid AND user_id=target AND status='active') THEN RAISE EXCEPTION 'invalid_assignment_target'; END IF;
 INSERT INTO public.learning_assignment_targets(assignment_id,user_id) VALUES(aid,target);END LOOP;END IF;
 ELSE IF NOT EXISTS(SELECT 1 FROM public.learning_assignments WHERE assignment_id=aid AND class_id=cid) THEN RAISE EXCEPTION 'request_not_owned'; END IF;
 END IF;arr:=arr||jsonb_build_array(aid);END LOOP;result:=jsonb_build_object('assignments',arr);
 ELSIF p_action='reschedule' THEN
 aid:=(p_data->>'assignment_id')::uuid;SELECT * INTO old FROM public.learning_assignments WHERE assignment_id=aid AND class_id=cid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'assignment_not_found'; END IF;
 starts:=(p_data->>'starts_at')::timestamptz;duration_min:=(p_data->>'duration')::integer;release_time:=(p_data->>'release_at')::timestamptz;
 IF old.published AND old.release_at<=now() THEN release_time:=LEAST(old.release_at,release_time); END IF;
 UPDATE public.learning_meetings SET starts_at=starts,duration=duration_min WHERE meeting_id=old.meeting_id;
 UPDATE public.learning_assignments SET release_at=release_time,catchup_at=CASE WHEN old.catchup_at<=now() THEN old.catchup_at ELSE GREATEST(release_time,starts+make_interval(mins=>duration_min)) END,due_at=(p_data->>'due_at')::timestamptz WHERE assignment_id=aid;
 result:='{"ok":true}';
 ELSIF p_action='publish_assignment' THEN UPDATE public.learning_assignments SET published=true WHERE assignment_id=(p_data->>'assignment_id')::uuid AND class_id=cid;result:='{"ok":true}';
 ELSE RAISE EXCEPTION 'unknown_action'; END IF;
 END IF;END IF;END IF;
 INSERT INTO public.learning_audit_events(actor_id,class_id,action,details) VALUES(who,cid,p_action,jsonb_build_object('request_id',p_data->>'request_id'));
 RETURN result;
END $$;

CREATE FUNCTION public.learning_portal_call(p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT learning_internal.portal_call(p_action,p_data); $$;
REVOKE ALL ON FUNCTION public.learning_portal_call(text,jsonb) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.learning_portal_call(text,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION learning_internal.portal_call(text,jsonb),learning_internal.portal_session_ok(),learning_internal.portal_admin(),learning_internal.portal_class_access(uuid,boolean),learning_internal.portal_lesson_access(uuid,uuid),learning_internal.portal_enrollment(uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION learning_internal.portal_call(text,jsonb),learning_internal.portal_session_ok(),learning_internal.portal_admin(),learning_internal.portal_class_access(uuid,boolean) TO authenticated;
REVOKE ALL ON FUNCTION learning_internal.portal_is_target(uuid),learning_internal.portal_assignment_staff(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION learning_internal.portal_is_target(uuid),learning_internal.portal_assignment_staff(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';

-- Compatibility gates only affect portal enrollments/accounts. Legacy learners remain on their existing path.
CREATE FUNCTION learning_internal.portal_legacy_gate(p_enrollment uuid,p_lesson uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cid uuid;
BEGIN
 IF EXISTS(SELECT 1 FROM public.learning_portal_security WHERE user_id=auth.uid() AND must_change_password) THEN RAISE EXCEPTION 'password_change_required'; END IF;
 SELECT c.class_id INTO cid FROM public.learning_class_enrollments e JOIN public.learning_class_courses c USING(class_course_id) WHERE e.enrollment_id=p_enrollment AND e.user_id=auth.uid();
 IF cid IS NOT NULL THEN
 IF NOT learning_internal.portal_lesson_access(cid,p_lesson) OR EXISTS(SELECT 1 FROM public.learning_classes WHERE class_id=cid AND status='archived') THEN RAISE EXCEPTION 'lesson_not_open'; END IF;
 ELSIF EXISTS(SELECT 1 FROM public.learning_portal_security WHERE user_id=auth.uid() AND portal_only) THEN RAISE EXCEPTION 'portal_join_required';
 END IF;
END $$;
CREATE FUNCTION learning_internal.portal_content_access(p_lesson uuid,p_course text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.learning_portal_security WHERE user_id=auth.uid() AND must_change_password)
 AND (EXISTS(SELECT 1 FROM public.learning_class_enrollments e JOIN public.learning_class_courses c USING(class_course_id) WHERE e.user_id=auth.uid() AND c.course_id=p_course AND learning_internal.portal_lesson_access(c.class_id,p_lesson))
 OR (NOT EXISTS(SELECT 1 FROM public.learning_portal_security WHERE user_id=auth.uid() AND portal_only) AND EXISTS(SELECT 1 FROM public.learning_enrollments e WHERE e.user_id=auth.uid() AND e.course_id=p_course AND e.status='active' AND NOT EXISTS(SELECT 1 FROM public.learning_class_courses c WHERE c.run_id=e.run_id))));
$$;
REVOKE ALL ON FUNCTION learning_internal.portal_legacy_gate(uuid,uuid),learning_internal.portal_content_access(uuid,text) FROM public,anon;
GRANT EXECUTE ON FUNCTION learning_internal.portal_legacy_gate(uuid,uuid),learning_internal.portal_content_access(uuid,text) TO authenticated;
DROP POLICY enrolled_content_read ON public.learning_content;
CREATE POLICY enrolled_content_read ON public.learning_content FOR SELECT TO authenticated USING(learning_internal.portal_content_access(lesson_id,course_id));

CREATE OR REPLACE FUNCTION learning_internal.enroll(p_run uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE who uuid:=auth.uid(); course text; eid uuid;
BEGIN
 IF EXISTS(SELECT 1 FROM public.learning_portal_security WHERE user_id=auth.uid() AND (must_change_password OR portal_only)) THEN RAISE EXCEPTION 'portal_join_required'; END IF;
 IF who IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
 SELECT r.course_id INTO course FROM public.learning_course_runs r JOIN public.learning_courses c USING(course_id)
 WHERE r.run_id=p_run AND r.registration_open AND c.published;
 IF course IS NULL THEN RAISE EXCEPTION 'registration_closed'; END IF;
 INSERT INTO public.learning_enrollments(user_id,run_id,course_id) VALUES(who,p_run,course)
 ON CONFLICT(user_id,run_id) DO NOTHING;
 SELECT enrollment_id INTO eid FROM public.learning_enrollments WHERE user_id=who AND run_id=p_run AND status='active';
 IF eid IS NULL THEN RAISE EXCEPTION 'enrollment_not_active'; END IF;
 INSERT INTO public.learning_progress(enrollment_id,user_id,course_id,lesson_id)
 SELECT eid,who,course,lesson_id FROM public.learning_lessons WHERE course_id=course
 ON CONFLICT(enrollment_id,lesson_id) DO NOTHING;
 RETURN jsonb_build_object('enrollment_id',eid,'course_id',course);
END $function$
;

CREATE OR REPLACE FUNCTION learning_internal.save_progress(p_enrollment uuid, p_lesson uuid, p_revision integer, p_state jsonb, p_mutation uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE who uuid:=auth.uid(); rowdata public.learning_progress; mutation learning_internal.mutations;
BEGIN
 PERFORM learning_internal.portal_legacy_gate(p_enrollment,p_lesson);
 IF who IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
 IF jsonb_typeof(p_state)<>'object' OR pg_column_size(p_state)>131072 THEN RAISE EXCEPTION 'invalid_state'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.learning_enrollments e WHERE e.enrollment_id=p_enrollment AND e.user_id=who AND e.status='active') THEN RAISE EXCEPTION 'enrollment_not_owned'; END IF;
 SELECT * INTO rowdata FROM public.learning_progress WHERE enrollment_id=p_enrollment AND lesson_id=p_lesson AND user_id=who FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'lesson_not_in_course'; END IF;
 SELECT * INTO mutation FROM learning_internal.mutations WHERE mutation_id=p_mutation;
 IF FOUND THEN
   IF mutation.user_id<>who OR mutation.enrollment_id<>p_enrollment OR mutation.lesson_id<>p_lesson THEN RAISE EXCEPTION 'mutation_not_owned'; END IF;
   RETURN jsonb_build_object('revision',rowdata.revision,'state',rowdata.state,'duplicate',true);
 END IF;
 IF rowdata.revision<>p_revision THEN RETURN jsonb_build_object('conflict',true,'revision',rowdata.revision,'state',rowdata.state); END IF;
 UPDATE public.learning_progress SET state=p_state,revision=revision+1,updated_at=now() WHERE enrollment_id=p_enrollment AND lesson_id=p_lesson;
 INSERT INTO learning_internal.mutations(mutation_id,user_id,enrollment_id,lesson_id) VALUES(p_mutation,who,p_enrollment,p_lesson);
 RETURN jsonb_build_object('revision',rowdata.revision+1,'state',p_state,'conflict',false);
END $function$
;

CREATE OR REPLACE FUNCTION learning_internal.record_attempt(p_enrollment uuid, p_lesson uuid, p_attempt uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE who uuid:=auth.uid(); course text; existing public.learning_attempts;
BEGIN
 PERFORM learning_internal.portal_legacy_gate(p_enrollment,p_lesson);
 IF who IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
 IF jsonb_typeof(p_payload)<>'object' OR pg_column_size(p_payload)>16384 THEN RAISE EXCEPTION 'invalid_attempt'; END IF;
 SELECT e.course_id INTO course FROM public.learning_enrollments e JOIN public.learning_lessons l ON l.course_id=e.course_id
 WHERE e.enrollment_id=p_enrollment AND e.user_id=who AND e.status='active' AND l.lesson_id=p_lesson;
 IF course IS NULL THEN RAISE EXCEPTION 'lesson_not_owned'; END IF;
 SELECT * INTO existing FROM public.learning_attempts WHERE attempt_id=p_attempt;
 IF FOUND THEN
  IF existing.user_id<>who OR existing.enrollment_id<>p_enrollment OR existing.lesson_id<>p_lesson THEN RAISE EXCEPTION 'attempt_not_owned'; END IF;
  RETURN jsonb_build_object('attempt_id',p_attempt,'duplicate',true);
 END IF;
 INSERT INTO public.learning_attempts(attempt_id,enrollment_id,user_id,course_id,lesson_id,payload) VALUES(p_attempt,p_enrollment,who,course,p_lesson,p_payload);
 RETURN jsonb_build_object('attempt_id',p_attempt,'duplicate',false);
END $function$
;

CREATE OR REPLACE FUNCTION learning_internal.staff_access(p_run uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ SELECT CASE WHEN EXISTS(SELECT 1 FROM public.learning_portal_security WHERE user_id=auth.uid() AND must_change_password) THEN 'student' ELSE (SELECT CASE WHEN EXISTS(SELECT 1 FROM public.learning_admins WHERE user_id=auth.uid()) THEN 'admin'
 WHEN EXISTS(SELECT 1 FROM public.learning_staff WHERE user_id=auth.uid() AND run_id=p_run) THEN 'teacher' ELSE 'student' END) END; $function$
;
