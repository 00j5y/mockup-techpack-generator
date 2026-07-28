ALTER TABLE "products" DROP CONSTRAINT "products_sample_size_in_range";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sample_sizes" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "sample_size";--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_sample_sizes_in_range" CHECK ("products"."sample_sizes" <@ "products"."size_range");