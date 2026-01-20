CREATE TABLE "user_progress_record" (
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"vocab_count" integer NOT NULL,
	"average_progress" integer NOT NULL,
	CONSTRAINT "user_progress_record_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
ALTER TABLE "user_progress_record" ADD CONSTRAINT "user_progress_record_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;