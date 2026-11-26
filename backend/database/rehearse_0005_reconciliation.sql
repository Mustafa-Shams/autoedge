-- Run on a restored PostgreSQL copy of the affected 0005 database first.
-- Archive the four verified-empty fixture tables with their indexes and sequences.
-- Requires a transaction. Leaves the recorded Alembic revision unchanged.
DO $reconcile$
DECLARE
    targets oid[] := ARRAY['public.deals'::regclass, 'public.inventory_units'::regclass,
        'public.sales_assistance'::regclass, 'public.trade_acquisitions'::regclass];
BEGIN
    IF current_schema() <> 'public' OR (SELECT count(*) FROM public.alembic_version) <> 1
       OR (SELECT version_num FROM public.alembic_version) IS DISTINCT FROM '0005_staff_portal' THEN
        RAISE EXCEPTION 'Expected a public schema at exactly 0005_staff_portal';
    END IF;
    LOCK TABLE public.deals, public.inventory_units, public.sales_assistance, public.trade_acquisitions
        IN ACCESS EXCLUSIVE MODE NOWAIT;
    IF EXISTS (SELECT FROM public.deals) OR EXISTS (SELECT FROM public.inventory_units)
       OR EXISTS (SELECT FROM public.sales_assistance) OR EXISTS (SELECT FROM public.trade_acquisitions) THEN
        RAISE EXCEPTION 'A table holds records; preserve them and reconcile individually';
    END IF;
    IF EXISTS (SELECT FROM pg_constraint WHERE contype='f' AND confrelid=ANY(targets)
               AND NOT (conrelid=ANY(targets)))
       OR EXISTS (SELECT FROM pg_depend dep JOIN pg_rewrite rw ON rw.oid=dep.objid
                  WHERE dep.classid='pg_rewrite'::regclass AND dep.refobjid=ANY(targets)) THEN
        RAISE EXCEPTION 'An external relation depends on a candidate table';
    END IF;
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public'
               AND (table_name,column_name) IN (('email_outbox','render_context'),('enquiries','deal_id'),
                   ('sales','checkout_key'),('sales','enquiry_id'))) THEN
        RAISE EXCEPTION 'Existing tables already contain redesign columns; reconcile individually';
    END IF;
    CREATE SCHEMA autoedge_fixture_archive_0005;
    ALTER TABLE public.deals SET SCHEMA autoedge_fixture_archive_0005;
    ALTER TABLE public.inventory_units SET SCHEMA autoedge_fixture_archive_0005;
    ALTER TABLE public.sales_assistance SET SCHEMA autoedge_fixture_archive_0005;
    ALTER TABLE public.trade_acquisitions SET SCHEMA autoedge_fixture_archive_0005;
END;
$reconcile$;
