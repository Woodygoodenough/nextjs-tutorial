CREATE TABLE "learning_unit" (
	"unit_id" uuid PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"group_id" uuid NOT NULL,
	"representative_entry_uuid" uuid NOT NULL,
	"match_method" text NOT NULL,
	"created_from_lookup_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lexical_group" (
	"group_id" uuid PRIMARY KEY NOT NULL,
	"fingerprint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lexical_group_entry" (
	"group_id" uuid NOT NULL,
	"entry_uuid" uuid NOT NULL,
	"rank" integer NOT NULL,
	CONSTRAINT "lexical_group_entry_group_id_entry_uuid_pk" PRIMARY KEY("group_id","entry_uuid")
);
--> statement-breakpoint
CREATE TABLE "lookup_key" (
	"lookup_key" text PRIMARY KEY NOT NULL,
	"unit_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hit_count" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mw_entry" (
	"entry_uuid" uuid PRIMARY KEY NOT NULL,
	"meta_id" text,
	"headword_raw" text,
	"stems" jsonb,
	"raw_json" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "learning_unit" ADD CONSTRAINT "learning_unit_group_id_lexical_group_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."lexical_group"("group_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_unit" ADD CONSTRAINT "learning_unit_representative_entry_uuid_mw_entry_entry_uuid_fk" FOREIGN KEY ("representative_entry_uuid") REFERENCES "public"."mw_entry"("entry_uuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lexical_group_entry" ADD CONSTRAINT "lexical_group_entry_group_id_lexical_group_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."lexical_group"("group_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lexical_group_entry" ADD CONSTRAINT "lexical_group_entry_entry_uuid_mw_entry_entry_uuid_fk" FOREIGN KEY ("entry_uuid") REFERENCES "public"."mw_entry"("entry_uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lookup_key" ADD CONSTRAINT "lookup_key_unit_id_learning_unit_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."learning_unit"("unit_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "learning_unit_group_label_unique" ON "learning_unit" USING btree ("group_id","label");--> statement-breakpoint
CREATE UNIQUE INDEX "lexical_group_fingerprint_unique" ON "lexical_group" USING btree ("fingerprint");