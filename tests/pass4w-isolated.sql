BEGIN;
CREATE TEMP TABLE contact_probe(first_name text,last_name text,phone text,email text);
INSERT INTO pg_temp.contact_probe VALUES('Synthetic','Person','4075550199','synthetic@example.test');
DO $$ BEGIN
IF (SELECT count(*) FROM pg_temp.contact_probe WHERE lower(email)=lower('Synthetic@example.test'))<>1 THEN RAISE EXCEPTION 'Email duplicate mismatch';END IF;
IF (SELECT count(*) FROM pg_temp.contact_probe WHERE regexp_replace(phone,'[^0-9]','','g')=regexp_replace('(407) 555-0199','[^0-9]','','g'))<>1 THEN RAISE EXCEPTION 'Phone duplicate mismatch';END IF;
END $$;
CREATE TEMP TABLE draft_probe(file_key text,row_number int,UNIQUE(file_key,row_number));
INSERT INTO pg_temp.draft_probe VALUES('synthetic-file',1),('synthetic-file',2);
INSERT INTO pg_temp.draft_probe VALUES('synthetic-file',1) ON CONFLICT DO NOTHING;
DO $$ BEGIN IF (SELECT count(*) FROM pg_temp.draft_probe)<>2 THEN RAISE EXCEPTION 'Retry duplicated rows';END IF; END $$;
CREATE TEMP TABLE rate_probe(payer text,version int,start_date date,end_date date,active boolean);
INSERT INTO pg_temp.rate_probe VALUES('synthetic-payer',1,'2026-11-01','2026-11-30',true),('synthetic-payer',2,'2026-12-01',null,true);
DO $$ BEGIN IF (SELECT max(version) FROM pg_temp.rate_probe WHERE payer='synthetic-payer' AND start_date<='2026-11-15' AND (end_date IS NULL OR end_date>='2026-11-15') AND active)<>1 THEN RAISE EXCEPTION 'Future rate rewrote historical selection';END IF;RAISE NOTICE 'Four synthetic import and version assertions passed';END $$;
ROLLBACK;