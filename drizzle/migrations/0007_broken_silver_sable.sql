ALTER TABLE `resumes` ADD `kind` text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE `resumes` ADD `source_resume_id` text;--> statement-breakpoint
ALTER TABLE `resumes` ADD `target_job_description` text;