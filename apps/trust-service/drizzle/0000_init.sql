CREATE TYPE "public"."agent_status" AS ENUM('active', 'suspended', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."verification_session_status" AS ENUM('pending', 'verified', 'failed');--> statement-breakpoint
CREATE TYPE "public"."verification_method" AS ENUM('individual', 'lei');--> statement-breakpoint
CREATE TABLE "agent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"badge_id" text NOT NULL,
	"agent_card_uri" text,
	"channels" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "agent_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_badge_id_unique" UNIQUE("badge_id")
);
--> statement-breakpoint
CREATE TABLE "api_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "api_key_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "merchant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"wallet_account" text NOT NULL,
	"verification_method" "verification_method" NOT NULL,
	"disclosed_attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"verified_at" timestamp with time zone,
	"audit_record_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_wallet_account_unique" UNIQUE("wallet_account")
);
--> statement-breakpoint
CREATE TABLE "receipt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"buyer_ref_hash" text,
	"offer" jsonb NOT NULL,
	"price" numeric NOT NULL,
	"currency" text NOT NULL,
	"terms_hash" text,
	"anchor_tx_hash" text,
	"payment_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_account" text NOT NULL,
	"display_name" text NOT NULL,
	"request" jsonb NOT NULL,
	"vra_tx_hash" text NOT NULL,
	"status" "verification_session_status" DEFAULT 'pending' NOT NULL,
	"audit_record" jsonb,
	"vaa_tx_hash" text,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent" ADD CONSTRAINT "agent_merchant_id_merchant_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_merchant_id_merchant_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_merchant_idx" ON "agent" USING btree ("merchant_id");