DROP TABLE IF EXISTS polotitians;

CREATE TABLE polititians
(
  id SERIAL PRIMARY KEY,
  created_at BIGINT,
  candidate_id VARCHAR(255),
  -- candidate_id: "P00011569"
  candidate_name VARCHAR(255),
  -- name: "753, JO",
  party VARCHAR(255),
  -- party: null,
  size0 INTEGER,
  -- results[0].total
  size200 BIGINT,
  -- results[1].total
  size500 BIGINT,
  -- results[2].total
  size1k BIGINT,
  -- results[3].total
  size2k BIGINT
  -- results[4].total

);

