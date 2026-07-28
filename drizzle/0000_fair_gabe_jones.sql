CREATE TABLE "artwork_pantones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artwork_spec_id" uuid NOT NULL,
	"pantone_id" text NOT NULL,
	"hex" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artwork_specs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"flat_id" uuid,
	"page" integer DEFAULT 8 NOT NULL,
	"title" text NOT NULL,
	"technique" text,
	"width_inches" numeric,
	"height_inches" numeric,
	"position_note" text,
	"background_hex" text,
	"x_percent" numeric,
	"y_percent" numeric,
	"width_percent" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artwork_specs_page" CHECK ("artwork_specs"."page" in (8, 9))
);
--> statement-breakpoint
CREATE TABLE "bom_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"cell_label" text NOT NULL,
	"item_type" text,
	"title" text NOT NULL,
	"description" text,
	"pantone_id" text,
	"image_storage_path" text,
	"measurement_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bom_items_product_cell" UNIQUE("product_id","cell_label"),
	CONSTRAINT "bom_items_cell_label" CHECK ("bom_items"."cell_label" in ('A','B','C','D','E','F','G','H','I','J','K','L')),
	CONSTRAINT "bom_items_type" CHECK ("bom_items"."item_type" is null or "bom_items"."item_type" in ('fabric_swatch','hardware','trim','other'))
);
--> statement-breakpoint
CREATE TABLE "callouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"flat_id" uuid,
	"number" integer NOT NULL,
	"x_percent" numeric NOT NULL,
	"y_percent" numeric NOT NULL,
	"pin_direction" text DEFAULT 'left' NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "callouts_product_number" UNIQUE("product_id","number"),
	CONSTRAINT "callouts_number_range" CHECK ("callouts"."number" between 1 and 12),
	CONSTRAINT "callouts_pin_direction" CHECK ("callouts"."pin_direction" in ('left','right'))
);
--> statement-breakpoint
CREATE TABLE "color_specs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"flat_id" uuid,
	"number" integer NOT NULL,
	"name" text NOT NULL,
	"hex" text,
	"pantone_id" text,
	"x_percent" numeric,
	"y_percent" numeric,
	"pin_direction" text DEFAULT 'left' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "color_specs_product_number" UNIQUE("product_id","number"),
	CONSTRAINT "color_specs_number_range" CHECK ("color_specs"."number" between 1 and 6),
	CONSTRAINT "color_specs_pin_direction" CHECK ("color_specs"."pin_direction" in ('left','right'))
);
--> statement-breakpoint
CREATE TABLE "extra_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"page" integer DEFAULT 10 NOT NULL,
	"title" text,
	"instruction_text" text,
	"image_storage_path" text,
	"x_percent" numeric,
	"y_percent" numeric,
	"width_percent" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "extra_references_product_page" UNIQUE("product_id","page"),
	CONSTRAINT "extra_references_page" CHECK ("extra_references"."page" in (10, 11, 12))
);
--> statement-breakpoint
CREATE TABLE "generated_visuals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"prompt_used" text NOT NULL,
	"quality" text,
	"storage_path" text NOT NULL,
	"input_flat_ids" uuid[],
	"cost_usd" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generated_visuals_quality" CHECK ("generated_visuals"."quality" is null or "generated_visuals"."quality" in ('low','medium','high'))
);
--> statement-breakpoint
CREATE TABLE "measurement_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"flat_id" uuid NOT NULL,
	"point_label" text NOT NULL,
	"measurement_name" text NOT NULL,
	"x_percent" numeric NOT NULL,
	"y_percent" numeric NOT NULL,
	"end_x_percent" numeric,
	"end_y_percent" numeric,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "measurement_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"measurement_point_id" uuid NOT NULL,
	"size" text NOT NULL,
	"value_inches" numeric NOT NULL,
	CONSTRAINT "measurement_values_point_size" UNIQUE("measurement_point_id","size")
);
--> statement-breakpoint
CREATE TABLE "packaging_specs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"type" text,
	"title" text NOT NULL,
	"image_storage_path" text,
	"width_inches" numeric,
	"height_inches" numeric,
	"pantone_id" text,
	"pantone_hex" text,
	"notes" text,
	"x_percent" numeric,
	"y_percent" numeric,
	"width_percent" numeric,
	"dimension_orientation" text DEFAULT 'horizontal' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "packaging_specs_type" CHECK ("packaging_specs"."type" is null or "packaging_specs"."type" in ('neck_tag','hang_tag','packaging_bag','other')),
	CONSTRAINT "packaging_specs_orientation" CHECK ("packaging_specs"."dimension_orientation" in ('horizontal','vertical'))
);
--> statement-breakpoint
CREATE TABLE "product_flats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"type" text NOT NULL,
	"storage_path" text NOT NULL,
	"overlay_storage_path" text,
	"label" text,
	"x_percent" numeric,
	"y_percent" numeric,
	"width_percent" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_flats_type" CHECK ("product_flats"."type" in ('flat_front','flat_back','flat_detail','inspo_reference'))
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drop_number" integer NOT NULL,
	"style_name" text NOT NULL,
	"style_number" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"main_fabric" text NOT NULL,
	"fabric_color_hex" text,
	"fabric_gradient_enabled" boolean DEFAULT false NOT NULL,
	"fabric_gradient_intensity" text,
	"size_range" text[] DEFAULT ARRAY['XS','S','M','L','XL','2XL']::text[] NOT NULL,
	"sample_size" text,
	"designer" text DEFAULT 'Constitue' NOT NULL,
	"company" text DEFAULT 'Constitue' NOT NULL,
	"logo_storage_path" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_category" CHECK ("products"."category" in ('shirt','pants','jacket','other')),
	CONSTRAINT "products_status" CHECK ("products"."status" in ('draft','sample','production','archived')),
	CONSTRAINT "products_gradient_intensity" CHECK ("products"."fabric_gradient_intensity" is null or "products"."fabric_gradient_intensity" in ('subtle','medium','strong')),
	CONSTRAINT "products_sample_size_in_range" CHECK ("products"."sample_size" is null or "products"."sample_size" = any("products"."size_range"))
);
--> statement-breakpoint
CREATE TABLE "techpack_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"history_label" text,
	"pages_affected" text,
	"summary" text,
	"pdf_storage_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "techpack_revisions_product_version" UNIQUE("product_id","version")
);
--> statement-breakpoint
ALTER TABLE "artwork_pantones" ADD CONSTRAINT "artwork_pantones_artwork_spec_id_artwork_specs_id_fk" FOREIGN KEY ("artwork_spec_id") REFERENCES "public"."artwork_specs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artwork_specs" ADD CONSTRAINT "artwork_specs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artwork_specs" ADD CONSTRAINT "artwork_specs_flat_id_product_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."product_flats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "callouts" ADD CONSTRAINT "callouts_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "callouts" ADD CONSTRAINT "callouts_flat_id_product_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."product_flats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "color_specs" ADD CONSTRAINT "color_specs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "color_specs" ADD CONSTRAINT "color_specs_flat_id_product_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."product_flats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extra_references" ADD CONSTRAINT "extra_references_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_visuals" ADD CONSTRAINT "generated_visuals_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_points" ADD CONSTRAINT "measurement_points_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_points" ADD CONSTRAINT "measurement_points_flat_id_product_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."product_flats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_values" ADD CONSTRAINT "measurement_values_measurement_point_id_measurement_points_id_fk" FOREIGN KEY ("measurement_point_id") REFERENCES "public"."measurement_points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packaging_specs" ADD CONSTRAINT "packaging_specs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_flats" ADD CONSTRAINT "product_flats_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "techpack_revisions" ADD CONSTRAINT "techpack_revisions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artwork_pantones_spec_idx" ON "artwork_pantones" USING btree ("artwork_spec_id");--> statement-breakpoint
CREATE INDEX "artwork_specs_product_idx" ON "artwork_specs" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "artwork_specs_flat_idx" ON "artwork_specs" USING btree ("flat_id");--> statement-breakpoint
CREATE INDEX "bom_items_product_idx" ON "bom_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "callouts_product_idx" ON "callouts" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "callouts_flat_idx" ON "callouts" USING btree ("flat_id");--> statement-breakpoint
CREATE INDEX "color_specs_product_idx" ON "color_specs" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "color_specs_flat_idx" ON "color_specs" USING btree ("flat_id");--> statement-breakpoint
CREATE INDEX "extra_references_product_idx" ON "extra_references" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "generated_visuals_product_idx" ON "generated_visuals" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "measurement_points_product_idx" ON "measurement_points" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "measurement_points_flat_idx" ON "measurement_points" USING btree ("flat_id");--> statement-breakpoint
CREATE INDEX "measurement_values_point_idx" ON "measurement_values" USING btree ("measurement_point_id");--> statement-breakpoint
CREATE INDEX "packaging_specs_product_idx" ON "packaging_specs" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_flats_product_idx" ON "product_flats" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "techpack_revisions_product_idx" ON "techpack_revisions" USING btree ("product_id");