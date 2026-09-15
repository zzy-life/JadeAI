ALTER TABLE "resumes" ADD COLUMN "kind" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "source_resume_id" text;--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "target_job_description" text;