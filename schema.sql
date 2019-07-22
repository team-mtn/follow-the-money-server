DROP TABLE IF EXISTS politician;

CREATE TABLE politician
(
  id SERIAL PRIMARY KEY,
  created_at BIGINT,
  candidate_id VARCHAR(255),
  candidate_name VARCHAR(255),
  party VARCHAR(255),
  size0 INTEGER,
  size200 BIGINT,
  size500 BIGINT,
  size1k BIGINT,
  size2k BIGINT
);

