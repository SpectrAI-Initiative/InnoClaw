-- Integration reference for jiabei/mysql; do not apply to production directly.
-- Append to that branch's migration journal and schema.ts during integration.
CREATE TABLE oidc_identities (
  id VARCHAR(43) COLLATE utf8mb4_bin PRIMARY KEY,
  user_id VARCHAR(191) NOT NULL,
  issuer LONGTEXT NOT NULL,
  subject VARCHAR(255) COLLATE utf8mb4_bin NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  INDEX oidc_identity_user_idx (user_id),
  CONSTRAINT oidc_identity_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE oidc_transactions (
  state_hash VARCHAR(43) COLLATE utf8mb4_bin PRIMARY KEY,
  binding_hash VARCHAR(43) COLLATE utf8mb4_bin NOT NULL,
  nonce VARCHAR(43) NOT NULL,
  verifier VARCHAR(43) NOT NULL,
  return_to LONGTEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  INDEX oidc_transaction_expiry_idx (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
