CREATE TABLE "pantone_colors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"library" text NOT NULL,
	"name" text,
	"hex" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pantone_colors_reference_library" UNIQUE("reference","library"),
	CONSTRAINT "pantone_colors_library" CHECK ("pantone_colors"."library" in ('TCX','TPG','C','U')),
	CONSTRAINT "pantone_colors_hex" CHECK ("pantone_colors"."hex" ~ '^#[0-9A-Fa-f]{6}$')
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "fabric_pantone_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_fabric_pantone_id_pantone_colors_id_fk" FOREIGN KEY ("fabric_pantone_id") REFERENCES "public"."pantone_colors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "products_fabric_pantone_idx" ON "products" USING btree ("fabric_pantone_id");--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "fabric_color_hex";