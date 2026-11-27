CREATE TABLE `oidc_identities` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `issuer` text NOT NULL,
  `subject` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `oidc_identity_user_idx` ON `oidc_identities` (`user_id`);
--> statement-breakpoint
CREATE TABLE `oidc_transactions` (
  `state_hash` text PRIMARY KEY NOT NULL,
  `binding_hash` text NOT NULL,
  `nonce` text NOT NULL,
  `verifier` text NOT NULL,
  `return_to` text NOT NULL,
  `expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `oidc_transaction_expiry_idx` ON `oidc_transactions` (`expires_at`);
