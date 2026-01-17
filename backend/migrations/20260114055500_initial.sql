-- Migration: initial
-- Generated: 2026-01-14T05:55:00.000Z

--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" integer NOT NULL DEFAULT false,
	"image" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"username" text NOT NULL UNIQUE,
	"display_username" text UNIQUE
);

--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY,
	"expires_at" integer NOT NULL,
	"token" text NOT NULL UNIQUE,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" integer,
	"refresh_token_expires_at" integer,
	"scope" text,
	"password" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" integer NOT NULL,
	"created_at" integer,
	"updated_at" integer
);
