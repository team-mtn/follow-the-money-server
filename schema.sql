DROP TABLE IF EXISTS politician;

CREATE TABLE politician
(
  id SERIAL PRIMARY KEY,
  created_at BIGINT,
  candidate_id VARCHAR(255),
  candidate_name VARCHAR(255),
  party VARCHAR(255),
  size0 DECIMAL,
  size200 DECIMAL,
  size500 DECIMAL,
  size1k DECIMAL,
  size2k DECIMAL
);

