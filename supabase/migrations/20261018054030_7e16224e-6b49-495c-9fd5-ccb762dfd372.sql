-- lovable-cron-fallback-reviewed: SQL-only vector-index seed queue wakes on enqueue; one-minute retries exist only while jobs remain and stop after drain or retry exhaustion, not permanent polling.
CREATE TABLE public.agency_training_seed_jobs (agency_id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), attempts integer NOT NULL DEFAULT 0, last_error text);
GRANT ALL ON public.agency_training_seed_jobs TO service_role;
ALTER TABLE public.agency_training_seed_jobs ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.seed_default_training_chunks() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.agency_id IS NULL OR btrim(NEW.agency_id)='' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND NEW.agency_id IS NOT DISTINCT FROM OLD.agency_id THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM public.training_doc_chunks WHERE agency_id=NEW.agency_id) THEN RETURN NEW; END IF;
 INSERT INTO public.agency_training_seed_jobs(agency_id) VALUES(NEW.agency_id) ON CONFLICT(agency_id) DO NOTHING;
 PERFORM pg_advisory_xact_lock(18701018);
 IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='seed-agency-training-background') THEN
  PERFORM cron.schedule('seed-agency-training-background','* * * * *','SELECT public.process_agency_training_seed_jobs()');
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.handle_new_agency_creation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 -- ensure_agency_id already set the final ID before insertion; do not overwrite it or rerun all update triggers.
 PERFORM net.http_post(url:='https://cjqeebyeqtzzqmmwvfga.supabase.co/functions/v1/notify-agency-created', headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.supabase_service_role_key',true)),body:=jsonb_build_object('email',NEW.email,'agency_id',NEW.agency_id));
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.process_agency_training_seed_jobs() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE job record;
BEGIN
 FOR job IN SELECT agency_id FROM public.agency_training_seed_jobs WHERE attempts<5 ORDER BY created_at LIMIT 5 FOR UPDATE SKIP LOCKED LOOP
  BEGIN
   IF EXISTS(SELECT 1 FROM public.saas_suite_users WHERE agency_id=job.agency_id) AND NOT EXISTS(SELECT 1 FROM public.training_doc_chunks WHERE agency_id=job.agency_id) THEN
    INSERT INTO public.training_doc_chunks(agency_id,chunk_index,content,embedding,tier)
    SELECT job.agency_id,chunk_index,content,embedding,tier FROM public.training_doc_chunks WHERE agency_id='thebrewhq' ON CONFLICT(agency_id,chunk_index) DO NOTHING;
   END IF;
   DELETE FROM public.agency_training_seed_jobs WHERE agency_id=job.agency_id;
  EXCEPTION WHEN OTHERS THEN
   UPDATE public.agency_training_seed_jobs SET attempts=attempts+1,last_error=SQLERRM,updated_at=now() WHERE agency_id=job.agency_id;
  END;
 END LOOP;
 PERFORM pg_advisory_xact_lock(18701018);
 IF NOT EXISTS(SELECT 1 FROM public.agency_training_seed_jobs WHERE attempts<5) THEN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='seed-agency-training-background';
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.process_agency_training_seed_jobs() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_agency_training_seed_jobs() TO service_role;