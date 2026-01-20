CREATE TABLE "user_vocab" (
	"user_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"next_review_at" timestamp with time zone,
	CONSTRAINT "user_vocab_user_id_unit_id_pk" PRIMARY KEY("user_id","unit_id")
);
--> statement-breakpoint
ALTER TABLE "user_vocab" ADD CONSTRAINT "user_vocab_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_vocab" ADD CONSTRAINT "user_vocab_unit_id_learning_unit_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."learning_unit"("unit_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_vocab_user_last_reviewed_idx" ON "user_vocab" USING btree ("user_id","last_reviewed_at");--> statement-breakpoint
CREATE INDEX "user_vocab_user_next_review_idx" ON "user_vocab" USING btree ("user_id","next_review_at");