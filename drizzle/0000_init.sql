CREATE TABLE `activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`org` text NOT NULL,
	`role` text,
	`description` text,
	`start` text,
	`end` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `answer_bank` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`tags` text,
	`last_used_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `application_answers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`application_id` integer NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`answer_bank_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `application_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`application_id` integer NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`detail` text,
	`payload` text,
	`origin` text DEFAULT 'user' NOT NULL,
	`occurred_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`opportunity_id` integer NOT NULL,
	`status` text DEFAULT 'saved' NOT NULL,
	`status_changed_at` integer DEFAULT (unixepoch()) NOT NULL,
	`applied_at` integer,
	`resume_document_id` integer,
	`cover_letter_id` integer,
	`apply_level` text,
	`priority` integer DEFAULT 0,
	`notes` text,
	`next_action_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_opp_idx` ON `applications` (`opportunity_id`);--> statement-breakpoint
CREATE TABLE `companies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`domain` text,
	`ats` text,
	`board_id` text,
	`careers_url` text,
	`tier` text,
	`watch` integer DEFAULT false,
	`last_checked_at` integer,
	`last_open_count` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `companies_name_idx` ON `companies` (`name`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`role` text,
	`email` text,
	`linkedin` text,
	`company_name` text,
	`application_id` integer,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text DEFAULT 'resume' NOT NULL,
	`label` text NOT NULL,
	`filename` text NOT NULL,
	`mime` text NOT NULL,
	`storage_path` text NOT NULL,
	`parsed_text` text,
	`is_default` integer DEFAULT false,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `education` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`school` text NOT NULL,
	`degree` text,
	`major` text,
	`minor` text,
	`gpa` text,
	`start` text,
	`end` text,
	`coursework` text,
	`honors` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `emails` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gmail_id` text NOT NULL,
	`thread_id` text,
	`from_address` text NOT NULL,
	`subject` text NOT NULL,
	`snippet` text,
	`received_at` integer NOT NULL,
	`classification` text,
	`confidence` real,
	`extracted` text,
	`application_id` integer,
	`review_state` text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `emails_gmail_idx` ON `emails` (`gmail_id`);--> statement-breakpoint
CREATE TABLE `experiences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text DEFAULT 'job' NOT NULL,
	`org` text NOT NULL,
	`role` text NOT NULL,
	`location` text,
	`start` text,
	`end` text,
	`bullets` text,
	`skills` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `generated_docs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`application_id` integer,
	`opportunity_id` integer,
	`title` text NOT NULL,
	`prompt` text,
	`inputs` text,
	`body` text NOT NULL,
	`citations` text,
	`gaps` text,
	`unsupported` text,
	`model` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `interviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`application_id` integer NOT NULL,
	`round` text NOT NULL,
	`scheduled_at` integer,
	`format` text,
	`interviewers` text,
	`questions` text,
	`notes` text,
	`self_rating` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`url` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `oauth_tokens` (
	`provider` text PRIMARY KEY NOT NULL,
	`account_email` text,
	`scopes` text,
	`access_token_enc` text,
	`refresh_token_enc` text,
	`expires_at` integer,
	`last_sync_at` integer
);
--> statement-breakpoint
CREATE TABLE `offers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`application_id` integer NOT NULL,
	`hourly` real,
	`monthly_stipend` real,
	`housing` text,
	`relocation` text,
	`other` text,
	`decision_deadline` text,
	`decision` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `opportunities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_key` text NOT NULL,
	`type` text DEFAULT 'internship' NOT NULL,
	`title` text NOT NULL,
	`org` text NOT NULL,
	`company_id` integer,
	`location` text,
	`remote` integer DEFAULT false,
	`season` text,
	`deadline` text,
	`url` text,
	`apply_url` text,
	`ats` text,
	`description` text,
	`requirements` text,
	`compensation` text,
	`eligibility` text,
	`source_id` text,
	`posted_at` integer,
	`first_seen_at` integer DEFAULT (unixepoch()) NOT NULL,
	`closed_at` integer,
	`fit_score` real,
	`fit_reason` text,
	`hidden` integer DEFAULT false,
	`dedupe_key` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `opp_external_idx` ON `opportunities` (`external_key`);--> statement-breakpoint
CREATE INDEX `opp_dedupe_idx` ON `opportunities` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `opp_fit_idx` ON `opportunities` (`fit_score`);--> statement-breakpoint
CREATE TABLE `profile` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`pronouns` text,
	`email` text,
	`phone` text,
	`location` text,
	`work_authorization` text,
	`needs_sponsorship` integer DEFAULT false,
	`willing_to_relocate` integer DEFAULT true,
	`graduation_date` text,
	`class_year` text,
	`headline` text,
	`summary` text,
	`voice_profile` text,
	`preferences` text,
	`eeo_encrypted` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`tech` text,
	`url` text,
	`impact` text,
	`start` text,
	`end` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recommenders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`relationship` text,
	`email` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`application_id` integer,
	`due_at` integer NOT NULL,
	`text` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `skills` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`level` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`config` text,
	`last_run_at` integer,
	`last_status` text,
	`last_count` integer
);
--> statement-breakpoint
CREATE TABLE `writing_samples` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`prompt` text,
	`body` text NOT NULL,
	`tags` text,
	`word_count` integer DEFAULT 0 NOT NULL,
	`opportunity_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
